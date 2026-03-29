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
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Panel,
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
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import Toast from "./Toast";

// ─── dagre typings (no @types/dagre available) ───────────────────────────────
interface DagreGraph {
  setDefaultEdgeLabel: (fn: () => object) => void;
  setGraph: (opts: { rankdir: string; nodesep: number; ranksep: number }) => void;
  setNode: (id: string, dims: { width: number; height: number }) => void;
  setEdge: (src: string, tgt: string) => void;
  node: (id: string) => { x: number; y: number };
}
interface Dagre {
  graphlib: { Graph: new () => DagreGraph };
  layout: (g: DagreGraph) => void;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dagre = require("dagre") as Dagre;

// ─── Types (from centralized database types) ─────────────────────────────────
import type { DbTechniqueNode as DbNode, DbTechniqueEdge } from "@/lib/database.types";
type DbEdge = Pick<DbTechniqueEdge, "id" | "source_id" | "target_id" | "label">;

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

// ─── Mastery level → glass morphism node classes ─────────────────────────────

function masteryNodeClass(level: number | undefined): string {
  if (level === 2) return "bg-emerald-900/20 border-emerald-500/50 text-emerald-300";
  if (level === 1) return "bg-blue-900/20 border-blue-500/50 text-blue-300";
  return "bg-zinc-800/50 border-zinc-700 text-zinc-400"; // 0 or undefined = Locked
}

function masterySelectedRing(level: number | undefined): string {
  if (level === 2) return "ring-2 ring-emerald-400/40";
  if (level === 1) return "ring-2 ring-blue-400/40";
  return "ring-2 ring-[#6366f1]/40";
}

// ─── Canvas Legend ─────────────────────────────────────────────────────────────

function SkillMapLegend() {
  return (
    <Panel position="bottom-right">
      <div className="flex items-center gap-2.5 bg-zinc-900/80 border border-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 pointer-events-none select-none">
        {[
          { label: "Locked",   cls: "border-zinc-600 bg-zinc-700/60" },
          { label: "Learning", cls: "border-blue-500/70 bg-blue-900/40" },
          { label: "Mastered", cls: "border-emerald-500/70 bg-emerald-900/40" },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm border ${cls} inline-block`} />
            <span className="text-xs text-zinc-400">{label}</span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

// ─── Custom Zoom Controls ──────────────────────────────────────────────────────

function CustomZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position="bottom-left">
      <div className="flex flex-col gap-1 bg-zinc-900/80 border border-white/10 backdrop-blur-sm rounded-lg p-1">
        <button
          onClick={() => zoomIn({ duration: 200 })}
          className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded-md transition-all text-base leading-none"
          aria-label="Zoom in"
          title="Zoom in"
        >+</button>
        <button
          onClick={() => zoomOut({ duration: 200 })}
          className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded-md transition-all text-base leading-none"
          aria-label="Zoom out"
          title="Zoom out"
        >−</button>
        <button
          onClick={() => fitView({ padding: 0.15, duration: 400 })}
          className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded-md transition-all"
          aria-label="Fit view"
          title="Fit view"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>
    </Panel>
  );
}

// ─── DB → React Flow converters ───────────────────────────────────────────────

function dbNodeToRF(n: DbNode): Node {
  return {
    id: n.id,
    type: "technique",
    position: { x: n.pos_x, y: n.pos_y },
    data: { label: n.name, mastery_level: n.mastery_level ?? 0 },
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
  data: { label: string; isPro?: boolean; t?: (k: string) => string; mastery_level?: number };
  selected: boolean;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const mastery = data.mastery_level ?? 0;

  return (
    <div
      className={`relative border rounded-xl px-3 py-2.5 shadow-lg transition-all select-none backdrop-blur-sm ${masteryNodeClass(mastery)} ${
        selected
          ? masterySelectedRing(mastery)
          : "hover:brightness-110"
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
      <span className="block text-xs font-medium break-words whitespace-pre-wrap leading-snug pr-4">
        {data.label}
      </span>

      {/* Delete button */}
      {data.isPro && !confirmDel && (
        <button
          className="absolute top-1.5 right-1.5 text-zinc-500 hover:text-red-400 text-xs leading-none transition-colors"
          onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
          aria-label={data.t?.("skillmap.deleteNode") ?? "Remove"}
        >
          ✕
        </button>
      )}
      {data.isPro && confirmDel && (
        <div className="flex items-center gap-1 mt-1.5">
          <button
            className="text-xs bg-red-600 hover:bg-red-500 text-white px-1.5 py-0.5 rounded transition-colors"
            onClick={(e) => { e.stopPropagation(); _deleteNodeRef.current(id); }}
          >
            {data.t?.("common.delete") ?? "Del"}
          </button>
          <button
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
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
  const [isLoading, setIsLoading] = useState(false);
  const fallbackUrl = isAnnual ? stripeAnnualLink : stripePaymentLink;

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: isAnnual ? "annual" : "monthly" }),
      });
      if (res.ok) {
        const json = await res.json() as { url?: string; fallback?: boolean };
        if (json.url && !json.fallback) {
          window.location.href = json.url;
          return;
        }
      }
    } catch {
      // network error — fall through to static link
    }
    // Fallback: redirect to static Stripe Payment Link (no trial)
    if (fallbackUrl) window.location.href = fallbackUrl;
    setIsLoading(false);
  };

  const hasLink = !!fallbackUrl;

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
          {isAnnual && <span className="bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">Save 33%</span>}
        </div>
        <div className="mb-1">
          {isAnnual
            ? <p className="text-white font-bold text-sm">$79.99 / year <span className="text-emerald-400 text-xs">≈ $6.67/mo</span></p>
            : <p className="text-white font-bold text-sm">$9.99 / month</p>}
        </div>
        <p className="text-xs text-emerald-400 mb-4">✓ 14-day free trial</p>
        {hasLink ? (
          <button
            onClick={handleCheckout}
            disabled={isLoading}
            className="block w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 disabled:opacity-60 text-black font-semibold py-3 rounded-xl mb-3 transition-all"
          >
            {isLoading ? "…" : t("skillmap.upgradeBtn")}
          </button>
        ) : (
          <span className="block w-full bg-zinc-700 text-gray-500 font-semibold py-3 rounded-xl mb-3 cursor-not-allowed">
            {t("skillmap.upgradeBtn")}
          </span>
        )}
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-300 min-h-[44px] px-6 py-2">{t("skillmap.maybeLater")}</button>
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
        <button onClick={onCancel} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-xs text-gray-300 py-2 min-h-[44px] rounded-lg transition-colors">
          {t("common.cancel")}
        </button>
        <button
          onClick={() => { if (name.trim()) onAdd(name.trim()); }}
          disabled={!name.trim()}
          className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-xs text-white py-2 min-h-[44px] rounded-lg transition-colors"
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

  // Online status (Supabase calls fail when offline → block write actions)
  const isOnline = useOnlineStatus();

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
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

  // Sync isPro + t into node data when they change (preserve mastery_level)
  useEffect(() => {
    setRfNodes((prev: Node[]) =>
      prev.map((n: Node) => ({ ...n, data: { ...n.data, isPro, t } }))
    );
  }, [isPro, t, setRfNodes]);

  // ── Load data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      // 8秒タイムアウト — auth session がハングしても確実に loading を解除する
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      const query = Promise.all([
        supabase.from("technique_nodes").select("id, user_id, name, description, pos_x, pos_y, mastery_level, created_at").eq("user_id", userId).order("created_at"),
        supabase.from("technique_edges").select("id, source_id, target_id, label").eq("user_id", userId),
      ]);
      const result = await Promise.race([query, timeout]);
      if (result) {
        const [nr, er] = result;
        if (!nr.error) {
          setRfNodes(
            (nr.data ?? []).map((n: DbNode) => ({
              ...dbNodeToRF(n),
              data: { label: n.name, isPro, t, mastery_level: n.mastery_level ?? 0 },
            }))
          );
        }
        if (!er.error) {
          setRfEdges((er.data ?? []).map((e: DbEdge) => dbEdgeToRF(e)));
        }
      }
    } catch (e) {
      console.error("[SkillMap] loadData error:", e);
    } finally {
      setLoading(false);
    }
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
    setRfNodes((prev: Node[]) => [...prev, { ...dbNodeToRF(data), data: { label: data.name, isPro, t, mastery_level: 0 } }]);
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
      setRfNodes((prev: Node[]) => [...prev, { ...dbNodeToRF(nodeData), data: { label: nodeData.name, isPro, t, mastery_level: 0 } }]);
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
  const mobileAddRef = useRef<HTMLInputElement>(null);

