"use client";

/**
 * useSkillMap — Data layer hook for SkillMapV2.
 * Must be called inside ReactFlowProvider (uses useReactFlow internally).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type OnEdgesDelete,
  type OnNodesDelete,
} from "@xyflow/react";
import { createClient } from "@/lib/supabase/client";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { clientLogger } from "@/lib/clientLogger";
import {
  wouldCreateCycle,
  getLayoutedNodes,
  dbNodeToRF,
  dbEdgeToRF,
  type DbEdge,
} from "@/lib/skillMapUtils";
import type { DbTechniqueNode as DbNode } from "@/lib/database.types";

type UseSkillMapProps = {
  userId: string;
  isPro: boolean;
  t: (k: string) => string;
};

export function useSkillMap({ userId, isPro, t }: UseSkillMapProps) {
  const { fitView } = useReactFlow();
  const supabase = useRef(createClient()).current;
  const isOnline = useOnlineStatus();
  // t is recreated every render by makeT() — use a ref to avoid infinite loops
  // in useCallback/useEffect deps while still having access to the latest value.
  const tRef = useRef(t);
  tRef.current = t;

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [showProModal, setShowProModal] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Sync isPro into node data when it changes (t via tRef — stable reference)
  useEffect(() => {
    setRfNodes((prev: Node[]) =>
      prev.map((n: Node) => ({ ...n, data: { ...n.data, isPro, t: tRef.current } }))
    );
  }, [isPro, setRfNodes]);

  // ── Load data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      // 8秒タイムアウト — auth session がハングしても確実に loading を解除する
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      const query = Promise.all([
        supabase
          .from("technique_nodes")
          .select("id, user_id, name, description, pos_x, pos_y, mastery_level, tags, created_at")
          .eq("user_id", userId)
          .order("created_at"),
        supabase
          .from("technique_edges")
          .select("id, source_id, target_id, label, notes")
          .eq("user_id", userId),
      ]);
      const result = await Promise.race([query, timeout]);
      if (result) {
        const [nr, er] = result;
        if (!nr.error) {
          setRfNodes(
            (nr.data ?? []).map((n: DbNode) => ({
              ...dbNodeToRF(n),
              data: { label: n.name, isPro, t: tRef.current, mastery_level: n.mastery_level ?? 0, tags: n.tags ?? [] },
            }))
          );
        }
        if (!er.error) {
          setRfEdges((er.data ?? []).map((e: DbEdge) => dbEdgeToRF(e)));
        }
      }
    } catch (e) {
      // z174: route via clientLogger so SkillMap load failures hit Sentry,
      // not just devtools (silent in production for non-admin users).
      clientLogger.error(
        "skillmap.load_data_failed",
        { userId },
        e instanceof Error ? e : new Error(String(e)),
      );
    } finally {
      setLoading(false);
    }
  }, [userId, isPro, supabase, setRfNodes, setRfEdges]); // t via tRef — not in deps

  useEffect(() => { loadData(); }, [loadData]);

  // ── Delete node handler ──────────────────────────────────────────────────
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      setRfNodes((prev: Node[]) => prev.filter((n: Node) => n.id !== nodeId));
      setRfEdges((prev: Edge[]) =>
        prev.filter((e: Edge) => e.source !== nodeId && e.target !== nodeId)
      );
      await supabase.from("technique_nodes").delete().eq("id", nodeId);
    },
    [supabase, setRfNodes, setRfEdges]
  );

  // ── onConnect (drag handle to handle, PC) ────────────────────────────────
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (!isPro && rfEdges.length >= 15) { setShowProModal(true); return; }
      if (wouldCreateCycle(rfEdges, connection.source, connection.target)) {
        showToast(tRef.current("skillmap.cycleError"), "error"); return;
      }
      if (rfEdges.some((e) => e.source === connection.source && e.target === connection.target)) {
        showToast(tRef.current("skillmap.addEdgeError"), "error"); return;
      }
      const { data, error } = await supabase
        .from("technique_edges")
        .insert({
          user_id: userId,
          source_id: connection.source,
          target_id: connection.target,
          label: null,
          created_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (error) { showToast(tRef.current("skillmap.addEdgeError"), "error"); return; }
      setRfEdges((prev: Edge[]) => addEdge(dbEdgeToRF(data), prev));
      showToast(tRef.current("skillmap.connectSuccess"), "success");
    },
    [rfEdges, isPro, userId, showToast, supabase, setRfEdges] // t via tRef
  );

  // ── Node drag stop → persist position ───────────────────────────────────
  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      await supabase
        .from("technique_nodes")
        .update({ pos_x: node.position.x, pos_y: node.position.y })
        .eq("id", node.id);
    },
    [supabase]
  );

  // ── Edge delete (keyboard Delete / click ✕ on edge) ─────────────────────
  const onEdgesDelete: OnEdgesDelete = useCallback(
    async (deleted) => {
      for (const e of deleted) {
        await supabase.from("technique_edges").delete().eq("id", e.id);
      }
    },
    [supabase]
  );

  // ── Nodes delete (keyboard Delete when node selected) ───────────────────
  const onNodesDelete: OnNodesDelete = useCallback(
    async (deleted) => {
      for (const n of deleted) {
        await supabase.from("technique_nodes").delete().eq("id", n.id);
      }
    },
    [supabase]
  );

  // ── Add node (PC right-click or mobile button) ───────────────────────────
  const handleAddNode = useCallback(
    async (name: string, flowX: number, flowY: number) => {
      if (!isPro && rfNodes.length >= 10) { setShowProModal(true); return; }
      const { data, error } = await supabase
        .from("technique_nodes")
        .insert({
          user_id: userId,
          name,
          description: null,
          pos_x: flowX,
          pos_y: flowY,
          created_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (error) { showToast(tRef.current("skillmap.addNodeError"), "error"); return; }
      setRfNodes((prev: Node[]) => [
        ...prev,
        { ...dbNodeToRF(data), data: { label: data.name, isPro, t: tRef.current, mastery_level: 0 } },
      ]);
      showToast(tRef.current("skillmap.addNodeSuccess"), "success");
    },
    [rfNodes.length, isPro, userId, showToast, supabase, setRfNodes] // t via tRef
  );

  // ── Add child node (mobile Bottom Drawer) ────────────────────────────────
  const handleAddChildNode = useCallback(
    async (parentId: string, childName: string) => {
      if (!isPro && rfNodes.length >= 10) { setShowProModal(true); return; }
      if (!isPro && rfEdges.length >= 15) { setShowProModal(true); return; }
      const parent = rfNodes.find((n) => n.id === parentId);
      const spawnX = parent ? parent.position.x + 180 : 100;
      const spawnY = parent ? parent.position.y + 120 : 200;
      const { data: nodeData, error: nodeErr } = await supabase
        .from("technique_nodes")
        .insert({
          user_id: userId,
          name: childName,
          description: null,
          pos_x: spawnX,
          pos_y: spawnY,
          created_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (nodeErr) { showToast(tRef.current("skillmap.addNodeError"), "error"); return; }
      const { data: edgeData, error: edgeErr } = await supabase
        .from("technique_edges")
        .insert({
          user_id: userId,
          source_id: parentId,
          target_id: nodeData.id,
          label: null,
          created_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (edgeErr) {
        await supabase.from("technique_nodes").delete().eq("id", nodeData.id);
        showToast(tRef.current("skillmap.addEdgeError"), "error"); return;
      }
      setRfNodes((prev: Node[]) => [
        ...prev,
        { ...dbNodeToRF(nodeData), data: { label: nodeData.name, isPro, t: tRef.current, mastery_level: 0 } },
      ]);
      setRfEdges((prev: Edge[]) => [...prev, dbEdgeToRF(edgeData)]);
      showToast(tRef.current("skillmap.addNodeSuccess"), "success");
    },
    [rfNodes, rfEdges, isPro, userId, showToast, supabase, setRfNodes, setRfEdges] // t via tRef
  );

  // ── Mobile: complete edge connection ─────────────────────────────────────
  const handleMobileConnect = useCallback(
    async (targetId: string) => {
      if (!connectingFrom || connectingFrom === targetId) { setConnectingFrom(null); return; }
      if (!isPro && rfEdges.length >= 15) { setShowProModal(true); setConnectingFrom(null); return; }
      if (wouldCreateCycle(rfEdges, connectingFrom, targetId)) {
        showToast(tRef.current("skillmap.cycleError"), "error"); setConnectingFrom(null); return;
      }
      if (rfEdges.some((e) => e.source === connectingFrom && e.target === targetId)) {
        showToast(tRef.current("skillmap.addEdgeError"), "error"); setConnectingFrom(null); return;
      }
      const { data, error } = await supabase
        .from("technique_edges")
        .insert({
          user_id: userId,
          source_id: connectingFrom,
          target_id: targetId,
          label: null,
          created_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (error) { showToast(tRef.current("skillmap.addEdgeError"), "error"); setConnectingFrom(null); return; }
      setRfEdges((prev: Edge[]) => [...prev, dbEdgeToRF(data)]);
      setConnectingFrom(null);
      showToast(tRef.current("skillmap.connectSuccess"), "success");
    },
    [connectingFrom, rfEdges, isPro, userId, showToast, supabase, setRfEdges] // t via tRef
  );

  // ── Magic Organize ────────────────────────────────────────────────────────
  const handleMagicOrganize = useCallback(async () => {
    if (rfNodes.length === 0) return;
    setIsOrganizing(true);
    const layouted = getLayoutedNodes(rfNodes, rfEdges);
    setRfNodes(layouted);
    await Promise.all(
      layouted.map((n) =>
        supabase
          .from("technique_nodes")
          .update({ pos_x: n.position.x, pos_y: n.position.y })
          .eq("id", n.id)
      )
    );
    setTimeout(() => fitView({ padding: 0.15, duration: 500 }), 50);
    setIsOrganizing(false);
    showToast(tRef.current("skillmap.organizeSuccess"), "success");
  }, [rfNodes, rfEdges, fitView, supabase, setRfNodes, showToast]); // t via tRef

  // ── T-29: Update edge notes ───────────────────────────────────────────────
  const handleUpdateEdgeNotes = useCallback(
    async (edgeId: string, notes: string) => {
      setRfEdges((prev: Edge[]) =>
        prev.map((e: Edge) => e.id === edgeId ? { ...e, data: { ...(e.data ?? {}), notes } } : e)
      );
      await supabase
        .from("technique_edges")
        .update({ notes: notes.trim() || null })
        .eq("id", edgeId);
    },
    [supabase, setRfEdges]
  );

  // ── T-29: Update node position tags ──────────────────────────────────────
  const handleUpdateNodeTags = useCallback(
    async (nodeId: string, tags: string[]) => {
      setRfNodes((prev: Node[]) =>
        prev.map((n: Node) => n.id === nodeId ? { ...n, data: { ...n.data, tags } } : n)
      );
      await supabase
        .from("technique_nodes")
        .update({ tags })
        .eq("id", nodeId);
    },
    [supabase, setRfNodes]
  );

  return {
    rfNodes, setRfNodes, onNodesChange,
    rfEdges, setRfEdges, onEdgesChange,
    loading,
    showProModal, setShowProModal,
    isOrganizing,
    toast, setToast,
    isOnline,
    connectingFrom, setConnectingFrom,
    handleDeleteNode,
    onConnect,
    onNodeDragStop,
    onEdgesDelete,
    onNodesDelete,
    handleAddNode,
    handleAddChildNode,
    handleMobileConnect,
    handleMagicOrganize,
    handleUpdateEdgeNotes,
    handleUpdateNodeTags,
  };
}
