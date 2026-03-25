"use client";

/**
 * SkillMapV2 — React Flow based skill map (replaces custom SVG canvas).
 *
 * Features:
 *  - PC: drag handles to connect · right-click canvas to add · drag to reposition
 *  - Mobile: View/Edit toggle · node tap → Bottom Drawer (add child / connect / remove)
 *  - Magic Organize: dagre TB auto-layout (one click)
 *  - MiniMap + Controls (zoom/fit) from React Flow
 *  - Full Supabase persistence
 *  - Pro gating: 10 nodes / 15 edges for free users
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import ReactFlow, {
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type NodeMouseHandler,
  type OnEdgesDelete,
  type OnNodesDelete,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import Toast from "./Toast";

// ─── dagre (no @types/dagre — use require to avoid TS errors) ─────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dagre = require("dagre") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type DbNode = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  pos_x: number;
  pos_y: number;
  created_at: string;
};

type DbEdge = {
  id: string;
  source_id: string;
  target_id: string;
  label: string | null;
};

type Props = {
  userId: string;
  isPro: boolean;
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 60;

// ─── Stable delete ref (avoids stale-closure in custom node data) ─────────────

const _deleteNodeRef = { current: (_id: string) => {} };

// ─── DAG cycle detection ──────────────────────────────────────────────────────

function wouldCreateCycle(edges: Edge[], srcId: string, tgtId: string): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  if (!adj.has(srcId)) adj.set(srcId, []);
  adj.get(srcId)!.push(tgtId);
  const visited = new Set<string>();
  const stack = [tgtId];
  while (stack.length) {
    const n = stack.pop()!;
    if (n === srcId) return true;
    if (visited.has(n)) continue;
    visited.add(n);
    for (const nb of adj.get(n) ?? []) stack.push(nb);
  }
  return false;
}

// ─── dagre auto-layout (Top → Bottom) ────────────────────────────────────────

function getLayoutedNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 50 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => {
    try { g.setEdge(e.source, e.target); } catch { /* skip bad edges */ }
  });
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    if (!pos) return n;
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

// ─── DB → React Flow converters ───────────────────────────────────────────────

function dbNodeToRF(n: DbNode): Node {
  return {
    id: n.id,
    type: "technique",
    position: { x: n.pos_x, y: n.pos_y },
    data: { label: n.name },
  };
}

function dbEdgeToRF(e: DbEdge): Edge {
  return {
    id: e.id,
    source: e.source_id,
    target: e.target_id,
    label: e.label ?? undefined,
    type: "smoothstep",
    animated: false,
    style: { stroke: "#6366f1", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
  };
}

// ─── Custom Technique Node ────────────────────────────────────────────────────

function TechniqueNodeComp({
  id,
  data,
  selected,
}: {
  id: string;
  data: { label: string; isPro?: boolean; t?: (k: string) => string };
  selected: boolean;
}) {
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div
      className={`relative bg-zinc-800 border rounded-xl px-3 py-2.5 shadow-lg transition-all select-none ${
        selected
          ? "border-[#6366f1] ring-2 ring-[#6366f1]/30"
          : "border-white/20 hover:border-[#6366f1]/50"
      }`}
      style={{ width: NODE_W, minHeight: NODE_H }}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ width: 12, height: 12, background: "#3f3f46", border: "2px solid #6366f1", borderRadius: "50%", top: -6 }}
      />

      {/* Label */}
      <span className="block text-xs text-white font-medium break-words whitespace-pre-wrap leading-snug pr-4">
        {data.label}
      </span>

      {/* Delete button */}
      {data.isPro && !confirmDel && (
        <button
          className="absolute top-1.5 right-1.5 text-zinc-500 hover:text-red-400 text-[11px] leading-none transition-colors"
          onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
          aria-label={data.t?.("skillmap.deleteNode") ?? "Remove"}
        >
          ✕
        </button>
      )}
      {data.isPro && confirmDel && (
        <div className="flex items-center gap-1 mt-1.5">
          <button
            className="text-[10px] bg-red-600 hover:bg-red-500 text-white px-1.5 py-0.5 rounded transition-colors"
            onClick={(e) => { e.stopPropagation(); _deleteNodeRef.current(id); }}
          >
            {data.t?.("common.delete") ?? "Del"}
          </button>
          <button
            className="text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
            onClick={(e) => { e.stopPropagation(); setConfirmDel(false); }}
          >
            {data.t?.("common.cancel") ?? "✕"}
          </button>
        </div>
      )}

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ width: 12, height: 12, background: "#3f3f46", border: "2px solid #6366f1", borderRadius: "50%", bottom: -6 }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = { technique: TechniqueNodeComp };

