"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import Toast from "./Toast";
import { getAffiliateInfo } from "@/lib/affiliateMap";

type Technique = {
  id: string;
  name: string;
  category: string;
  mastery_level: number;
  notes: string;
  created_at: string;
};

type Props = {
  userId: string;
};

const CATEGORY_VALUES = ["guard", "passing", "submissions", "takedowns", "escapes", "back", "mount", "other"];

const MASTERY_COLORS = ["", "text-gray-400", "text-blue-400", "text-yellow-400", "text-orange-400", "text-green-400"];

const NOTE_TRUNCATE = 80;

// 相対日付ヘルパー（t() 関数を受け取って言語対応）
function relativeDate(dateStr: string, t: (key: string, replacements?: Record<string, any>) => string): string {
  if (!dateStr) return "";
  const now = Date.now();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diffMs = now - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return t("techniques.addedToday");
  if (diffDays === 1) return t("techniques.addedYesterday");
  if (diffDays < 7) return t("techniques.addedDaysAgo", { n: diffDays });
  if (diffDays < 30) return t("techniques.addedWeeksAgo", { n: Math.floor(diffDays / 7) });
  if (diffDays < 365) return t("techniques.addedMonthsAgo", { n: Math.floor(diffDays / 30) });
  return t("techniques.addedYearsAgo", { n: Math.floor(diffDays / 365) });
}

// YouTube URLからビデオIDを抽出
function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1).split("?")[0] || null;
    }
  } catch {
    // invalid URL
  }
  return null;
}

