"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import Toast from "./Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type TechniqueNode = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  mastery_level?: number; // 0=Locked, 1=Learning, 2=Mastered (added via migration)
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
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
};

type ViewMode = "roots" | "all";
type Screen = { nodeId: string; nodeName: string };

// ─── DAG cycle detection (DFS) ───────────────────────────────────────────────

/**
 * Returns true if adding edge source → target would create a cycle.
 * edges: existing edge list for this user.
 */
function wouldCreateCycle(
  edges: TechniqueEdge[],
  sourceId: string,
  targetId: string
): boolean {
  // Build adjacency map
  const adj: Map<string, string[]> = new Map();
  for (const e of edges) {
    if (!adj.has(e.source_id)) adj.set(e.source_id, []);
    adj.get(e.source_id)!.push(e.target_id);
  }
  // Tentatively add the new edge
  if (!adj.has(sourceId)) adj.set(sourceId, []);
  adj.get(sourceId)!.push(targetId);

  // DFS from targetId — if we can reach sourceId, it's a cycle
  const visited = new Set<string>();
  const stack = [targetId];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === sourceId) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const neighbors = adj.get(node) ?? [];
    for (const n of neighbors) stack.push(n);
  }
  return false;
}

// ─── Pro Upsell Modal ────────────────────────────────────────────────────────

function ProModal({
  onClose,
  stripePaymentLink,
  stripeAnnualLink,
  t,
}: {
  onClose: () => void;
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
  t: (key: string) => string;
}) {
  const [isAnnual, setIsAnnual] = useState(false);
  const paymentUrl = isAnnual ? stripeAnnualLink : stripePaymentLink;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm text-center">
        <div className="text-3xl mb-3">🥋</div>
        <h3 className="text-lg font-bold text-white mb-2">{t("skillmap.proModalTitle")}</h3>
        <p className="text-sm text-gray-400 mb-4">{t("skillmap.proModalBody")}</p>

        {/* Monthly / Annual toggle */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className={`text-xs ${!isAnnual ? "text-white font-semibold" : "text-gray-500"}`}>Monthly</span>
          <button
            onClick={() => setIsAnnual((v) => !v)}
            aria-label="Toggle billing period"
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              isAnnual ? "bg-emerald-600" : "bg-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                isAnnual ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-xs ${isAnnual ? "text-white font-semibold" : "text-gray-500"}`}>Annual</span>
          {isAnnual && (
            <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Save 16%
            </span>
          )}
        </div>

        {/* Price display */}
        <div className="mb-4">
          {isAnnual ? (
            <p className="text-white font-bold text-sm">$49.99 / year <span className="text-emerald-400 text-xs">≈ $4.17/mo</span></p>
          ) : (
            <p className="text-white font-bold text-sm">$4.99 / month</p>
          )}
        </div>

        {paymentUrl ? (
          <a
            href={paymentUrl}
            className="block w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-semibold py-3 rounded-xl mb-3 transition-all"
            aria-label={t("skillmap.upgradeAriaLabel")}
          >
            {t("skillmap.upgradeBtn")}
          </a>
        ) : (
          <span
            className="block w-full bg-zinc-700 text-gray-500 font-semibold py-3 rounded-xl mb-3 cursor-not-allowed"
            aria-disabled="true"
          >
            {t("skillmap.upgradeBtn")}
          </span>
        )}
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors min-h-[44px] px-6 py-2"
          aria-label={t("skillmap.maybeLater")}
        >
          {t("skillmap.maybeLater")}
        </button>
      </div>
    </div>
  );
}

// ─── Add Node Modal ───────────────────────────────────────────────────────────

