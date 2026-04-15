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
 *
 * Refactored Day 5_236: 794→~420 lines. Sub-components in ./skillmap/.
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
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useLocale } from "@/lib/i18n";
import { NODE_W, NODE_H } from "@/lib/skillMapUtils";
import { useSkillMap } from "@/hooks/useSkillMap";
import Toast from "./Toast";

// ─── Extracted sub-components ─────────────────────────────────────────────────
import { nodeTypes, deleteNodeRef, toggleCollapseRef, getDescendantIds } from "./skillmap/TechniqueNode";
import { PRESET_POSITIONS } from "./skillmap/constants";
import ProModal from "./skillmap/ProModal";
import BottomDrawer from "./skillmap/BottomDrawer";
import AddNodePopup from "./skillmap/AddNodePopup";
import SkillMapLegend from "./skillmap/SkillMapLegend";
import CustomZoomControls from "./skillmap/CustomZoomControls";
import RecentFocusBar from "./skillmap/RecentFocusBar";
import SkillMapToolbar from "./skillmap/SkillMapToolbar";
import PositionFilterChips from "./skillmap/PositionFilterChips";
import EdgeNotesPanel from "./skillmap/EdgeNotesPanel";
import SkillMapEmpty from "./skillmap/SkillMapEmpty";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  userId: string;
  isPro: boolean;
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
};

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
    handleUpdateEdgeNotes,
    handleUpdateNodeTags,
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
  const mobileAddRef = useRef<HTMLInputElement>(null);

  // T-29: position filter + edge notes
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [edgeNotes, setEdgeNotes] = useState<{ id: string; notes: string } | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const VISIBLE_TAG_COUNT = 4;

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
        label: (e.data as { notes?: string })?.notes ? "📝" : (e.label ?? undefined),
      })),
    [rfEdges, hiddenIds]
  );

  // T-29: unique non-preset tags from user's nodes
  const customTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of rfNodes) {
      for (const tag of ((n.data as { tags?: string[] }).tags ?? [])) {
        if (!PRESET_POSITIONS.includes(tag)) set.add(tag);
      }
    }
    return [...set];
  }, [rfNodes]);

  // T-29: tags that are actually used
  const usedTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of rfNodes) {
      for (const tag of ((n.data as { tags?: string[] }).tags ?? [])) {
        set.add(tag);
      }
    }
    return set;
  }, [rfNodes]);

  // Ghost filter: non-matching nodes get dimmed instead of hidden
  const filteredDisplayNodes = useMemo(() => {
    if (!selectedTag) return displayNodes;
    return displayNodes.map((n) => {
      if (n.hidden) return n;
      const tags = (n.data as { tags?: string[] }).tags ?? [];
      return {
        ...n,
        data: { ...(n.data as object), dimmed: !tags.includes(selectedTag) },
      };
    });
  }, [displayNodes, selectedTag]);

  // Ghost edges: cross-position edges become faint + dashed
  const filteredDisplayEdges = useMemo(() => {
    if (!selectedTag) return displayEdges;
    const matchingIds = new Set(
      filteredDisplayNodes
        .filter((n) => !n.hidden && !(n.data as { dimmed?: boolean }).dimmed)
        .map((n) => n.id)
    );
    return displayEdges.map((e) => {
      if (e.hidden) return e;
      const isCross = !matchingIds.has(e.source) || !matchingIds.has(e.target);
      return isCross
        ? { ...e, style: { ...(e.style ?? {}), opacity: 0.2, strokeDasharray: "4 4" } }
        : e;
    });
  }, [displayEdges, filteredDisplayNodes, selectedTag]);

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

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_, edge: Edge) => {
      const notes = (edge.data as { notes?: string })?.notes ?? "";
      setEdgeNotes({ id: edge.id, notes });
    },
    []
  );

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
      <SkillMapEmpty
        isMobile={isMobile}
        isPro={isPro}
        nodeCount={rfNodes.length}
        showProModal={showProModal}
        onShowProModal={() => setShowProModal(true)}
        onCloseProModal={() => setShowProModal(false)}
        onAddNode={handleAddNode}
        stripePaymentLink={stripePaymentLink}
        stripeAnnualLink={stripeAnnualLink}
        t={t}
      />
    );
  }

  // ── Derived values for toolbar ────────────────────────────────────────────
  const lastNode = rfNodes[rfNodes.length - 1];
  const lastNodePosition = lastNode ? { x: lastNode.position.x, y: lastNode.position.y } : null;

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

      {/* T-29: Position filter chips */}
      <PositionFilterChips
        usedTags={usedTags}
        customTags={customTags}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        tagsExpanded={tagsExpanded}
        setTagsExpanded={setTagsExpanded}
        visibleTagCount={VISIBLE_TAG_COUNT}
        t={t}
      />

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
      <SkillMapToolbar
        isMobile={isMobile}
        editMode={editMode}
        setEditMode={setEditMode}
        connectingFrom={connectingFrom}
        isOrganizing={isOrganizing}
        isOnline={isOnline}
        isFullscreen={isFullscreen}
        isPro={isPro}
        nodeCount={rfNodes.length}
        lastNodePosition={lastNodePosition}
        onMagicOrganize={handleMagicOrganize}
        onShowProModal={() => setShowProModal(true)}
        onAddPopup={setAddPopup}
        t={t}
      />

      {/* React Flow canvas
          touch-action:none on the wrapper prevents iOS Safari from intercepting
          pointer events for page scroll / native pinch-zoom, letting ReactFlow
          handle all touch gestures (pan + pinch-zoom) without interference.    */}
      <div className="relative">
      <div
        className="w-full rounded-xl overflow-hidden border border-white/10"
        style={{ height: "clamp(350px, 60vh, 620px)", touchAction: "none" }}
      >
        <ReactFlow
          nodes={filteredDisplayNodes}
          edges={filteredDisplayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onEdgesDelete={onEdgesDelete}
          onNodesDelete={onNodesDelete}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
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

      {/* I-19: FAB — floating "+" button on canvas (mobile + editMode only) */}
      {isMobile && editMode && (
        <button
          disabled={!isOnline}
          onClick={() => {
            if (!isPro && rfNodes.length >= 10) { setShowProModal(true); return; }
            const x = lastNodePosition ? lastNodePosition.x + 200 : 100;
            const y = lastNodePosition ? lastNodePosition.y : 100;
            setAddPopup({ screenX: 0, screenY: 0, flowX: x, flowY: y });
          }}
          aria-label={t("skillmap.addNodeMobile")}
          className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-50 text-white text-2xl font-bold shadow-lg shadow-emerald-900/40 flex items-center justify-center transition-all active:scale-90 z-10"
        >
          +
        </button>
      )}
      </div>{/* end relative canvas wrapper */}

      {/* T-29: Edge notes panel */}
      {edgeNotes && (
        <EdgeNotesPanel
          edgeId={edgeNotes.id}
          notes={edgeNotes.notes}
          onChange={(notes) => setEdgeNotes((prev) => prev ? { ...prev, notes } : null)}
          onSave={() => {
            handleUpdateEdgeNotes(edgeNotes.id, edgeNotes.notes);
            setEdgeNotes(null);
          }}
          onClose={() => setEdgeNotes(null)}
          t={t}
        />
      )}

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
          onEditTags={(tags) => handleUpdateNodeTags(drawerNode.id, tags)}
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