// URLを検出してリンク化（YouTube は🎬アイコン付きサムネイル表示）
function renderNotes(notes: string, expanded: boolean): React.ReactNode {
  const display = !expanded && notes.length > NOTE_TRUNCATE
    ? notes.slice(0, NOTE_TRUNCATE) + "…"
    : notes;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = display.split(urlRegex);

  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      const isYoutube = part.includes("youtube.com") || part.includes("youtu.be");
      if (isYoutube) {
        const videoId = extractYoutubeId(part);
        return (
          <span key={i} className="inline-block mt-1 w-full">
            <a
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border border-white/10 hover:border-white/10 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {videoId ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                    alt="YouTube thumbnail"
                    className="w-full h-auto rounded-lg"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/60 rounded-full w-10 h-10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : null}
            </a>
          </span>
        );
      }
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function TechniqueLog({ userId }: Props) {
  const { t } = useLocale();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkCategory, setBulkCategory] = useState("guard");
  const [bulkMastery, setBulkMastery] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "mastery_desc" | "mastery_asc" | "name">("newest");
  const [showCount, setShowCount] = useState(3);
  const TECH_PAGE_SIZE = 10;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: "",
    category: "guard",
    mastery_level: 1,
    notes: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    category: "guard",
    mastery_level: 1,
    notes: "",
  });
  const supabase = createClient();

  useEffect(() => {
    const loadTechniques = async () => {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from("techniques")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTechniques(data);
      }
      setInitialLoading(false);
    };
    loadTechniques();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // バリデーション
    if (!form.name.trim()) {
      setFormError(t("techniques.nameRequired"));
      return;
    }
    if (form.name.trim().length > 100) {
      setFormError(t("techniques.nameTooLong"));
      return;
    }

    // 重複チェック（大文字小文字・全角半角を区別しない）
    const nameNorm = form.name.trim().toLowerCase();
    const duplicate = techniques.find((t) => t.name.trim().toLowerCase() === nameNorm);
    if (duplicate) {
      setFormError(t("techniques.duplicate", { name: duplicate.name }));
      return;
    }

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

    // 改行で分割して空行を除去
    const names = bulkText
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      setFormError(t("techniques.bulkError"));
      return;
    }

    // 100文字超チェック
    const tooLong = names.find((n) => n.length > 100);
    if (tooLong) {
      setFormError(t("techniques.nameTooLongBulk", { name: tooLong }));
      return;
    }

    // 重複チェック（既登録 + 今回の入力内の重複）
    const existingNorms = new Set(techniques.map((t) => t.name.trim().toLowerCase()));
    const seen = new Set<string>();
    for (const name of names) {
      const norm = name.toLowerCase();
      if (existingNorms.has(norm)) {
        setFormError(t("techniques.duplicate", { name }));
        return;
      }
      if (seen.has(norm)) {
        setFormError(t("techniques.duplicateBulk", { name }));
        return;
      }
      seen.add(norm);
    }

    setLoading(true);

    const rows = names.map((name) => ({
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

  const startEdit = (t: Technique) => {
    setEditingId(t.id);
    setEditForm({ name: t.name, category: t.category, mastery_level: t.mastery_level, notes: t.notes });
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

  const filtered = techniques
    .filter((t) => filterCategory === "all" || t.category === filterCategory)
    .filter((t) =>
      searchQuery === "" ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .slice()
    .sort((a, b) => {
      if (sortBy === "mastery_desc") return (b.mastery_level ?? 0) - (a.mastery_level ?? 0);
      if (sortBy === "mastery_asc") return (a.mastery_level ?? 0) - (b.mastery_level ?? 0);
      if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
      // newest: by created_at desc (default DB order)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* 統計バー */}
      {!initialLoading && techniques.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
          <div className="flex items-center gap-4 text-sm mb-3">
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-[#e94560]">{techniques.length}</div>
              <div className="text-gray-400 text-xs">{t("techniques.totalTechniques")}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-green-400">
                {techniques.filter((t) => t.mastery_level >= 4).length}
              </div>
              <div className="text-gray-400 text-xs">{t("techniques.favorites")}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-blue-400">
                {new Set(techniques.map((t) => t.category)).size}
              </div>
              <div className="text-gray-400 text-xs">{t("techniques.categoryCount")}</div>
            </div>
          </div>
          {/* 習熟度分布バー */}
          {(() => {
            const masteryColors = ["", "bg-gray-500", "bg-blue-500", "bg-yellow-500", "bg-orange-500", "bg-green-500"];
            const masteryLevelKeys = ["", "1", "2", "3", "4", "5"];
            const counts = [1, 2, 3, 4, 5].map((lvl) =>
              techniques.filter((t) => t.mastery_level === lvl).length
            );
            const total = techniques.length;
            return (
              <div>
                <div className="flex rounded-full overflow-hidden h-2 mb-1">
                  {counts.map((cnt, i) => {
                    const pct = total > 0 ? (cnt / total) * 100 : 0;
                    return pct > 0 ? (
                      <div
                        key={i}
                        className={`${masteryColors[i + 1]} transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${t("techniques.masteryLevels." + masteryLevelKeys[i + 1])}: ${cnt}`}
                      />
                    ) : null;
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {counts.map((cnt, i) =>
                    cnt > 0 ? (
                      <span key={i} className="text-[10px] text-gray-500">
                        <span className={`${masteryColors[i + 1].replace("bg-", "text-")}`}>●</span> {t("techniques.masteryLevels." + masteryLevelKeys[i + 1])} {cnt}
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{t("techniques.title")}</h3>
          {!initialLoading && techniques.length > 0 && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-zinc-900 text-gray-400 border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:border-[#e94560]/60 cursor-pointer"
            >
              <option value="newest">{t("techniques.sortNewest")}</option>
              <option value="mastery_desc">{t("techniques.sortMasteryDesc")}</option>
              <option value="mastery_asc">{t("techniques.sortMasteryAsc")}</option>
              <option value="name">{t("techniques.sortName")}</option>
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setBulkMode(false); setShowForm(!showForm); setFormError(null); }}
            className="bg-[#e94560] hover:bg-[#c73652] text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {t("techniques.add")}
          </button>
          <button
            onClick={() => { setBulkMode(true); setShowForm(true); setFormError(null); }}
            title={t("techniques.bulkDesc")}
            className="bg-zinc-800 hover:bg-zinc-700 text-gray-300 text-sm font-semibold py-2 px-3 rounded-lg border border-white/10 transition-colors"
          >
            {t("techniques.bulkAdd")}
          </button>
        </div>
      </div>

      {/* 検索バー */}
      {!initialLoading && techniques.length > 0 && (
        <div className="relative mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("techniques.search")}
            className="w-full bg-zinc-900 text-white rounded-xl px-4 py-2.5 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] pl-9"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
              ✕
            </button>
          )}
        </div>
      )}

      {/* カテゴリフィルター */}
      {!initialLoading && techniques.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setFilterCategory("all")}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterCategory === "all"
                ? "bg-[#e94560] text-white"
                : "bg-zinc-900 text-gray-400 border border-white/10"
            }`}
          >
            {t("techniques.all")}
          </button>
          {CATEGORY_VALUES.filter((catVal) =>
            techniques.some((t) => t.category === catVal)
          ).map((catVal) => (
            <button
              key={catVal}
              onClick={() => setFilterCategory(catVal)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterCategory === catVal
                  ? "bg-[#e94560] text-white"
                  : "bg-zinc-900 text-gray-400 border border-white/10"
              }`}
            >
              {t("techniques.categories." + catVal)}
            </button>
          ))}
        </div>
      )}

      {/* 追加フォーム（単体 or まとめて） */}
      {showForm && !bulkMode && (
        <form
          onSubmit={handleSubmit}
          className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4"
        >
          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-red-400 text-xs">
              {formError}
            </div>
          )}
          <div className="mb-3">
            <label className="block text-gray-400 text-xs mb-1">{t("techniques.name")}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("techniques.namePlaceholder")}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("techniques.category")}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed]"
              >
                {CATEGORY_VALUES.map((catVal) => (
                  <option key={catVal} value={catVal}>
                    {t("techniques.categories." + catVal)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("techniques.mastery")}</label>
              <select
                value={form.mastery_level}
                onChange={(e) =>
                  setForm({ ...form, mastery_level: Number(e.target.value) })
                }
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed]"
              >
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>
                    {level} - {t("techniques.masteryLevels." + level)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-400 text-xs mb-1">{t("techniques.notes")}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t("techniques.notesPlaceholder")}
              rows={2}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? t("techniques.saving") : t("techniques.save")}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              {t("techniques.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* まとめて追加フォーム */}
      {showForm && bulkMode && (
        <form
          onSubmit={handleBulkSubmit}
          className="bg-zinc-900 rounded-xl p-4 border border-[#7c3aed]/40 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-[#7c3aed]">{t("techniques.bulkTitle")}</span>
            <span className="text-xs text-gray-500">{t("techniques.bulkDesc")}</span>
          </div>
          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-red-400 text-xs">
              {formError}
            </div>
          )}
          <div className="mb-3">
            <label className="block text-gray-400 text-xs mb-1">{t("techniques.nameMultiple")}</label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={t("techniques.nameMultiplePlaceholder")}
              rows={6}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] resize-none font-mono"
            />
            {bulkText && (
              <p className="text-xs text-gray-500 mt-1">
                {t("techniques.bulkCount", { n: bulkText.split("\n").filter((n) => n.trim()).length })}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("techniques.categoryMultiple")}</label>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed]"
              >
                {CATEGORY_VALUES.map((catVal) => (
                  <option key={catVal} value={catVal}>{t("techniques.categories." + catVal)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("techniques.masteryMultiple")}</label>
              <select
                value={bulkMastery}
                onChange={(e) => setBulkMastery(Number(e.target.value))}
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed]"
              >
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>{level} - {t("techniques.masteryLevels." + level)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? t("techniques.saving") : t("techniques.bulkSave")}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setBulkMode(false); setFormError(null); setBulkText(""); }}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              {t("techniques.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* ローデアング */}
      {initialLoading && (
        <div className="text-center py-8 text-gray-500">
          <div className="inline-block w-6 h-6 border-2 border-white/10 border-t-[#e94560] rounded-full animate-spin mb-2" />
          <p className="text-sm">{t("techniques.loading")}</p>
        </div>
      )}

      {/* 空状態 */}
      {!initialLoading && techniques.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-3">📚</div>
          <p>{t("techniques.empty")}</p>
          <p className="text-sm mt-1">{t("techniques.emptyDesc")}</p>
        </div>
      )}

      {/* テクニック一覧 */}
      {!initialLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.slice(0, showCount).map((technique) => (
            <div
              key={technique.id}
              className="bg-zinc-900 rounded-xl p-4 border border-white/10"
            >
              {editingId === technique.id ? (
                <form onSubmit={(e) => handleUpdate(e, technique.id)}>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] mb-2"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none"
                    >
                      {CATEGORY_VALUES.map((catVal) => <option key={catVal} value={catVal}>{t("techniques.categories." + catVal)}</option>)}
                    </select>
                    <select
                      value={editForm.mastery_level}
                      onChange={(e) => setEditForm({ ...editForm, mastery_level: Number(e.target.value) })}
                      className="bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level} - {t("techniques.masteryLevels." + level)}</option>)}
                    </select>
                  </div>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={2}
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none mb-2 resize-none"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-[#e94560] text-white text-xs font-semibold py-1.5 rounded-lg">{t("techniques.update")}</button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 text-gray-400 text-xs">{t("techniques.cancel")}</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm truncate">
                        {technique.name}
                      </span>
                      <span className="text-xs bg-zinc-800/80 text-gray-300 px-2 py-0.5 rounded-full flex-shrink-0">
                        {t("techniques.categories." + technique.category) || technique.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleQuickMastery(technique.id, star)}
                          className={`text-sm transition-colors ${
                            star <= technique.mastery_level
                              ? MASTERY_COLORS[technique.mastery_level]
                              : "text-gray-700 hover:text-gray-500"
                          }`}
                          title={t("techniques.mastery") + ` ${star}: ${t("techniques.masteryLevels." + star)}`}
                        >
                          ★
                        </button>
                      ))}
                      <span className={`text-xs ml-1 ${MASTERY_COLORS[technique.mastery_level]}`}>
                        {t("techniques.masteryLevels." + technique.mastery_level)}
                      </span>
                      {technique.created_at && (
                           <span className="text-[10px] text-gray-600 ml-auto">
                          {relativeDate(technique.created_at, t)}
                        </span>
                      )}
                    </div>
                    {technique.notes && (
                      <div className="mt-1.5">
                        <p className="text-gray-400 text-xs leading-relaxed">
                          {renderNotes(technique.notes, expandedIds.has(technique.id))}
                        </p>
                        {technique.notes.length > NOTE_TRUNCATE && (
                          <button
                            onClick={() => setExpandedIds((prev) => {
                              const next = new Set(prev);
                              next.has(technique.id) ? next.delete(technique.id) : next.add(technique.id);
                              return next;
                            })}
                            className="text-[10px] text-blue-500 hover:text-blue-400 mt-0.5"
                          >
                            {expandedIds.has(technique.id) ? t("techniques.collapse") : t("techniques.expand")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 ml-3 flex-shrink-0">
                    {(() => {
                      const dvdInfo = getAffiliateInfo(technique.name);
                      return dvdInfo ? (
                        <a
                          href={dvdInfo.url}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          className="flex items-center gap-1 text-[10px] font-medium text-orange-400/80 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 hover:border-orange-500/40 px-2 py-1 rounded-lg transition-all whitespace-nowrap"
                          title={`${dvdInfo.title} by ${dvdInfo.instructor}`}
                        >
                          <span>📼</span>
                          <span>{dvdInfo.instructor.split(" ").slice(-1)[0]}</span>
                        </a>
                      ) : null;
                    })()}
                    <button
                      onClick={() => startEdit(technique)}
                      className="text-gray-600 hover:text-blue-400 transition-colors p-1"
                      title={t("techniques.edit")}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(technique.id)}
                      disabled={deletingId === technique.id}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
                      title={t("techniques.delete")}
                    >
                      {deletingId === technique.id ? (
                        <span className="text-xs">...</span>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {/* Show More */}
          {filtered.length > showCount && (
            <button
              onClick={() => setShowCount((prev) => prev + TECH_PAGE_SIZE)}
              className="w-full py-2.5 text-sm text-gray-400 hover:text-white bg-zinc-900 border border-white/10 hover:border-white/20 rounded-xl transition-colors"
            >
              {t("training.loadMore")} ({filtered.length - showCount} more)
            </button>
          )}
        </div>
      )}

      {/* フィルター結果ゼロ */}
      {!initialLoading && techniques.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          {t("techniques.noResults")}
        </div>
      )}
    </div>
  );
}
