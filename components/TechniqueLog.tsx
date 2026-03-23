"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import Toast from "./Toast";
import TechniqueLogForm from "./TechniqueLogForm";
import TechniqueLogList from "./TechniqueLogList";
import {
  type Technique,
  type TechniqueFormState,
} from "@/lib/techniqueLogTypes";

type Props = {
  userId: string;
};

const TECH_PAGE_SIZE = 10;

export default function TechniqueLog({ userId }: Props) {
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
  // #161: persist search query and pagination in URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "mastery_desc" | "mastery_asc" | "name">("newest");
  const [showCount, setShowCount] = useState(() => {
    const s = parseInt(searchParams.get("show") ?? "3", 10);
    return isNaN(s) || s < 3 ? 3 : s;
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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

  const supabase = createClient();

  // ── URL param helpers (#161) ───────────────────────────────────────────────
  const updateUrlParams = (q: string, show: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (show > 3) params.set("show", String(show));
    const qs = params.toString();
    router.replace(`${pathname}${qs ? "?" + qs : ""}`, { scroll: false });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowCount(3);
    updateUrlParams(value, 3);
  };

  const handleLoadMore = () => {
    const next = showCount + TECH_PAGE_SIZE;
    setShowCount(next);
    updateUrlParams(searchQuery, next);
  };

  // ── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    const loadTechniques = async () => {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from("techniques")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (!error && data) setTechniques(data);
      setInitialLoading(false);
    };
    loadTechniques();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError(t("techniques.nameRequired")); return; }
    if (form.name.trim().length > 100) { setFormError(t("techniques.nameTooLong")); return; }
    const nameNorm = form.name.trim().toLowerCase();
    const duplicate = techniques.find((t) => t.name.trim().toLowerCase() === nameNorm);
    if (duplicate) { setFormError(t("techniques.duplicate", { name: duplicate.name })); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("techniques")
      .insert([{ ...form, name: form.name.trim(), user_id: userId }])
      .select()
      .single();
    if (!error && data) {
      setTechniques([data, ...techniques]);
      setForm({ name: "", category: "guard", mastery_level: 1, notes: "" });
      setShowForm(false);
      setToast({ message: t("techniques.addedSingle"), type: "success" });
    } else {
      setToast({ message: t("techniques.saveFailed"), type: "error" });
    }
    setLoading(false);
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
    setLoading(true);
    const rows = newNames.map((name) => ({
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
    } else {
      setToast({ message: t("techniques.saveFailed"), type: "error" });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("techniques.confirmDelete"))) return;
    setDeletingId(id);
    const { error } = await supabase
      .from("techniques")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) {
      setTechniques(techniques.filter((t) => t.id !== id));
      setToast({ message: t("techniques.deleted"), type: "success" });
    } else {
      setToast({ message: t("techniques.deleteFailed"), type: "error" });
    }
    setDeletingId(null);
  };

  const startEdit = (tech: Technique) => {
    setEditingId(tech.id);
    setEditForm({ name: tech.name, category: tech.category, mastery_level: tech.mastery_level, notes: tech.notes });
  };

  const handleUpdate = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from("techniques")
      .update(editForm)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (!error && data) {
      setTechniques(techniques.map((t) => (t.id === id ? data : t)));
      setEditingId(null);
      setToast({ message: t("techniques.updated"), type: "success" });
    } else {
      setToast({ message: t("techniques.updateFailed"), type: "error" });
    }
  };

  const handleQuickMastery = async (id: string, newLevel: number) => {
    const { data, error } = await supabase
      .from("techniques")
      .update({ mastery_level: newLevel })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (!error && data) {
      setTechniques(techniques.map((t) => (t.id === id ? data : t)));
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
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
        onClose={() => { setShowForm(false); setFormError(null); }}
        onCloseBulk={() => { setShowForm(false); setBulkMode(false); setFormError(null); setBulkText(""); }}
      />

      <TechniqueLogList
        techniques={techniques}
        initialLoading={initialLoading}
        filtered={filtered}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showCount={showCount}
        onLoadMore={handleLoadMore}
        editingId={editingId}
        editForm={editForm}
        setEditForm={setEditForm}
        deletingId={deletingId}
        expandedIds={expandedIds}
        setExpandedIds={setExpandedIds}
        onStartEdit={startEdit}
        onCancelEdit={() => setEditingId(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onQuickMastery={handleQuickMastery}
        onShowForm={(bulk = false) => {
          setBulkMode(bulk);
          setShowForm(!showForm || bulk !== bulkMode);
          setFormError(null);
        }}
      />
    </div>
  );
}
