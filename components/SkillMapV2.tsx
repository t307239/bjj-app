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
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useLocale } from "@/lib/i18n";
import { masteryNodeClass, masterySelectedRing, NODE_W, NODE_H } from "@/lib/skillMapUtils";
import { useSkillMap } from "@/hooks/useSkillMap";
import Toast from "./Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  userId: string;
  isPro: boolean;
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
};

// ─── Stable delete ref (avoids stale-closure in custom node data) ─────────────

const _deleteNodeRef = { current: (_id: string) => {} };

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
        selected ? masterySelectedRing(mastery) : "hover:brightness-110"
      }`}
      style={{ width: NODE_W, minHeight: NODE_H }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ width: 12, height: 12, background: "#3f3f46", border: "2px solid #6366f1", borderRadius: "50%", top: -6 }}
      />
      <span className="block text-xs font-medium break-words whitespace-pre-wrap leading-snug pr-4">
        {data.label}
      </span>
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
  const { screenToFlowPosition } = useReactFlow();

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

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [drawerNode, setDrawerNode] = useState<Node | null>(null);
  const [addPopup, setAddPopup] = useState<{ screenX: number; screenY: number; flowX: number; flowY: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [emptyAddName, setEmptyAddName] = useState("");
  const emptyRef = useRef<HTMLInputElement>(null);
  const mobileAddRef = useRef<HTMLInputElement>(null);

  // Keep module-level ref up-to-date (used by TechniqueNodeComp to avoid stale closure)
  useEffect(() => { _deleteNodeRef.current = handleDeleteNode; }, [handleDeleteNode]);

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
    },
    [isMobile, editMode, connectingFrom, handleMobileConnect]
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