// ─── Pro Modal ────────────────────────────────────────────────────────────────

function ProModal({
  onClose,
  stripePaymentLink,
  stripeAnnualLink,
  t,
}: {
  onClose: () => void;
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
  t: (k: string) => string;
}) {
  const [isAnnual, setIsAnnual] = useState(false);
  const url = isAnnual ? stripeAnnualLink : stripePaymentLink;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-7 max-w-sm w-full text-center shadow-2xl mx-4">
        <div className="text-4xl mb-3">🥋</div>
        <h3 className="text-lg font-bold text-white mb-2">{t("skillmap.proModalTitlePC")}</h3>
        <p className="text-sm text-gray-400 mb-4">{t("skillmap.proModalBodyPC")}</p>
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className={`text-xs ${!isAnnual ? "text-white font-semibold" : "text-gray-500"}`}>Monthly</span>
          <button
            onClick={() => setIsAnnual((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isAnnual ? "bg-emerald-600" : "bg-zinc-600"}`}
          >
            <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${isAnnual ? "translate-x-5" : "translate-x-1"}`} />
          </button>
          <span className={`text-xs ${isAnnual ? "text-white font-semibold" : "text-gray-500"}`}>Annual</span>
          {isAnnual && <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">Save 16%</span>}
        </div>
        <div className="mb-4">
          {isAnnual
            ? <p className="text-white font-bold text-sm">$49.99 / year <span className="text-emerald-400 text-xs">≈ $4.17/mo</span></p>
            : <p className="text-white font-bold text-sm">$4.99 / month</p>}
        </div>
        {url ? (
          <a href={url} className="block w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-semibold py-3 rounded-xl mb-3 transition-all">
            {t("skillmap.upgradeBtn")}
          </a>
        ) : (
          <span className="block w-full bg-zinc-700 text-gray-500 font-semibold py-3 rounded-xl mb-3 cursor-not-allowed">
            {t("skillmap.upgradeBtn")}
          </span>
        )}
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-300">{t("skillmap.maybeLater")}</button>
      </div>
    </div>
  );
}

// ─── Bottom Drawer (mobile node tap menu) ─────────────────────────────────────

function BottomDrawer({
  node,
  isPro,
  onAddChild,
  onConnectTo,
  onRemove,
  onClose,
  t,
}: {
  node: Node;
  isPro: boolean;
  onAddChild: (name: string) => void;
  onConnectTo: () => void;
  onRemove: () => void;
  onClose: () => void;
  t: (k: string) => string;
}) {
  const [mode, setMode] = useState<"menu" | "addChild" | "confirmDelete">("menu");
  const [childName, setChildName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { if (mode === "addChild") inputRef.current?.focus(); }, [mode]);

  return (
    <div className="fixed inset-0 z-50" onPointerDown={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 rounded-t-2xl p-5 pb-8"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-4" />
        <p className="text-xs text-gray-400 text-center mb-4 font-semibold truncate px-6">
          {String(node.data.label)}
        </p>

        {mode === "menu" && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setMode("addChild")}
              className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white text-sm font-medium px-4 py-3.5 rounded-xl transition-all"
            >
              <span className="text-lg w-7 text-center">➕</span>
              {t("skillmap.drawerAddChild")}
            </button>
            <button
              onClick={() => { onClose(); onConnectTo(); }}
              className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white text-sm font-medium px-4 py-3.5 rounded-xl transition-all"
            >
              <span className="text-lg w-7 text-center">🔗</span>
              {t("skillmap.drawerConnect")}
            </button>
            {isPro ? (
              <button
                onClick={() => setMode("confirmDelete")}
                className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-red-400 text-sm font-medium px-4 py-3.5 rounded-xl transition-all"
              >
                <span className="text-lg w-7 text-center">🗑️</span>
                {t("skillmap.drawerRemove")}
              </button>
            ) : (
              <div className="w-full flex items-center gap-3 bg-zinc-800/50 text-zinc-500 text-sm px-4 py-3.5 rounded-xl cursor-not-allowed">
                <span className="text-lg w-7 text-center">🔒</span>
                {t("skillmap.drawerRemove")} (Pro)
              </div>
            )}
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-300 py-2.5 mt-1 transition-colors">
              {t("common.cancel")}
            </button>
          </div>
        )}

        {mode === "addChild" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400 text-center">{t("skillmap.drawerAddChildHint")}</p>
            <input
              ref={inputRef}
              type="text"
              placeholder={t("skillmap.namePlaceholder")}
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && childName.trim()) { onAddChild(childName.trim()); onClose(); }
                if (e.key === "Escape") setMode("menu");
              }}
              className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
              maxLength={80}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setMode("menu")}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 text-sm py-3 rounded-xl transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => { if (childName.trim()) { onAddChild(childName.trim()); onClose(); } }}
                disabled={!childName.trim()}
                className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
              >
                {t("skillmap.addBtn")}
              </button>
            </div>
          </div>
        )}

        {mode === "confirmDelete" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-300 text-center px-4">{t("skillmap.deleteConfirmMsg")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("menu")}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 text-sm py-3 rounded-xl transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => { onRemove(); onClose(); }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Node Popup (PC right-click) ─────────────────────────────────────────

function AddNodePopup({
  screenX,
  screenY,
  onAdd,
  onCancel,
  t,
}: {
  screenX: number;
  screenY: number;
  onAdd: (name: string) => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { ref.current?.focus(); }, []);

  return (
    <div
      style={{ position: "fixed", left: screenX, top: screenY, zIndex: 30 }}
      className="bg-zinc-800 border border-white/20 rounded-xl shadow-2xl p-3 w-48"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        type="text"
        placeholder={t("skillmap.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onAdd(name.trim());
          if (e.key === "Escape") onCancel();
        }}
        className="w-full bg-zinc-700 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none mb-2"
        maxLength={80}
      />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-xs text-gray-300 py-1 rounded-lg transition-colors">
          {t("common.cancel")}
        </button>
        <button
          onClick={() => { if (name.trim()) onAdd(name.trim()); }}
          disabled={!name.trim()}
          className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-xs text-white py-1 rounded-lg transition-colors"
        >
          {t("skillmap.addBtn")}
        </button>
      </div>
    </div>
  );
}

// ─── Main inner component (must be inside ReactFlowProvider) ──────────────────

function SkillMapInner({ userId, isPro, stripePaymentLink, stripeAnnualLink }: Props) {
  const { t } = useLocale();
  const { fitView, screenToFlowPosition } = useReactFlow();
  const supabase = useRef(createClient()).current;

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  // Device + mode
  const [isMobile, setIsMobile] = useState(false);
  const [editMode, setEditMode] = useState(true);

  // Mobile: connecting mode
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

  // Mobile: bottom drawer
  const [drawerNode, setDrawerNode] = useState<Node | null>(null);

  // PC: add node popup
  const [addPopup, setAddPopup] = useState<{ screenX: number; screenY: number; flowX: number; flowY: number } | null>(null);

  // Pro modal
  const [showProModal, setShowProModal] = useState(false);

  // Magic Organize
  const [isOrganizing, setIsOrganizing] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Delete node handler (stable via module-level ref) ────────────────────
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    setRfNodes((prev: Node[]) => prev.filter((n: Node) => n.id !== nodeId));
    setRfEdges((prev: Edge[]) => prev.filter((e: Edge) => e.source !== nodeId && e.target !== nodeId));
    await supabase.from("technique_nodes").delete().eq("id", nodeId);
  }, [supabase, setRfNodes, setRfEdges]);

  // Keep module-level ref up-to-date
  useEffect(() => { _deleteNodeRef.current = handleDeleteNode; }, [handleDeleteNode]);

  // Sync isPro + t into node data when they change
  useEffect(() => {
    setRfNodes((prev: Node[]) =>
      prev.map((n: Node) => ({ ...n, data: { ...n.data, isPro, t } }))
    );
  }, [isPro, t, setRfNodes]);

  // ── Load data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [nr, er] = await Promise.all([
      supabase.from("technique_nodes").select("id, user_id, name, description, pos_x, pos_y, created_at").eq("user_id", userId).order("created_at"),
      supabase.from("technique_edges").select("id, source_id, target_id, label").eq("user_id", userId),
    ]);
    if (!nr.error) {
      setRfNodes(
        (nr.data ?? []).map((n: DbNode) => ({
          ...dbNodeToRF(n),
          data: { label: n.name, isPro, t },
        }))
      );
    }
    if (!er.error) {
      setRfEdges((er.data ?? []).map((e: DbEdge) => dbEdgeToRF(e)));
    }
    setLoading(false);
  }, [userId, isPro, t, supabase, setRfNodes, setRfEdges]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── onConnect (drag handle to handle, PC) ────────────────────────────────
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (!isPro && rfEdges.length >= 15) { setShowProModal(true); return; }
      if (wouldCreateCycle(rfEdges, connection.source, connection.target)) {
        showToast(t("skillmap.cycleError"), "error"); return;
      }
      if (rfEdges.some((e) => e.source === connection.source && e.target === connection.target)) {
        showToast(t("skillmap.addEdgeError"), "error"); return;
      }
      const { data, error } = await supabase
        .from("technique_edges")
        .insert({ user_id: userId, source_id: connection.source, target_id: connection.target, label: null, created_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString() })
        .select()
        .single();
      if (error) { showToast(t("skillmap.addEdgeError"), "error"); return; }
      setRfEdges((prev: Edge[]) => addEdge(dbEdgeToRF(data), prev));
      showToast(t("skillmap.connectSuccess"), "success");
    },
    [rfEdges, isPro, userId, t, showToast, supabase, setRfEdges]
  );

  // ── Node drag stop → persist position ───────────────────────────────────
  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      await supabase.from("technique_nodes").update({ pos_x: node.position.x, pos_y: node.position.y }).eq("id", node.id);
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
  const handleAddNode = async (name: string, flowX: number, flowY: number) => {
    setAddPopup(null);
    if (!isPro && rfNodes.length >= 10) { setShowProModal(true); return; }
    const { data, error } = await supabase
      .from("technique_nodes")
      .insert({ user_id: userId, name, description: null, pos_x: flowX, pos_y: flowY, created_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString() })
      .select()
      .single();
    if (error) { showToast(t("skillmap.addNodeError"), "error"); return; }
    setRfNodes((prev: Node[]) => [...prev, { ...dbNodeToRF(data), data: { label: data.name, isPro, t } }]);
    showToast(t("skillmap.addNodeSuccess"), "success");
  };

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
        .insert({ user_id: userId, name: childName, description: null, pos_x: spawnX, pos_y: spawnY, created_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString() })
        .select()
        .single();
      if (nodeErr) { showToast(t("skillmap.addNodeError"), "error"); return; }
      const { data: edgeData, error: edgeErr } = await supabase
        .from("technique_edges")
        .insert({ user_id: userId, source_id: parentId, target_id: nodeData.id, label: null, created_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString() })
        .select()
        .single();
      if (edgeErr) {
        await supabase.from("technique_nodes").delete().eq("id", nodeData.id);
        showToast(t("skillmap.addEdgeError"), "error"); return;
      }
      setRfNodes((prev: Node[]) => [...prev, { ...dbNodeToRF(nodeData), data: { label: nodeData.name, isPro, t } }]);
      setRfEdges((prev: Edge[]) => [...prev, dbEdgeToRF(edgeData)]);
      showToast(t("skillmap.addNodeSuccess"), "success");
    },
    [rfNodes, rfEdges, isPro, userId, t, showToast, supabase, setRfNodes, setRfEdges]
  );

  // ── Mobile: complete edge connection ─────────────────────────────────────
  const handleMobileConnect = useCallback(
    async (targetId: string) => {
      if (!connectingFrom || connectingFrom === targetId) { setConnectingFrom(null); return; }
      if (!isPro && rfEdges.length >= 15) { setShowProModal(true); setConnectingFrom(null); return; }
      if (wouldCreateCycle(rfEdges, connectingFrom, targetId)) {
        showToast(t("skillmap.cycleError"), "error"); setConnectingFrom(null); return;
      }
      if (rfEdges.some((e) => e.source === connectingFrom && e.target === targetId)) {
        showToast(t("skillmap.addEdgeError"), "error"); setConnectingFrom(null); return;
      }
      const { data, error } = await supabase
        .from("technique_edges")
        .insert({ user_id: userId, source_id: connectingFrom, target_id: targetId, label: null, created_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString() })
        .select()
        .single();
      if (error) { showToast(t("skillmap.addEdgeError"), "error"); setConnectingFrom(null); return; }
      setRfEdges((prev: Edge[]) => [...prev, dbEdgeToRF(data)]);
      setConnectingFrom(null);
      showToast(t("skillmap.connectSuccess"), "success");
    },
    [connectingFrom, rfEdges, isPro, userId, t, showToast, supabase, setRfEdges]
  );

  // ── Node click ───────────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      // Mobile connecting mode: tap target node
      if (connectingFrom) {
        handleMobileConnect(node.id);
        return;
      }
      // Mobile edit mode: open bottom drawer
      if (isMobile && editMode) {
        setDrawerNode(node);
      }
    },
    [isMobile, editMode, connectingFrom, handleMobileConnect]
  );

  // ── Pane right-click → add node (PC only) ────────────────────────────────
  const onPaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault();
      if (isMobile) return;
      if (!isPro && rfNodes.length >= 10) { setShowProModal(true); return; }
      const flowPos = screenToFlowPosition({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY });
      setAddPopup({ screenX: (e as MouseEvent).clientX, screenY: (e as MouseEvent).clientY, flowX: flowPos.x, flowY: flowPos.y });
    },
    [isMobile, isPro, rfNodes.length, screenToFlowPosition]
  );

  // Close add popup on pane click
  const onPaneClick = useCallback(() => {
    setAddPopup(null);
    if (connectingFrom) setConnectingFrom(null);
  }, [connectingFrom]);

  // ── Magic Organize ────────────────────────────────────────────────────────
  const handleMagicOrganize = async () => {
    if (rfNodes.length === 0) return;
    setIsOrganizing(true);
    const layouted = getLayoutedNodes(rfNodes, rfEdges);
    setRfNodes(layouted);
    await Promise.all(
      layouted.map((n) =>
        supabase.from("technique_nodes").update({ pos_x: n.position.x, pos_y: n.position.y }).eq("id", n.id)
      )
    );
    setTimeout(() => fitView({ padding: 0.15, duration: 500 }), 50);
    setIsOrganizing(false);
    showToast(t("skillmap.organizeSuccess"), "success");
  };

  // ── Add first node (empty state button) ──────────────────────────────────
  const [emptyAddName, setEmptyAddName] = useState("");
  const emptyRef = useRef<HTMLInputElement>(null);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        {t("common.loading")}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (rfNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-center">
        <div className="text-5xl mb-4">🗺️</div>
        <p className="text-gray-300 font-medium mb-1">{t("skillmap.emptyTitle")}</p>
        <p className="text-gray-500 text-sm mb-5">{isMobile ? t("skillmap.emptyBody") : t("skillmap.emptyBodyPC")}</p>
        {!emptyAddName ? (
          <button
            onClick={() => { if (!isPro && rfNodes.length >= 10) { setShowProModal(true); return; } setEmptyAddName(" "); setTimeout(() => emptyRef.current?.focus(), 50); }}
            className="bg-[#10B981] hover:bg-[#0d9668] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-95"
          >
            + {t("skillmap.addFirstTechnique")}
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2 w-full max-w-xs">
            <input
              ref={emptyRef}
              type="text"
              placeholder={t("skillmap.namePlaceholder")}
              value={emptyAddName.trim() ? emptyAddName : ""}
              onChange={(e) => setEmptyAddName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && emptyAddName.trim()) handleAddNode(emptyAddName.trim(), 200, 200);
                if (e.key === "Escape") setEmptyAddName("");
              }}
              className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
              maxLength={80}
            />
            <div className="flex gap-2 w-full">
              <button onClick={() => setEmptyAddName("")} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 text-sm py-2 rounded-xl transition-colors">{t("common.cancel")}</button>
              <button
                onClick={() => { if (emptyAddName.trim()) handleAddNode(emptyAddName.trim(), 200, 200); }}
                disabled={!emptyAddName.trim()}
                className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
              >{t("skillmap.addBtn")}</button>
            </div>
          </div>
        )}
        {showProModal && <ProModal onClose={() => setShowProModal(false)} stripePaymentLink={stripePaymentLink} stripeAnnualLink={stripeAnnualLink} t={t} />}
      </div>
    );
  }

  // ── Canvas ────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
        {/* Mobile: View/Edit toggle */}
        {isMobile && (
          <div className="flex items-center gap-1.5 bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setEditMode(false)}
              className={`text-xs px-2.5 py-1 rounded-md transition-all ${!editMode ? "bg-zinc-600 text-white font-semibold" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {t("skillmap.viewMode")}
            </button>
            <button
              onClick={() => setEditMode(true)}
              className={`text-xs px-2.5 py-1 rounded-md transition-all ${editMode ? "bg-[#6366f1] text-white font-semibold" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              ✏️ {t("skillmap.editMode")}
            </button>
          </div>
        )}

        {/* Mobile connecting hint */}
        {connectingFrom && (
          <span className="text-xs text-yellow-400 animate-pulse">
            {t("skillmap.connectMobileHint")}
          </span>
        )}

        {/* Magic Organize */}
        <button
          onClick={handleMagicOrganize}
          disabled={isOrganizing || rfNodes.length === 0}
          className="ml-auto flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-all active:scale-95"
          aria-label={t("skillmap.magicOrganize")}
        >
          {isOrganizing ? "⏳" : "✨"} {t("skillmap.magicOrganize")}
        </button>

        {/* PC hint */}
        {!isMobile && (
          <span className="text-xs text-gray-500 ml-2 hidden sm:inline">{t("skillmap.pcHint")}</span>
        )}

        {/* Mobile: Add technique button */}
        {isMobile && editMode && (
          <button
            onClick={() => {
              if (!isPro && rfNodes.length >= 10) { setShowProModal(true); return; }
              const lastNode = rfNodes[rfNodes.length - 1];
              const x = lastNode ? lastNode.position.x + 200 : 100;
              const y = lastNode ? lastNode.position.y : 100;
              setAddPopup({ screenX: 0, screenY: 0, flowX: x, flowY: y });
            }}
            className="text-xs bg-[#10B981] hover:bg-[#0d9668] text-white px-3 py-1.5 rounded-lg transition-all active:scale-95"
          >
            + {t("skillmap.addNodeMobile")}
          </button>
        )}
      </div>

      {/* React Flow canvas */}
      <div
        className="w-full rounded-xl overflow-hidden border border-white/10"
        style={{ height: "clamp(350px, 60vh, 620px)" }}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onEdgesDelete={onEdgesDelete}
          onNodesDelete={onNodesDelete}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={editMode && isPro}
          nodesConnectable={editMode}
          elementsSelectable={editMode}
          deleteKeyCode={isPro ? "Backspace" : null}
          panOnDrag={!connectingFrom}
          minZoom={0.2}
          maxZoom={2.5}
          style={{ background: "#080f1e" }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.05)" />
          <Controls
            showInteractive={false}
            style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
          />
          <MiniMap
            nodeColor={() => "#6366f1"}
            maskColor="rgba(0,0,0,0.6)"
            style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
          />
        </ReactFlow>
      </div>

      {/* PC: Add node popup */}
      {addPopup && (
        addPopup.screenX === 0 ? (
          // Mobile add (no screen position) — show full-width below toolbar
          <div className="mt-2">
            <AddNodePopup
              screenX={0}
              screenY={0}
              onAdd={(name) => handleAddNode(name, addPopup.flowX, addPopup.flowY)}
              onCancel={() => setAddPopup(null)}
              t={t}
            />
          </div>
        ) : (
          <AddNodePopup
            screenX={addPopup.screenX}
            screenY={addPopup.screenY}
            onAdd={(name) => handleAddNode(name, addPopup.flowX, addPopup.flowY)}
            onCancel={() => setAddPopup(null)}
            t={t}
          />
        )
      )}

      {/* Mobile: Bottom Drawer */}
      {drawerNode && (
        <BottomDrawer
          node={drawerNode}
          isPro={isPro}
          onAddChild={(name) => handleAddChildNode(drawerNode.id, name)}
          onConnectTo={() => setConnectingFrom(drawerNode.id)}
          onRemove={() => handleDeleteNode(drawerNode.id)}
          onClose={() => setDrawerNode(null)}
          t={t}
        />
      )}

      {/* Pro modal */}
      {showProModal && (
        <ProModal
          onClose={() => setShowProModal(false)}
          stripePaymentLink={stripePaymentLink}
          stripeAnnualLink={stripeAnnualLink}
          t={t}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Default export (wraps with ReactFlowProvider) ────────────────────────────

export default function SkillMapV2(props: Props) {
  return (
    <ReactFlowProvider>
      <SkillMapInner {...props} />
    </ReactFlowProvider>
  );
}
