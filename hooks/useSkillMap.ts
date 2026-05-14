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
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // z260y: userId 変更で loadData が再実行された時、stale な前の結果が
  // 後発の正しい結果を上書きしないよう mountedRef で防御。
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
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
      if (!mountedRef.current) return;
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
      if (mountedRef.current) setLoading(false);
    }
  }, [userId, isPro, supabase, setRfNodes, setRfEdges]); // t via tRef — not in deps

  useEffect(() => { loadData(); }, [loadData]);

  // ── Delete node handler ──────────────────────────────────────────────────
  // z258: optimistic delete + rollback on error (was silent data divergence:
  // node removed from UI but Supabase delete failed → ghost row on server)
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      let prevNodes: Node[] = [];
      let prevEdges: Edge[] = [];
      setRfNodes((prev: Node[]) => {
        prevNodes = prev;
        return prev.filter((n: Node) => n.id !== nodeId);
      });
      setRfEdges((prev: Edge[]) => {
        prevEdges = prev;
        return prev.filter((e: Edge) => e.source !== nodeId && e.target !== nodeId);
      });
      // z261p: defence-in-depth — owner filter even though RLS already enforces it
      const { error } = await supabase.from("technique_nodes").delete().eq("id", nodeId).eq("user_id", userId);
      if (error) {
        setRfNodes(prevNodes);
        setRfEdges(prevEdges);
        clientLogger.error("skillmap.delete_node_failed", { nodeId }, error);
        showToast(tRef.current("skillmap.deleteNodeError"), "error");
      }
    },
    [supabase, setRfNodes, setRfEdges, showToast, userId]
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
  // z258: log error so silent persistence failures hit Sentry instead of
  // disappearing into the void (UI stays at dragged position regardless).
  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      const { error } = await supabase
        .from("technique_nodes")
        .update({ pos_x: node.position.x, pos_y: node.position.y })
        .eq("id", node.id);
      if (error) {
        clientLogger.error("skillmap.node_drag_persist_failed", { nodeId: node.id }, error);
      }
    },
    [supabase]
  );

  // ── Edge delete (keyboard Delete / click ✕ on edge) ─────────────────────
  // z258: rollback failed deletes so UI doesn't diverge from server.
  const onEdgesDelete: OnEdgesDelete = useCallback(
    async (deleted) => {
      const failed: Edge[] = [];
      for (const e of deleted) {
        // z261p: defence-in-depth owner filter
        const { error } = await supabase.from("technique_edges").delete().eq("id", e.id).eq("user_id", userId);
        if (error) {
          clientLogger.error("skillmap.edge_delete_failed", { edgeId: e.id }, error);
          failed.push(e);
        }
      }
      if (failed.length > 0) {
        setRfEdges((prev: Edge[]) => [...prev, ...failed]);
        showToast(tRef.current("skillmap.deleteEdgeError"), "error");
      }
    },
    [supabase, setRfEdges, showToast, userId]
  );

  // ── Nodes delete (keyboard Delete when node selected) ───────────────────
  // z258: rollback failed deletes so UI doesn't diverge from server.
  const onNodesDelete: OnNodesDelete = useCallback(
    async (deleted) => {
      const failed: Node[] = [];
      for (const n of deleted) {
        // z261p: defence-in-depth owner filter
        const { error } = await supabase.from("technique_nodes").delete().eq("id", n.id).eq("user_id", userId);
        if (error) {
          clientLogger.error("skillmap.node_delete_failed", { nodeId: n.id }, error);
          failed.push(n);
        }
      }
      if (failed.length > 0) {
        setRfNodes((prev: Node[]) => [...prev, ...failed]);
        showToast(tRef.current("skillmap.deleteNodeError"), "error");
      }
    },
    [supabase, setRfNodes, showToast, userId]
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
        // z261p: defence-in-depth owner filter on rollback delete
        await supabase.from("technique_nodes").delete().eq("id", nodeData.id).eq("user_id", userId);
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
  // z258: optimistic update + rollback on error (was silent: notes appeared
  // saved in UI but Supabase update failed → next reload shows old notes).
  const handleUpdateEdgeNotes = useCallback(
    async (edgeId: string, notes: string) => {
      let prevEdges: Edge[] = [];
      setRfEdges((prev: Edge[]) => {
        prevEdges = prev;
        return prev.map((e: Edge) => e.id === edgeId ? { ...e, data: { ...(e.data ?? {}), notes } } : e);
      });
      const { error } = await supabase
        .from("technique_edges")
        .update({ notes: notes.trim() || null })
        .eq("id", edgeId);
      if (error) {
        setRfEdges(prevEdges);
        clientLogger.error("skillmap.update_edge_notes_failed", { edgeId }, error);
        showToast(tRef.current("skillmap.updateError"), "error");
      }
    },
    [supabase, setRfEdges, showToast]
  );

  // ── T-29: Update node position tags ──────────────────────────────────────
  // z258: optimistic update + rollback on error.
  const handleUpdateNodeTags = useCallback(
    async (nodeId: string, tags: string[]) => {
      let prevNodes: Node[] = [];
      setRfNodes((prev: Node[]) => {
        prevNodes = prev;
        return prev.map((n: Node) => n.id === nodeId ? { ...n, data: { ...n.data, tags } } : n);
      });
      const { error } = await supabase
        .from("technique_nodes")
        .update({ tags })
        .eq("id", nodeId);
      if (error) {
        setRfNodes(prevNodes);
        clientLogger.error("skillmap.update_node_tags_failed", { nodeId }, error);
        showToast(tRef.current("skillmap.updateError"), "error");
      }
    },
    [supabase, setRfNodes, showToast]
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
