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
  useMemo,
  useRef,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Panel,
  MiniMap,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useLocale } from "@/lib/i18n";
import { NODE_W, NODE_H } from "@/lib/skillMapUtils";
import { useSkillMap } from "@/hooks/useSkillMap";
import Toast from "./Toast";

// ─── Extracted sub-components ─────────────────────────────────────────────────
import { nodeTypes, deleteNodeRef, toggleCollapseRef, getDescendantIds } from "./skillmap/TechniqueNode";
import ProModal from "./skillmap/ProModal";
import BottomDrawer from "./skillmap/BottomDrawer";
import AddNodePopup from "./skillmap/AddNodePopup";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  userId: string;
  isPro: boolean;
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
};

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

// ─── Recent Focus Bar — Pro only ──────────────────────────────────────────────

function RecentFocusBar({
  nodes,
  recentIds,
  onFocus,
  t,
}: {
  nodes: Node[];
  recentIds: string[];
  onFocus: (id: string) => void;
  t: (k: string) => string;
}) {
  const visible = recentIds.filter((id) => nodes.some((n) => n.id === id));
  if (visible.length === 0) return null;

  return (
    <div
      className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-0.5"
      style={{ scrollbarWidth: "none" }}
    >
      <span className="flex-shrink-0 text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
        {t("skillmap.recentFocus")}
      </span>
      {visible.map((id) => {
        const node = nodes.find((n) => n.id === id);
        if (!node) return null;
        const label = String((node.data as { label?: unknown }).label ?? "");
        return (
          <button
            key={id}
            onClick={() => onFocus(id)}
            className="flex-shrink-0 text-xs bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 hover:text-white px-2.5 py-0.5 rounded-full transition-all active:scale-95 max-w-[140px] truncate"
            title={label}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main inner component (must be inside ReactFlowProvider) ──────────────────

function SkillMapInner({ userId, isPro, stripePaymentLink, stripeAnnualLink }: Props) {
  const { t } = useLocale();
  const { screenToFlowPosition, setCenter } = useReactFlow();

  // ── Data layer (Supabase + ReactFlow state) ──────────────────────────────
  const {
    rfNodes, setRfNodes, onNodesChange,
    rfEdges, onEdgesChange,
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
  } = useSkillMap({ userId, isPro, t });

  // ── Collapse / expand state (Pro only) ───────────────────────────────────
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // ── Recent Focus state (Pro only, max 5) ─────────────────────────────────
  const [recentFocusIds, setRecentFocusIds] = useState<string[]>([]);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [drawerNode, setDrawerNode] = useState<Node | null>(null);
  const [addPopup, setAddPopup] = useState<{ screenX: number; screenY: number; flowX: number; flowY: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [emptyAddName, setEmptyAddName] = useState("");
  const emptyRef = useRef<HTMLInputElement>(null);
  const mobileAddRef = useRef<HTMLInputElement>(null);

  // Keep module-level refs up-to-date (used by TechniqueNodeComp to avoid stale closure)
  useEffect(() => { deleteNodeRef.current = handleDeleteNode; }, [handleDeleteNode]);

  // ── Collapse toggle handler ───────────────────────────────────────────────
  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);
  useEffect(() => { toggleCollapseRef.current = handleToggleCollapse; }, [handleToggleCollapse]);

  // ── Focus / jump to node (Recent Focus bar) ──────────────────────────────
  const handleFocusNode = useCallback((nodeId: string) => {
    const node = rfNodes.find((n) => n.id === nodeId);
    if (!node) return;
    // Uncollapse any ancestor that is hiding this node
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      for (const cid of prev) {
        if (getDescendantIds(cid, rfEdges).has(nodeId)) next.delete(cid);
      }
      return next;
    });
    setCenter(node.position.x + NODE_W / 2, node.position.y + NODE_H / 2, {
      zoom: 1.5,
      duration: 600,
    });
  }, [rfNodes, rfEdges, setCenter]);

  // ── Hidden IDs: descendants of all collapsed nodes ────────────────────────
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const cid of collapsedIds) {
      getDescendantIds(cid, rfEdges).forEach((id) => hidden.add(id));
    }
    return hidden;
  }, [collapsedIds, rfEdges]);

  // ── Display nodes (add childCount / isCollapsed / hidden) ─────────────────
  const displayNodes = useMemo(
    () =>
      rfNodes.map((n) => ({
        ...n,
        hidden: hiddenIds.has(n.id),
        data: {
          ...n.data,
          childCount: rfEdges.filter((e) => e.source === n.id).length,
          isCollapsed: collapsedIds.has(n.id),
        },
      })),
    [rfNodes, rfEdges, hiddenIds, collapsedIds]
  );

  // ── Display edges (hide edges whose endpoints are hidden) ─────────────────
  const displayEdges = useMemo(
    () =>
      rfEdges.map((e) => ({
        ...e,
        hidden: hiddenIds.has(e.target) || hiddenIds.has(e.source),
      })),
    [rfEdges, hiddenIds]
  );

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

  // ── Event handlers ────────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (connectingFrom) { handleMobileConnect(node.id); return; }
      if (isMobile && editMode) { setDrawerNode(node); }
      // Track recently focused nodes — Pro only, dedup, max 5
      if (isPro) {
        setRecentFocusIds((prev) => [node.id, ...prev.filter((id) => id !== node.id)].slice(0, 5));
      }
    },
    [isMobile, editMode, connectingFrom, handleMobileConnect, isPro]
  );

  const onPaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault();
      if (isMobile) return;
      if (!isPro && rfNodes.length >= 10) { setShowProModal(true); return; }
      const flowPos = screenToFlowPosition({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY });
      setAddPopup({ screenX: (e as MouseEvent).clientX, screenY: (e as MouseEvent).clientY, flowX: flowPos.x, flowY: flowPos.y });
    },
    [isMobile, isPro, rfNodes.length, screenToFlowPosition, setShowProModal]
  );

  const onPaneClick = useCallback(() => {
    setAddPopup(null);
    if (connectingFrom) setConnectingFrom(null);
  }, [connectingFrom, setConnectingFrom]);

  // ── Paywall ───────────────────────────────────────────────────────────────
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
            onClick={() => {
              if (!isPro && rfNodes.length >= 10) { setShowProModal(true); return; }
              setEmptyAddName(" ");
              setTimeout(() => emptyRef.current?.focus(), 50);
            }}
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
                if (e.key === "Enter" && emptyAddName.trim()) { handleAddNode(emptyAddName.trim(), 200, 200); setEmptyAddName(""); }
                if (e.key === "Escape") setEmptyAddName("");
              }}
              className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
              maxLength={80}
            />
            <div className="flex gap-2 w-full">
              <button onClick={() => setEmptyAddName("")} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 text-sm py-2 rounded-xl transition-colors">{t("common.cancel")}</button>
              <button
                onClick={() => { if (emptyAddName.trim()) { handleAddNode(emptyAddName.trim(), 200, 200); setEmptyAddName(""); } }}
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
      {/* Paywall banner */}
      {isLockedReadOnly && (
        <div className="mb-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
          <p className="text-xs text-amber-300 leading-snug">
            {t("skillmap.overLimitBanner", { count: String(rfNodes.length) })}
          </p>
          {stripePaymentLink ? (
            <a
              href={userId ? `${stripePaymentLink}?client_reference_id=${userId}` : stripePaymentLink}
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

      {/* Recent Focus bar — Pro only */}
      {isPro && (
        <RecentFocusBar
          nodes={rfNodes}
          recentIds={recentFocusIds}
          onFocus={handleFocusNode}
          t={t}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
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
        {connectingFrom && (
          <span className="text-xs text-yellow-400 animate-pulse">
            {t("skillmap.connectMobileHint")}
          </span>
        )}
        <button
          onClick={handleMagicOrganize}
          disabled={isOrganizing || rfNodes.length === 0 || !isOnline}
          className="ml-auto flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-all active:scale-95"
          aria-label={t("skillmap.magicOrganize")}
        >
          {isOrganizing ? "⏳" : "✨"} {t("skillmap.magicOrganize")}
        </button>
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
        {!isMobile && (
          <span className="text-xs text-gray-500 ml-2 hidden sm:inline">{t("skillmap.pcHint")}</span>
        )}
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

      {/* React Flow canvas
          touch-action:none on the wrapper prevents iOS Safari from intercepting
          pointer events for page scroll / native pinch-zoom, letting ReactFlow
          handle all touch gestures (pan + pinch-zoom) without interference.    */}
      <div
        className="w-full rounded-xl overflow-hidden border border-white/10"
        style={{ height: "clamp(350px, 60vh, 620px)", touchAction: "none" }}
      >
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
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
          preventScrolling
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

      {/* Add node popup */}
      {addPopup && (
        addPopup.screenX === 0 ? (
          <div className="mt-2 bg-zinc-800 border border-white/20 rounded-xl shadow-2xl p-3 w-full">
            <input
              ref={mobileAddRef}
              type="text"
              autoFocus
              placeholder={t("skillmap.namePlaceholder")}
              onKeyDown={(e) => {
                const val = (e.target as HTMLInputElement).value.trim();
                if (e.key === "Enter" && val) { handleAddNode(val, addPopup.flowX, addPopup.flowY); setAddPopup(null); }
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
                  if (val) { handleAddNode(val, addPopup.flowX, addPopup.flowY); setAddPopup(null); }
                }}
                className="flex-1 bg-[#10B981] hover:bg-[#0d9668] text-xs text-white py-2 min-h-[44px] rounded-lg transition-colors"
              >
                {t("skillmap.addBtn")}
              </button>
            </div>
          </div>
        ) : (
          <AddNodePopup
            screenX={addPopup.screenX}
            screenY={addPopup.screenY}
            onAdd={(name) => { handleAddNode(name, addPopup.flowX, addPopup.flowY); setAddPopup(null); }}
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
