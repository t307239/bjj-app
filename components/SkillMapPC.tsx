"use client";

/**
 * SkillMapPC — Custom SVG + div canvas mindmap (no external dependency).
 *
 * Features:
 *  - Pan (drag background) + Zoom (wheel / buttons)
 *  - Drag nodes to reposition (persisted to DB)
 *  - Click edge-port to start connecting, click another node to complete
 *  - DAG cycle detection (DFS) before edge insert
 *  - Ghost node + Pro upsell modal at node 11
 *  - Read-only mode for downgraded Pro users
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import Toast from "./Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type TechniqueNode = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  pos_x: number;
  pos_y: number;
  created_at: string;
};

type TechniqueEdge = {
  id: string;
  source_id: string;
  target_id: string;
  label: string | null;
};

type Props = {
  userId: string;
  isPro: boolean;
  stripePaymentLink: string;
};

type DragState = {
  nodeId: string;
  startMouseX: number;
  startMouseY: number;
  startPosX: number;
  startPosY: number;
};

const NODE_W = 140;
const NODE_H = 48;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const SPAWN_OFFSET = 180;

// ─── DAG cycle detection ──────────────────────────────────────────────────────

function wouldCreateCycle(
  edges: TechniqueEdge[],
  sourceId: string,
  targetId: string
): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source_id)) adj.set(e.source_id, []);
    adj.get(e.source_id)!.push(e.target_id);
  }
  if (!adj.has(sourceId)) adj.set(sourceId, []);
  adj.get(sourceId)!.push(targetId);
  const visited = new Set<string>();
  const stack = [targetId];
  while (stack.length) {
    const n = stack.pop()!;
    if (n === sourceId) return true;
    if (visited.has(n)) continue;
    visited.add(n);
    for (const nb of adj.get(n) ?? []) stack.push(nb);
  }
  return false;
}

// ─── Utility: center of node port ────────────────────────────────────────────

function portCenter(node: TechniqueNode, side: "right" | "left" | "bottom" | "top") {
  switch (side) {
    case "right":  return { x: node.pos_x + NODE_W, y: node.pos_y + NODE_H / 2 };
    case "left":   return { x: node.pos_x,          y: node.pos_y + NODE_H / 2 };
    case "bottom": return { x: node.pos_x + NODE_W / 2, y: node.pos_y + NODE_H };
    case "top":    return { x: node.pos_x + NODE_W / 2, y: node.pos_y };
  }
}

// ─── Edge SVG path (curved Bezier) ───────────────────────────────────────────

function edgePath(src: TechniqueNode, tgt: TechniqueNode): string {
  const s = portCenter(src, "right");
  const t = portCenter(tgt, "left");
  const dx = Math.abs(t.x - s.x) * 0.5;
  return `M${s.x},${s.y} C${s.x + dx},${s.y} ${t.x - dx},${t.y} ${t.x},${t.y}`;
}

// ─── Pro Modal ────────────────────────────────────────────────────────────────

function ProModal({
  onClose,
  stripePaymentLink,
  t,
}: {
  onClose: () => void;
  stripePaymentLink: string;
  t: (k: string) => string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-7 max-w-sm w-full text-center shadow-2xl">
        <div className="text-4xl mb-3">🥋</div>
        <h3 className="text-lg font-bold text-white mb-2">{t("skillmap.proModalTitlePC")}</h3>
        <p className="text-sm text-gray-400 mb-6">{t("skillmap.proModalBodyPC")}</p>
        <a
          href={stripePaymentLink}
          className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold py-3 rounded-xl mb-3 transition-colors"
          aria-label={t("skillmap.upgradeAriaLabel")}
        >
          {t("skillmap.upgradeBtn")}
        </a>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-300">
          {t("skillmap.maybeLater")}
        </button>
      </div>
    </div>
  );
}

// ─── Empty State Inline Add Form ─────────────────────────────────────────────

function EmptyStateAddForm({
  onAdd,
  onCancel,
  t,
}: {
  onAdd: (name: string) => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-xs">
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
        className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
        maxLength={80}
      />
      <div className="flex gap-2 w-full">
        <button
          onClick={onCancel}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 text-sm py-2 rounded-xl transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={() => { if (name.trim()) onAdd(name.trim()); }}
          disabled={!name.trim()}
          className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
        >
          {t("skillmap.addBtn")}
        </button>
      </div>
    </div>
  );
}

// ─── Add Node Input (inline, placed near click position) ─────────────────────

function AddNodeInput({
  x, y, onAdd, onCancel, t,
}: {
  x: number; y: number;
  onAdd: (name: string) => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { ref.current?.focus(); }, []);

  return (
    <div
      style={{ position: "absolute", left: x, top: y, zIndex: 20 }}
      className="bg-zinc-800 border border-white/20 rounded-xl shadow-xl p-3 w-44"
    >
      <input
        ref={ref}
        type="text"
        placeholder={t("skillmap.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { if (name.trim()) onAdd(name.trim()); }
          if (e.key === "Escape") onCancel();
        }}
        className="w-full bg-zinc-700 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none mb-2"
        maxLength={80}
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-xs text-gray-300 py-1 rounded-lg"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={() => { if (name.trim()) onAdd(name.trim()); }}
          disabled={!name.trim()}
          className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-xs text-white py-1 rounded-lg"
        >
          {t("skillmap.addBtn")}
        </button>
      </div>
    </div>
  );
}

// ─── Edge Label Input (inline) ─────────────────────────────────────────────

function EdgeLabelInput({
  x, y, onConfirm, onCancel, t,
}: {
  x: number; y: number;
  onConfirm: (label: string) => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const [label, setLabel] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { ref.current?.focus(); }, []);

  return (
    <div
      style={{ position: "absolute", left: x, top: y, zIndex: 20 }}
      className="bg-zinc-800 border border-white/20 rounded-xl shadow-xl p-3 w-40"
    >
      <input
        ref={ref}
        type="text"
        placeholder={t("skillmap.edgeLabelPlaceholder")}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirm(label.trim());
          if (e.key === "Escape") onCancel();
        }}
        className="w-full bg-zinc-700 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none mb-2"
        maxLength={50}
      />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-zinc-700 text-xs text-gray-300 py-1 rounded-lg">
          {t("common.cancel")}
        </button>
        <button onClick={() => onConfirm(label.trim())} className="flex-1 bg-[#10B981] hover:bg-[#0d9668] text-xs text-white py-1 rounded-lg">
          {t("skillmap.connectBtn")}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SkillMapPC({ userId, isPro, stripePaymentLink }: Props) {
  const { t } = useLocale();
  // Stable supabase client ref
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<TechniqueNode[]>([]);
  const [edges, setEdges] = useState<TechniqueEdge[]>([]);
  const [loading, setLoading] = useState(true);

  // Canvas transform
  const [panX, setPanX] = useState(40);
  const [panY, setPanY] = useState(40);
  const [zoom, setZoom] = useState(1.0);

  // Interaction state
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // Connecting edge
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [pendingEdge, setPendingEdge] = useState<{
    sourceId: string; targetId: string; x: number; y: number;
  } | null>(null);

  // Adding node
  const [addingAt, setAddingAt] = useState<{ x: number; y: number } | null>(null);
  const [ghostNode, setGhostNode] = useState<{ x: number; y: number } | null>(null);

  // Pro modal
  const [showProModal, setShowProModal] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // ── Load data ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [nr, er] = await Promise.all([
      supabase.from("technique_nodes").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("technique_edges").select("*").eq("user_id", userId),
    ]);
    if (!nr.error) setNodes(nr.data ?? []);
    if (!er.error) setEdges(er.data ?? []);
    setLoading(false);
  }, [userId]); // supabase is stable via useRef

  useEffect(() => { loadData(); }, [loadData]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Canvas coords from event ────────────────────────────────────────────
  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { cx: 0, cy: 0 };
      return {
        cx: (clientX - rect.left - panX) / zoom,
        cy: (clientY - rect.top  - panY) / zoom,
      };
    },
    [panX, panY, zoom]
  );

  // ── Wheel zoom ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.001)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Mouse down on canvas background → pan ──────────────────────────────
  const onBgMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Clear connecting state on background click
    if (connectingFrom) { setConnectingFrom(null); return; }
    setIsPanning(true);
    panStart.current = { mx: e.clientX, my: e.clientY, px: panX, py: panY };
  };

  // ── Context menu on canvas → add node ──────────────────────────────────
  const onBgContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isPro && nodes.length >= 10) {
      const { cx, cy } = toCanvas(e.clientX, e.clientY);
      setGhostNode({ x: cx, y: cy });
      setShowProModal(true);
      return;
    }
    const { cx, cy } = toCanvas(e.clientX, e.clientY);
    setAddingAt({ x: cx, y: cy });
  };

  // ── Mouse move (panning + dragging) ───────────────────────────────────
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning && panStart.current) {
        setPanX(panStart.current.px + (e.clientX - panStart.current.mx));
        setPanY(panStart.current.py + (e.clientY - panStart.current.my));
      }
      if (dragging) {
        const dx = (e.clientX - dragging.startMouseX) / zoom;
        const dy = (e.clientY - dragging.startMouseY) / zoom;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragging.nodeId
              ? { ...n, pos_x: dragging.startPosX + dx, pos_y: dragging.startPosY + dy }
              : n
          )
        );
      }
    },
    [isPanning, dragging, zoom]
  );

  const onMouseUp = useCallback(async () => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
    }
    if (dragging) {
      // Persist position
      const node = nodes.find((n) => n.id === dragging.nodeId);
      if (node) {
        await supabase
          .from("technique_nodes")
          .update({ pos_x: node.pos_x, pos_y: node.pos_y })
          .eq("id", node.id);
      }
      setDragging(null);
    }
  }, [isPanning, dragging, nodes]); // supabase is stable via useRef

  // ── Node mouse down → drag ─────────────────────────────────────────────
  const onNodeMouseDown = (e: React.MouseEvent, node: TechniqueNode) => {
    if (connectingFrom) return; // in connecting mode — ignore drag
    e.stopPropagation();
    if (!isPro) { setShowProModal(true); return; }
    setDragging({
      nodeId: node.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: node.pos_x,
      startPosY: node.pos_y,
    });
  };

  // ── Port click → start/finish connecting ──────────────────────────────
  const onPortClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!isPro && edges.length >= 15) { setShowProModal(true); return; }
    if (!connectingFrom) {
      setConnectingFrom(nodeId);
    } else if (connectingFrom === nodeId) {
      setConnectingFrom(null); // cancel
    } else {
      // Finish connecting: show label input near the target node
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (!targetNode) return;
      const lx = targetNode.pos_x * zoom + panX + NODE_W / 2;
      const ly = targetNode.pos_y * zoom + panY - 70;
      setPendingEdge({ sourceId: connectingFrom, targetId: nodeId, x: lx, y: ly });
      setConnectingFrom(null);
    }
  };

  // ── Confirm edge with optional label ─────────────────────────────────
  const confirmEdge = async (label: string) => {
    if (!pendingEdge) return;
    const { sourceId, targetId } = pendingEdge;
    setPendingEdge(null);

    if (wouldCreateCycle(edges, sourceId, targetId)) {
      showToast(t("skillmap.cycleError"), "error");
      return;
    }
    const { data, error } = await supabase
      .from("technique_edges")
      .insert({
        user_id: userId,
        source_id: sourceId,
        target_id: targetId,
        label: label || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) { showToast(t("skillmap.addEdgeError"), "error"); return; }
    setEdges((prev) => [...prev, data]);
    showToast(t("skillmap.connectSuccess"), "success");
  };

  // ── Add node ─────────────────────────────────────────────────────────
  const addNode = async (name: string) => {
    if (!addingAt) return;
    setAddingAt(null);
    if (!isPro && nodes.length >= 10) {
      setGhostNode({ x: addingAt.x, y: addingAt.y });
      setShowProModal(true);
      return;
    }
    const { data, error } = await supabase
      .from("technique_nodes")
      .insert({
        user_id: userId,
        name,
        description: null,
        pos_x: addingAt.x,
        pos_y: addingAt.y,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) { showToast(t("skillmap.addNodeError"), "error"); return; }
    setNodes((prev) => [...prev, data]);
    showToast(t("skillmap.addNodeSuccess"), "success");
  };

  // ── Delete node (Pro only) ────────────────────────────────────────────
  const deleteNode = async (nodeId: string) => {
    if (!isPro) { setShowProModal(true); return; }
    const removed = nodes.find((n) => n.id === nodeId);
    const removedEdges = edges.filter((e) => e.source_id === nodeId || e.target_id === nodeId);
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source_id !== nodeId && e.target_id !== nodeId));
    const { error } = await supabase.from("technique_nodes").delete().eq("id", nodeId);
    if (error) {
      if (removed) setNodes((prev) => [...prev, removed]);
      setEdges((prev) => [...prev, ...removedEdges]);
      showToast(t("skillmap.deleteError"), "error");
    }
  };

  // ── Delete edge (Pro only) ────────────────────────────────────────────
  const deleteEdge = async (edgeId: string) => {
    if (!isPro) { setShowProModal(true); return; }
    const removed = edges.find((e) => e.id === edgeId);
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    const { error } = await supabase.from("technique_edges").delete().eq("id", edgeId);
    if (error) {
      if (removed) setEdges((prev) => [...prev, removed]);
      showToast(t("skillmap.deleteError"), "error");
    }
  };

  // ── Empty state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        {t("common.loading")}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-5xl mb-4">🗺️</div>
        <p className="text-gray-300 font-medium mb-1">{t("skillmap.emptyTitle")}</p>
        <p className="text-gray-500 text-sm mb-6">{t("skillmap.emptyBodyPC")}</p>
        {!isPro && nodes.length >= 10 ? (
          <button
            onClick={() => setShowProModal(true)}
            className="bg-zinc-700 text-gray-400 px-5 py-2.5 rounded-xl text-sm"
          >
            🔒 {t("skillmap.proLockBtn")}
          </button>
        ) : addingAt ? (
          <EmptyStateAddForm onAdd={addNode} onCancel={() => setAddingAt(null)} t={t} />
        ) : (
          <button
            onClick={() => setAddingAt({ x: 200, y: 200 })}
            className="bg-[#10B981] hover:bg-[#0d9668] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            + {t("skillmap.addFirstTechnique")}
          </button>
        )}
        {showProModal && (
          <ProModal onClose={() => { setShowProModal(false); setGhostNode(null); }} stripePaymentLink={stripePaymentLink} t={t} />
        )}
      </div>
    );
  }

  // ── Canvas ────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <span className="text-xs text-gray-500">{t("skillmap.pcHint")}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))}
            className="w-7 h-7 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm flex items-center justify-center"
            aria-label={t("common.zoomIn")}
          >+</button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))}
            className="w-7 h-7 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm flex items-center justify-center"
            aria-label={t("common.zoomOut")}
          >−</button>
          <button
            onClick={() => { setPanX(40); setPanY(40); setZoom(1); }}
            className="ml-2 text-xs text-gray-500 hover:text-gray-300"
            aria-label={t("skillmap.resetView")}
          >{t("skillmap.resetView")}</button>
        </div>
        {connectingFrom && (
          <span className="text-xs text-yellow-400 animate-pulse ml-2">
            {t("skillmap.connectingHint")}
          </span>
        )}
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative w-full bg-[#0a1020] border border-white/10 rounded-xl overflow-hidden select-none"
        style={{ height: 520, cursor: isPanning ? "grabbing" : connectingFrom ? "crosshair" : "grab" }}
        onMouseDown={onBgMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onContextMenu={onBgContextMenu}
      >
        {/* SVG layer — edges */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
            </marker>
          </defs>
          <g transform={`translate(${panX},${panY}) scale(${zoom})`}>
            {edges.map((edge) => {
              const src = nodes.find((n) => n.id === edge.source_id);
              const tgt = nodes.find((n) => n.id === edge.target_id);
              if (!src || !tgt) return null;
              const mp = portCenter(src, "right");
              const midX = (portCenter(src, "right").x + portCenter(tgt, "left").x) / 2;
              const midY = (portCenter(src, "right").y + portCenter(tgt, "left").y) / 2;
              return (
                <g key={edge.id} className="group">
                  <path
                    d={edgePath(src, tgt)}
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    opacity={0.7}
                  />
                  {/* Invisible wider hit area */}
                  <path
                    d={edgePath(src, tgt)}
                    stroke="transparent"
                    strokeWidth={12}
                    fill="none"
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPro) deleteEdge(edge.id);
                      else setShowProModal(true);
                    }}
                  />
                  {/* Edge label */}
                  {edge.label && (
                    <text
                      x={midX}
                      y={midY - 6}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#9ca3af"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Nodes layer */}
        <div
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {nodes.map((node) => {
            const isConnectSrc = connectingFrom === node.id;
            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  left: node.pos_x,
                  top: node.pos_y,
                  width: NODE_W,
                  height: NODE_H,
                  zIndex: dragging?.nodeId === node.id ? 10 : 1,
                }}
                onMouseDown={(e) => onNodeMouseDown(e, node)}
                className={`rounded-lg border flex items-center px-2.5 transition-all ${
                  isConnectSrc
                    ? "bg-[#6366f1]/20 border-[#6366f1]"
                    : "bg-zinc-800 border-white/20 hover:border-[#6366f1]/60"
                } ${isPro ? "cursor-move" : "cursor-default"}`}
              >
                {/* Node label */}
                <span
                  className="text-xs text-white font-medium truncate flex-1"
                  title={node.name}
                >
                  {node.name}
                </span>
                {/* Delete button */}
                {isPro && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                    className="ml-1 text-zinc-600 hover:text-red-400 text-xs flex-shrink-0"
                    aria-label={t("skillmap.deleteNode")}
                  >✕</button>
                )}
                {/* Connect port (right side) */}
                <button
                  onClick={(e) => onPortClick(e, node.id)}
                  style={{
                    position: "absolute",
                    right: -6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    zIndex: 2,
                  }}
                  className={`border-2 ${
                    isConnectSrc ? "bg-[#6366f1] border-[#6366f1]" : "bg-zinc-700 border-[#6366f1] hover:bg-[#6366f1]"
                  } transition-colors`}
                  aria-label={t("skillmap.portHint")}
                />
              </div>
            );
          })}

          {/* Ghost node (Pro paywall preview) */}
          {ghostNode && (
            <div
              style={{
                position: "absolute",
                left: ghostNode.x,
                top: ghostNode.y,
                width: NODE_W,
                height: NODE_H,
              }}
              className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 flex items-center justify-center opacity-60 pointer-events-none"
            >
              <span className="text-xs text-yellow-400">🔒 Pro</span>
            </div>
          )}

          {/* Inline add-node input */}
          {addingAt && (
            <AddNodeInput
              x={addingAt.x}
              y={addingAt.y}
              onAdd={addNode}
              onCancel={() => setAddingAt(null)}
              t={t}
            />
          )}

          {/* Inline edge label input */}
          {pendingEdge && (
            <EdgeLabelInput
              x={pendingEdge.x / zoom - panX / zoom}
              y={pendingEdge.y / zoom - panY / zoom}
              onConfirm={confirmEdge}
              onCancel={() => setPendingEdge(null)}
              t={t}
            />
          )}
        </div>

        {/* Tab key shortcut listener */}
        <input
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              if (!isPro && nodes.length >= 10) { setShowProModal(true); return; }
              // Spawn near last node or center
              const last = nodes[nodes.length - 1];
              const x = last ? last.pos_x + SPAWN_OFFSET : 100;
              const y = last ? last.pos_y : 100;
              setAddingAt({ x, y });
            }
          }}
          readOnly
          tabIndex={0}
          aria-label={t("skillmap.canvasShortcuts")}
        />
      </div>

      <p className="text-[10px] text-gray-600 mt-1 text-right">
        {t("skillmap.pcContextHint")}
      </p>

      {showProModal && (
        <ProModal
          onClose={() => { setShowProModal(false); setGhostNode(null); }}
          stripePaymentLink={stripePaymentLink}
          t={t}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