  // ── Paywall: lock canvas read-only when free user exceeds node limit ────
  const isLockedReadOnly = !isPro && rfNodes.length > 10;

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
      {/* Paywall banner: shown when free user already has > 10 nodes */}
      {isLockedReadOnly && (
        <div className="mb-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
          <p className="text-xs text-amber-300 leading-snug">
            {t("skillmap.overLimitBanner", { count: String(rfNodes.length) })}
          </p>
          {stripePaymentLink ? (
            <a
              href={stripePaymentLink}
              className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            >
              {t("skillmap.overLimitUpgrade")}
            </a>
          ) : (
            <button
              onClick={() => setShowProModal(true)}
              className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            >
              {t("skillmap.overLimitUpgrade")}
            </button>
          )}
        </div>
      )}

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
          disabled={isOrganizing || rfNodes.length === 0 || !isOnline}
          className="ml-auto flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-all active:scale-95"
          aria-label={t("skillmap.magicOrganize")}
        >
          {isOrganizing ? "⏳" : "✨"} {t("skillmap.magicOrganize")}
        </button>

        {/* Full Screen toggle */}
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen();
            } else {
              document.exitFullscreen();
            }
          }}
          className="flex items-center gap-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
          aria-label={isFullscreen ? t("skillmap.exitFullScreen") : t("skillmap.fullScreen")}
          title={isFullscreen ? t("skillmap.exitFullScreen") : t("skillmap.fullScreen")}
        >
          {isFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>

        {/* PC hint */}
        {!isMobile && (
          <span className="text-xs text-gray-500 ml-2 hidden sm:inline">{t("skillmap.pcHint")}</span>
        )}

        {/* Mobile: Add technique button */}
        {isMobile && editMode && (
          <button
            disabled={!isOnline}
            onClick={() => {
              if (!isPro && rfNodes.length >= 10) { setShowProModal(true); return; }
              const lastNode = rfNodes[rfNodes.length - 1];
              const x = lastNode ? lastNode.position.x + 200 : 100;
              const y = lastNode ? lastNode.position.y : 100;
              setAddPopup({ screenX: 0, screenY: 0, flowX: x, flowY: y });
            }}
            className="text-xs bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-all active:scale-95"
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
          nodesDraggable={!isLockedReadOnly && editMode && isPro}
          nodesConnectable={!isLockedReadOnly && editMode}
          elementsSelectable={!isLockedReadOnly && editMode}
          deleteKeyCode={!isLockedReadOnly && isPro ? "Backspace" : null}
          panOnDrag={!connectingFrom}
          minZoom={0.2}
          maxZoom={2.5}
          style={{ background: "#080f1e" }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.04)" />
          <MiniMap
            nodeColor={(n) => {
              const lvl = (n.data as { mastery_level?: number }).mastery_level ?? 0;
              if (lvl === 2) return "#10b981";
              if (lvl === 1) return "#3b82f6";
              return "#52525b";
            }}
            maskColor="rgba(0,0,0,0.65)"
            style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
          />
          <CustomZoomControls />
          <SkillMapLegend />
        </ReactFlow>
      </div>

      {/* Add node popup: fixed position on PC, inline full-width on Mobile */}
      {addPopup && (
        addPopup.screenX === 0 ? (
          // Mobile: show inline below toolbar (not fixed-positioned)
          <div className="mt-2 bg-zinc-800 border border-white/20 rounded-xl shadow-2xl p-3 w-full">
            <input
              ref={mobileAddRef}
              type="text"
              autoFocus
              placeholder={t("skillmap.namePlaceholder")}
              onKeyDown={(e) => {
                const val = (e.target as HTMLInputElement).value.trim();
                if (e.key === "Enter" && val) handleAddNode(val, addPopup.flowX, addPopup.flowY);
                if (e.key === "Escape") setAddPopup(null);
              }}
              className="w-full bg-zinc-700 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none mb-2"
              maxLength={80}
            />
            <div className="flex gap-2">
              <button onClick={() => setAddPopup(null)} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-xs text-gray-300 py-2 min-h-[44px] rounded-lg transition-colors">
                {t("common.cancel")}
              </button>
              <button
                onClick={() => {
                  const val = mobileAddRef.current?.value.trim() ?? "";
                  if (val) handleAddNode(val, addPopup.flowX, addPopup.flowY);
                }}
                className="flex-1 bg-[#10B981] hover:bg-[#0d9668] text-xs text-white py-2 min-h-[44px] rounded-lg transition-colors"
              >
                {t("skillmap.addBtn")}
              </button>
            </div>
          </div>
        ) : (
          // PC: fixed position at right-click location
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
