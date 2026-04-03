"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import Toast from "./Toast";
import TechniqueLogForm from "./TechniqueLogForm";
import TechniqueLogList from "./TechniqueLogList";
import {
  type Technique,
  type TechniqueFormState,
  isDangerousTechnique,
} from "@/lib/techniqueLogTypes";
import { trackEvent } from "@/lib/analytics";

type Props = {
  userId: string;
  isPro?: boolean;
  userBelt?: string;
};

const PAGE_SIZE = 3;
const TECHNIQUE_FREE_LIMIT = 20;

export default function TechniqueLog({ userId, isPro = false, userBelt = "white" }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // ── State ──────────────────────────────────────────────────────────────────
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkCategory, setBulkCategory] = useState("guard");
  const [bulkMastery, setBulkMastery] = useState(1);
  // persist search query and page in URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "mastery_desc" | "mastery_asc" | "name">("newest");
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get("page") ?? "1", 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dangerConfirmPending, setDangerConfirmPending] = useState(false);
  const [form, setForm] = useState<TechniqueFormState>({
    name: "",
    category: "guard",
    mastery_level: 1,
    notes: "",
  });
  const [editForm, setEditForm] = useState<TechniqueFormState>({
    name: "",
    category: "guard",
    mastery_level: 1,
    notes: "",
  });

  // Stable supabase client ref — prevents useEffect dep churn
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // ── URL param helpers ──────────────────────────────────────────────────────
  const updateUrlParams = (q: string, p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    router.replace(`${pathname}${qs ? "?" + qs : ""}`, { scroll: false });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    updateUrlParams(value, 1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrlParams(searchQuery, newPage);
  };

  // ── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    const loadTechniques = async () => {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from("techniques")
        .select("id, name, category, mastery_level, notes, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (!error && data) setTechniques(data);
      setInitialLoading(false);
    };
    loadTechniques();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const isBeginner = userBelt === "white" || userBelt === "blue";

  /** Core insert logic — optimistic UI: add immediately, reconcile with server */
  const doInsert = async () => {
    const trimmedName = form.name.trim();
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Technique = {
      id: optimisticId,
      name: trimmedName,
      category: form.category,
      mastery_level: form.mastery_level,
      notes: form.notes,
      created_at: new Date().toISOString(),
    };

    // Optimistic: add to state immediately
    setTechniques((prev) => [optimistic, ...prev]);
    setForm({ name: "", category: "guard", mastery_level: 1, notes: "" });
    setShowForm(false);
    setDangerConfirmPending(false);
    setLoading(true);

    const { data, error } = await supabase
      .from("techniques")
      .insert([{ ...form, name: trimmedName, user_id: userId }])
      .select()
      .single();
    if (!error && data) {
      // Replace optimistic entry with real server data
      setTechniques((prev) => prev.map((t) => (t.id === optimisticId ? data : t)));
      trackEvent("technique_added", { category: form.category });
      setToast({ message: t("techniques.addedSingle"), type: "success" });
      navigator.vibrate?.([50]);
    } else {
      // Rollback: remove optimistic entry
      setTechniques((prev) => prev.filter((t) => t.id !== optimisticId));
      setToast({ message: t("techniques.saveFailed"), type: "error" });
      navigator.vibrate?.([30, 20, 30]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError(t("techniques.nameRequired")); return; }
    if (form.name.trim().length > 100) { setFormError(t("techniques.nameTooLong")); return; }
    const nameNorm = form.name.trim().toLowerCase();
    const duplicate = techniques.find((t) => t.name.trim().toLowerCase() === nameNorm);
    if (duplicate) { setFormError(t("techniques.duplicate", { name: duplicate.name })); return; }
    if (!isPro && techniques.length >= TECHNIQUE_FREE_LIMIT) {
      setFormError(`Free plan limit: ${TECHNIQUE_FREE_LIMIT} techniques. Upgrade to Pro for unlimited.`);
      return;
    }
    // Belt-based safety gate: show confirmation for dangerous techniques
    if (isBeginner && isDangerousTechnique(form.name.trim()) && !dangerConfirmPending) {
      setDangerConfirmPending(true);
      return;
    }
    setDangerConfirmPending(false);
    await doInsert();
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const names = bulkText.split("\n").map((n) => n.trim()).filter((n) => n.length > 0);
    if (names.length === 0) { setFormError(t("techniques.nameRequired")); return; }
    if (names.length > 100) { setFormError(t("techniques.bulkTooMany")); return; }
    const existing = new Set(techniques.map((t) => t.name.trim().toLowerCase()));
    const newNames = names.filter((n) => !existing.has(n.toLowerCase()));
    if (newNames.length === 0) { setFormError(t("techniques.allDuplicates")); return; }
    const remaining = isPro ? Infinity : Math.max(0, TECHNIQUE_FREE_LIMIT - techniques.length);
    if (!isPro && remaining === 0) {
      setFormError(`Free plan limit: ${TECHNIQUE_FREE_LIMIT} techniques. Upgrade to Pro for unlimited.`);
      return;
    }
    const allowedNames = remaining === Infinity ? newNames : newNames.slice(0, remaining);
    setLoading(true);
    const rows = allowedNames.map((name) => ({
      name,
      category: bulkCategory,
      mastery_level: bulkMastery,
      notes: "",
      user_id: userId,
    }));
    const { data, error } = await supabase
      .from("techniques")
      .insert(rows)
      .select()
      .order("created_at", { ascending: false });
    if (!error && data) {
      setTechniques([...data, ...techniques]);
      setBulkText("");
      setBulkMode(false);
      setShowForm(false);
      setToast({ message: t("techniques.addedBulk", { n: data.length }), type: "success" });
      navigator.vibrate?.([50]);
    } else {
      setToast({ message: t("techniques.saveFailed"), type: "error" });
      navigator.vibrate?.([30, 20, 30]);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    // Optimistic: remove from state immediately
    const snapshot = techniques;
    setTechniques((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(id);

    const { error } = await supabase
      .from("techniques")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) {
      setToast({ message: t("techniques.deleted"), type: "success" });
      navigator.vibrate?.([30, 20, 30]);
    } else {
      // Rollback on error
      setTechniques(snapshot);
      setToast({ message: t("techniques.deleteFailed"), type: "error" });
      navigator.vibrate?.([50, 100, 50]);
    }
    setDeletingId(null);
  };

  const startEdit = (tech: Technique) => {
    setEditingId(tech.id);
    setEditForm({ name: tech.name, category: tech.category, mastery_level: tech.mastery_level, notes: tech.notes });
  };

  const handleUpdate = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (updating) return;
    setUpdating(true);

    // Optimistic: apply edit immediately
    const snapshot = techniques;
    setTechniques((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...editForm } : t)),
    );
    setEditingId(null);

    const { data, error } = await supabase
      .from("techniques")
      .update(editForm)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (!error && data) {
      setTechniques((prev) => prev.map((t) => (t.id === id ? data : t)));
      setToast({ message: t("techniques.updated"), type: "success" });
      navigator.vibrate?.([50]);
    } else {
      // Rollback on error
      setTechniques(snapshot);
      setToast({ message: t("techniques.updateFailed"), type: "error" });
      navigator.vibrate?.([50, 100, 50]);
    }
    setUpdating(false);
  };

  const handleQuickMastery = async (id: string, newLevel: number) => {
    // Optimistic: update mastery immediately
    const snapshot = techniques;
    setTechniques((prev) =>
      prev.map((t) => (t.id === id ? { ...t, mastery_level: newLevel } : t)),
    );
    navigator.vibrate?.([30]);

    const { data, error } = await supabase
      .from("techniques")
      .update({ mastery_level: newLevel })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (!error && data) {
      setTechniques((prev) => prev.map((t) => (t.id === id ? data : t)));
    } else {
      // Rollback
      setTechniques(snapshot);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const filtered = techniques
    .filter((t) => filterCategory === "all" || t.category === filterCategory)
    .filter((t) =>
      searchQuery === "" ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase())),
    )
    .slice()
    .sort((a, b) => {
      if (sortBy === "mastery_desc") return (b.mastery_level ?? 0) - (a.mastery_level ?? 0);
      if (sortBy === "mastery_asc") return (a.mastery_level ?? 0) - (b.mastery_level ?? 0);
      if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Free plan usage meter */}
      {!isPro && !initialLoading && (
        <div className={`mb-3 px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3 ${
          techniques.length >= TECHNIQUE_FREE_LIMIT
            ? "bg-red-500/10 border-red-500/30"
            : "bg-zinc-800/60 border-white/8"
        }`}>
          <span className={`text-xs ${techniques.length >= TECHNIQUE_FREE_LIMIT ? "text-red-300" : "text-zinc-400"}`}>
            {techniques.length >= TECHNIQUE_FREE_LIMIT
              ? `🔒 Free limit reached — ${TECHNIQUE_FREE_LIMIT}/${TECHNIQUE_FREE_LIMIT} techniques`
              : `📝 ${techniques.length}/${TECHNIQUE_FREE_LIMIT} techniques (free plan)`}
          </span>
          {techniques.length >= Math.floor(TECHNIQUE_FREE_LIMIT * 0.75) && (
            <span className="text-xs font-medium text-blue-400 whitespace-nowrap">Upgrade for unlimited →</span>
          )}
        </div>
      )}

      <TechniqueLogForm
        showForm={showForm}
        bulkMode={bulkMode}
        form={form}
        setForm={setForm}
        bulkText={bulkText}
        setBulkText={setBulkText}
        bulkCategory={bulkCategory}
        setBulkCategory={setBulkCategory}
        bulkMastery={bulkMastery}
        setBulkMastery={setBulkMastery}
        loading={loading}
        formError={formError}
        onSubmit={handleSubmit}
        onBulkSubmit={handleBulkSubmit}
        onClose={() => { setShowForm(false); setFormError(null); setDangerConfirmPending(false); }}
        onCloseBulk={() => { setShowForm(false); setBulkMode(false); setFormError(null); setBulkText(""); }}
      />

      {/* Danger technique confirmation modal for white/blue belts */}
      {dangerConfirmPending && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl mt-0.5 flex-shrink-0">⚠️</span>
              <p className="text-sm text-amber-200 leading-relaxed">
                {t("techniques.dangerConfirm")}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => { await doInsert(); }}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold transition-colors active:scale-95"
              >
                {loading ? "..." : t("techniques.add")}
              </button>
              <button
                type="button"
                onClick={() => setDangerConfirmPending(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-bold transition-colors active:scale-95"
              >
                {t("training.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      <TechniqueLogList
        techniques={techniques}
        initialLoading={initialLoading}
        filtered={filtered}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        filterCategory={filterCategory}
        setFilterCategory={(v) => { setFilterCategory(v); setPage(1); updateUrlParams(searchQuery, 1); }}
        sortBy={sortBy}
        setSortBy={(v) => { setSortBy(v); setPage(1); updateUrlParams(searchQuery, 1); }}
        page={safePage}
        pageSize={PAGE_SIZE}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        editingId={editingId}
        editForm={editForm}
        setEditForm={setEditForm}
        deletingId={deletingId}
        expandedIds={expandedIds}
        setExpandedIds={setExpandedIds}
        onStartEdit={startEdit}
        onCancelEdit={() => setEditingId(null)}
        onUpdate={handleUpdate}
        updating={updating}
        onDelete={handleDelete}
        onQuickMastery={handleQuickMastery}
        onShowForm={(bulk = false) => {
          setBulkMode(bulk);
          setShowForm(!showForm || bulk !== bulkMode);
          setFormError(null);
        }}
        userBelt={userBelt}
      />
    </div>
  );
}