function AddNodeModal({
  onAdd,
  onClose,
  t,
}: {
  onAdd: (name: string, description: string) => Promise<void>;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    await onAdd(trimmed, description.trim());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm">
        <h3 className="text-base font-bold text-white mb-4">{t("skillmap.addTechniqueTitle")}</h3>
        <input
          type="text"
          placeholder={t("skillmap.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 mb-3 focus:outline-none focus:border-white/30"
          autoFocus
          maxLength={80}
          aria-label={t("skillmap.namePlaceholder")}
        />
        <textarea
          placeholder={t("skillmap.descPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 mb-4 resize-none focus:outline-none focus:border-white/30"
          maxLength={200}
          aria-label={t("skillmap.descPlaceholder")}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-xl text-sm transition-colors"
            aria-label={t("common.cancel")}
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition-colors"
            aria-label={t("skillmap.addBtn")}
          >
            {saving ? "..." : t("skillmap.addBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Connect Edge Modal ───────────────────────────────────────────────────────

function ConnectEdgeModal({
  nodes,
  sourceNode,
  onConnect,
  onClose,
  t,
}: {
  nodes: TechniqueNode[];
  sourceNode: TechniqueNode;
  onConnect: (targetId: string, label: string) => Promise<void>;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [targetId, setTargetId] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter out the source node itself
  const options = nodes.filter((n) => n.id !== sourceNode.id);

  const handleSubmit = async () => {
    if (!targetId) return;
    setSaving(true);
    await onConnect(targetId, label.trim());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm">
        <h3 className="text-base font-bold text-white mb-1">{t("skillmap.connectTitle")}</h3>
        <p className="text-xs text-gray-500 mb-4">
          {t("skillmap.connectFrom")}: <span className="text-gray-300">{sourceNode.name}</span>
        </p>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-white/30"
          aria-label={t("skillmap.connectTarget")}
        >
          <option value="">{t("skillmap.selectTarget")}</option>
          {options.map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t("skillmap.edgeLabelPlaceholder")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 mb-4 focus:outline-none focus:border-white/30"
          maxLength={50}
          aria-label={t("skillmap.edgeLabelPlaceholder")}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-xl text-sm transition-colors"
            aria-label={t("common.cancel")}
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !targetId}
            className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition-colors"
            aria-label={t("skillmap.connectBtn")}
          >
            {saving ? "..." : t("skillmap.connectBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mastery level helpers ────────────────────────────────────────────────────

function masteryDotClass(level: number | undefined): string {
  if (level === 2) return "bg-emerald-400";
  if (level === 1) return "bg-blue-400";
  return "bg-zinc-500"; // 0 or undefined = Locked
}

function MasteryLegend() {
  return (
    <div className="flex items-center gap-3 mb-3 px-1">
      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span className="w-2 h-2 rounded-full bg-zinc-500 inline-block" /> Locked
      </span>
      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Learning
      </span>
      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Mastered
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SkillMapMobile({ userId, isPro, stripePaymentLink, stripeAnnualLink }: Props) {
  const { t } = useLocale();
  // Stable supabase client ref — createBrowserClient creates a new instance per call,
  // so we memoize via useRef to avoid stale deps in useCallback.
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [nodes, setNodes] = useState<TechniqueNode[]>([]);
  const [edges, setEdges] = useState<TechniqueEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("roots");
  const [navStack, setNavStack] = useState<Screen[]>([]); // breadcrumb stack
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmDeleteNodeId, setConfirmDeleteNodeId] = useState<string | null>(null);

  // Modals
  const [showAddNode, setShowAddNode] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<TechniqueNode | null>(null);
  const [showAddSubTechnique, setShowAddSubTechnique] = useState(false); // add sub-node from drill-down

  // Load data
  const loadData = useCallback(async () => {
    const [nodesRes, edgesRes] = await Promise.all([
      supabase
        .from("technique_nodes")
        .select("id, user_id, name, description, pos_x, pos_y, mastery_level, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("technique_edges")
        .select("id, source_id, target_id, label")
        .eq("user_id", userId),
    ]);
    if (!nodesRes.error) setNodes(nodesRes.data ?? []);
    if (!edgesRes.error) setEdges(edgesRes.data ?? []);
    setLoading(false);
  }, [userId]); // supabase is stable via useRef

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Computed: roots = In-degree 0 nodes ──────────────────────────────────
  const targetIds = new Set(edges.map((e) => e.target_id));
  const rootNodes = nodes.filter((n) => !targetIds.has(n.id));

  // ── Current screen node ───────────────────────────────────────────────────
  const currentScreen = navStack[navStack.length - 1] ?? null;
  const currentNode = currentScreen
    ? nodes.find((n) => n.id === currentScreen.nodeId) ?? null
    : null;

  // ── Children of current node ───────────────────────────────────────────────
  const childEdges = currentNode
    ? edges.filter((e) => e.source_id === currentNode.id)
    : [];
  const childNodes = childEdges
    .map((e) => ({ edge: e, node: nodes.find((n) => n.id === e.target_id) }))
    .filter((x): x is { edge: TechniqueEdge; node: TechniqueNode } => !!x.node);

  // ── Navigate into a node ──────────────────────────────────────────────────
  const navigateTo = (node: TechniqueNode) => {
    setNavStack((prev) => [...prev, { nodeId: node.id, nodeName: node.name }]);
  };

  // ── Navigate back ─────────────────────────────────────────────────────────
  const navigateBack = () => {
    setNavStack((prev) => prev.slice(0, -1));
  };

  // ── Add root node ─────────────────────────────────────────────────────────
  const handleAddNode = async (name: string, description: string) => {
    if (!isPro && nodes.length >= 10) {
      setShowProModal(true);
      setShowAddNode(false);
      return;
    }
    const { data, error } = await supabase
      .from("technique_nodes")
      .insert({
        user_id: userId,
        name,
        description: description || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      showToast(t("skillmap.addNodeError"), "error");
      setShowAddNode(false);
      return;
    }
    setNodes((prev) => [...prev, data]);
    setShowAddNode(false);
    showToast(t("skillmap.addNodeSuccess"), "success");
  };

  // ── Add sub-technique (child of current node) ─────────────────────────────
  const handleAddSubTechnique = async (name: string, description: string) => {
    if (!currentNode) return;
    if (!isPro && nodes.length >= 10) {
      setShowProModal(true);
      setShowAddSubTechnique(false);
      return;
    }
    // 1. Insert new node
    const { data: newNode, error: nodeError } = await supabase
      .from("technique_nodes")
      .insert({
        user_id: userId,
        name,
        description: description || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (nodeError) {
      showToast(t("skillmap.addNodeError"), "error");
      setShowAddSubTechnique(false);
      return;
    }
    // 2. Insert edge currentNode → newNode
    const { data: newEdge, error: edgeError } = await supabase
      .from("technique_edges")
      .insert({
        user_id: userId,
        source_id: currentNode.id,
        target_id: newNode.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (edgeError) {
      // Edge failed — node was created as orphan (still accessible via All tab)
      showToast(t("skillmap.addEdgeError"), "error");
    } else {
      setEdges((prev) => [...prev, newEdge]);
    }
    setNodes((prev) => [...prev, newNode]);
    setShowAddSubTechnique(false);
    showToast(t("skillmap.addNodeSuccess"), "success");
  };

  // ── Connect existing node ─────────────────────────────────────────────────
  const handleConnectEdge = async (targetId: string, label: string) => {
    if (!connectingFrom) return;
    if (!isPro && edges.length >= 15) {
      setShowProModal(true);
      setConnectingFrom(null);
      return;
    }
    // DAG cycle check (client-side)
    if (wouldCreateCycle(edges, connectingFrom.id, targetId)) {
      showToast(t("skillmap.cycleError"), "error");
      setConnectingFrom(null);
      return;
    }
    const { data, error } = await supabase
      .from("technique_edges")
      .insert({
        user_id: userId,
        source_id: connectingFrom.id,
        target_id: targetId,
        label: label || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      showToast(t("skillmap.addEdgeError"), "error");
      setConnectingFrom(null);
      return;
    }
    setEdges((prev) => [...prev, data]);
    setConnectingFrom(null);
    showToast(t("skillmap.connectSuccess"), "success");
  };

  // ── Delete edge (Pro only) ────────────────────────────────────────────────
  const handleDeleteEdge = async (edgeId: string) => {
    if (!isPro) { setShowProModal(true); return; }
    const removed = edges.find((e) => e.id === edgeId);
    setEdges((prev) => prev.filter((e) => e.id !== edgeId)); // optimistic
    const { error } = await supabase.from("technique_edges").delete().eq("id", edgeId);
    if (error) {
      if (removed) setEdges((prev) => [...prev, removed]);
      showToast(t("skillmap.deleteError"), "error");
    }
  };

  // ── Delete node (Pro only) ────────────────────────────────────────────────
  const handleDeleteNode = async (nodeId: string) => {
    if (!isPro) { setShowProModal(true); return; }
    const removed = nodes.find((n) => n.id === nodeId);
    const removedEdges = edges.filter((e) => e.source_id === nodeId || e.target_id === nodeId);
    setNodes((prev) => prev.filter((n) => n.id !== nodeId)); // optimistic
    setEdges((prev) => prev.filter((e) => e.source_id !== nodeId && e.target_id !== nodeId));
    const { error } = await supabase.from("technique_nodes").delete().eq("id", nodeId);
    if (error) {
      if (removed) setNodes((prev) => [...prev, removed]);
      setEdges((prev) => [...prev, ...removedEdges]);
      showToast(t("skillmap.deleteError"), "error");
    } else {
      // If we just deleted the current screen's node, go back
      if (currentNode?.id === nodeId) navigateBack();
      showToast(t("skillmap.deleteSuccess"), "success");
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        {t("common.loading")}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="text-5xl mb-4">🗺️</div>
        <p className="text-gray-300 font-medium mb-1">{t("skillmap.emptyTitle")}</p>
        <p className="text-gray-500 text-sm mb-6">{t("skillmap.emptyBody")}</p>
        <button
          onClick={() => setShowAddNode(true)}
          className="bg-[#10B981] hover:bg-[#0d9668] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          aria-label={t("skillmap.addFirstTechnique")}
        >
          + {t("skillmap.addFirstTechnique")}
        </button>
        {showAddNode && (
          <AddNodeModal onAdd={handleAddNode} onClose={() => setShowAddNode(false)} t={t} />
        )}
        {showProModal && (
          <ProModal onClose={() => setShowProModal(false)} stripePaymentLink={stripePaymentLink} stripeAnnualLink={stripeAnnualLink} t={t} />
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL-DOWN VIEW: inside a node
  // ─────────────────────────────────────────────────────────────────────────
  if (currentNode) {
    return (
      <div className="pb-4">
        {/* Breadcrumb + back */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={navigateBack}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            aria-label={t("common.back")}
          >
            ← {navStack.length === 1 ? t("skillmap.rootList") : navStack[navStack.length - 2].nodeName}
          </button>
        </div>

        {/* Current node card */}
        <div className="bg-zinc-800 border border-white/10 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span
                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${masteryDotClass(currentNode.mastery_level)}`}
                aria-hidden="true"
              />
              <div>
                <h3 className="text-base font-bold text-white">{currentNode.name}</h3>
                {currentNode.description && (
                  <p className="text-xs text-gray-400 mt-1">{currentNode.description}</p>
                )}
              </div>
            </div>
            {isPro && confirmDeleteNodeId === currentNode.id ? (
              <span className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                <button
                  onClick={() => { setConfirmDeleteNodeId(null); handleDeleteNode(currentNode.id); }}
                  className="text-xs font-semibold text-white bg-red-600 hover:bg-red-500 px-2 py-0.5 rounded transition-colors"
                >{t("common.delete")}</button>
                <button
                  onClick={() => setConfirmDeleteNodeId(null)}
                  className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                >{t("common.cancel")}</button>
              </span>
            ) : isPro && (
              <button
                onClick={() => setConfirmDeleteNodeId(currentNode.id)}
                className="text-xs text-red-400 hover:text-red-300 flex-shrink-0 mt-0.5"
                aria-label={t("skillmap.deleteNode")}
              >
                {t("skillmap.deleteNode")}
              </button>
            )}
          </div>
          {/* Connect to existing technique */}
          <button
            onClick={() => setConnectingFrom(currentNode)}
            className="mt-3 text-xs text-[#10B981] hover:text-[#0d9668] transition-colors"
            aria-label={t("skillmap.connectExisting")}
          >
            + {t("skillmap.connectExisting")}
          </button>
        </div>

        {/* Connected techniques */}
        <p className="text-xs text-gray-500 tracking-wider mb-2 px-1">
          {t("skillmap.leadsTo")} ({childNodes.length})
        </p>

        {childNodes.length === 0 ? (
          <p className="text-sm text-gray-500 italic px-1 mb-4">{t("skillmap.noChildren")}</p>
        ) : (
          <div className="space-y-2 mb-4">
            {childNodes.map(({ edge, node }) => (
              <div
                key={edge.id}
                className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3"
              >
                <button
                  onClick={() => navigateTo(node)}
                  className="flex-1 text-left"
                  aria-label={`${t("skillmap.openNode")}: ${node.name}`}
                >
                  <span className="text-sm text-white font-medium">{node.name}</span>
                  {edge.label && (
                    <span className="ml-2 text-xs text-gray-500">({edge.label})</span>
                  )}
                </button>
                {/* Delete edge (Pro only) */}
                {isPro && (
                  <button
                    onClick={() => handleDeleteEdge(edge.id)}
                    className="text-xs text-zinc-400 hover:text-red-400 transition-colors flex-shrink-0"
                    aria-label={t("skillmap.deleteEdge")}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add sub-technique button */}
        {!isPro && nodes.length >= 10 ? (
          <button
            onClick={() => setShowProModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 border border-white/10 text-gray-400 py-3 rounded-xl text-sm transition-colors"
            aria-label={t("skillmap.proLockBtn")}
          >
            🔒 {t("skillmap.proLockBtn")}
          </button>
        ) : (
          <button
            onClick={() => setShowAddSubTechnique(true)}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-gray-300 py-3 rounded-xl text-sm transition-colors"
            aria-label={t("skillmap.addSubTechnique")}
          >
            + {t("skillmap.addSubTechnique")}
          </button>
        )}

        {/* Modals */}
        {showAddSubTechnique && (
          <AddNodeModal
            onAdd={handleAddSubTechnique}
            onClose={() => setShowAddSubTechnique(false)}
            t={t}
          />
        )}
        {connectingFrom && (
          <ConnectEdgeModal
            nodes={nodes}
            sourceNode={connectingFrom}
            onConnect={handleConnectEdge}
            onClose={() => setConnectingFrom(null)}
            t={t}
          />
        )}
        {showProModal && (
          <ProModal onClose={() => setShowProModal(false)} stripePaymentLink={stripePaymentLink} stripeAnnualLink={stripeAnnualLink} t={t} />
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ROOT LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const displayNodes = viewMode === "roots" ? rootNodes : nodes;

  return (
    <div className="pb-4">
      {/* Mastery legend */}
      <MasteryLegend />

      {/* Tab switcher: Roots | All */}
      <div className="flex bg-zinc-800 rounded-xl p-1 mb-4">
        <button
          onClick={() => setViewMode("roots")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === "roots"
              ? "bg-zinc-700 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
          aria-label={t("skillmap.tabRoots")}
        >
          {t("skillmap.tabRoots")} ({rootNodes.length})
        </button>
        <button
          onClick={() => setViewMode("all")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === "all"
              ? "bg-zinc-700 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
          aria-label={t("skillmap.tabAll")}
        >
          {t("skillmap.tabAll")} ({nodes.length})
        </button>
      </div>

      {/* Node list */}
      {displayNodes.length === 0 ? (
        <p className="text-sm text-gray-500 italic text-center py-6">{t("skillmap.noRoots")}</p>
      ) : (
        <div className="space-y-2 mb-4">
          {displayNodes.map((node) => {
            const childCount = edges.filter((e) => e.source_id === node.id).length;
            return (
              <button
                key={node.id}
                onClick={() => navigateTo(node)}
                className="w-full flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-left transition-colors"
                aria-label={`${t("skillmap.openNode")}: ${node.name}`}
              >
                {/* Mastery dot */}
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${masteryDotClass(node.mastery_level)}`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-white block truncate">{node.name}</span>
                  {node.description && (
                    <span className="text-xs text-gray-500 block truncate mt-0.5">{node.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {childCount > 0 && (
                    <span className="text-xs text-gray-500">→ {childCount}</span>
                  )}
                  <span className="text-gray-500 text-sm">›</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Add root technique / Pro lock */}
      {!isPro && nodes.length >= 10 ? (
        <button
          onClick={() => setShowProModal(true)}
          className="w-full flex items-center justify-center gap-2 bg-zinc-800 border border-white/10 text-gray-400 py-3 rounded-xl text-sm transition-colors"
          aria-label={t("skillmap.proLockBtn")}
        >
          🔒 {t("skillmap.proLockBtn")}
        </button>
      ) : (
        <button
          onClick={() => setShowAddNode(true)}
          className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-gray-300 py-3 rounded-xl text-sm transition-colors"
          aria-label={t("skillmap.addTechniqueTitle")}
        >
          + {t("skillmap.addTechniqueTitle")}
        </button>
      )}

      {/* Modals */}
      {showAddNode && (
        <AddNodeModal onAdd={handleAddNode} onClose={() => setShowAddNode(false)} t={t} />
      )}
      {showProModal && (
        <ProModal onClose={() => setShowProModal(false)} stripePaymentLink={stripePaymentLink} stripeAnnualLink={stripeAnnualLink} t={t} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
