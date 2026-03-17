"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "./Toast";

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

const CATEGORIES = [
  { value: "guard", label: "ガード" },
  { value: "passing", label: "パス" },
  { value: "submissions", label: "サブミッション" },
  { value: "takedowns", label: "テイクダc��ン" },
  { value: "escapes", label: "エスケープ" },
  { value: "back", label: "バック" },
  { value: "mount", label: "マウント" },
  { value: "other", label: "その他" },
];

const MASTERY_LABELS = ["", "知っている", "練習中", "使える", "得意", "マスター"];
const MASTERY_COLORS = ["", "text-gray-400", "text-blue-400", "text-yellow-400", "text-orange-400", "text-green-400"];

const NOTE_TRUNCATE = 80;

// 相対日付ヘルパー（「今日追加」「3日前に追加」ななど）
function relativeDate(dateStr: string): string {
  if (!dateStr) return "";
  const now = Date.now();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diffMs = now - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "今日追加";
  if (diffDays === 1) return "昨日追加";
  if (diffDays < 7) return `${diffDays}日前に追加`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前に追加`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前に追加`;
  return `${Math.floor(diffDays / 365)}年前に追加`;
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
              className="block rounded-lg overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors"
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
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-2 text-blue-400 hover:text-blue-300 text-sm">
                  🎬 YouTube動画
                </span>
              )}
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
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "mastery_desc" | "mastery_asc" | "name">("newest");
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
      setFormError("テクニック名を入力してください");
      return;
    }
    if (form.name.trim().length > 100) {
      setFormError("テクニック名は100文字以内で入力してください");
      return;
    }

    // 重複チェック（大文字小文字・全角半角を区別しない）
    const nameNorm = form.name.trim().toLowerCase();
    const duplicate = techniques.find((t) => t.name.trim().toLowerCase() === nameNorm);
    if (duplicate) {
      setFormError(`「${duplicate.name}」はすでに登録されています`);
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
      setToast({ message: "テクニックを追加しました！", type: "success" });
    } else {
      setToast({ message: "保存に失敗しました", type: "error" });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このテクニックを削除しますか？")) return;
    setDeletingId(id);
    const { error } = await supabase
      .from("techniques")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) {
      setTechniques(techniques.filter((t) => t.id !== id));
      setToast({ message: "テクニックを削除しました", type: "success" });
    } else {
      setToast({ message: "削除に失敗しました", type: "error" });
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
      setToast({ message: "テクニックを更新しました", type: "success" });
    } else {
      setToast({ message: "更新に失敗しました", type: "error" });
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
        <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
          <div className="flex items-center gap-4 text-sm mb-3">
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-[#e94560]">{techniques.length}</div>
              <div className="text-gray-400 text-xs">総テクニック</div>
            </div>
            <div className="w-px h-8 bg-gray-700" />
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-green-400">
                {techniques.filter((t) => t.mastery_level >= 4).length}
              </div>
              <div className="text-gray-400 text-xs">得意技</div>
            </div>
            <div className="w-px h-8 bg-gray-700" />
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-blue-400">
                {new Set(techniques.map((t) => t.category)).size}
              </div>
              <div className="text-gray-400 text-xs">カテゴリ数</div>
            </div>
          </div>
          {/* 習熟度分布バー */}
          {(() => {
            const masteryColors = ["", "bg-gray-500", "bg-blue-500", "bg-yellow-500", "bg-orange-500", "bg-green-500"];
            const masteryLabels = ["", "入門", "基礎", "中級", "上級", "マスター"];
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
                        title={`${masteryLabels[i + 1]}: ${cnt}個`}
                      />
                    ) : null;
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {counts.map((cnt, i) =>
                    cnt > 0 ? (
                      <span key={i} className="text-[10px] text-gray-500">
                        <span className={`${masteryColors[i + 1].replace("bg-", "text-")}`}>●</span> {masteryLabels[i + 1]} {cnt}
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
          <h3 className="text-lg font-semibold">テクニック帳</h3>
          {!initialLoading && techniques.length > 0 && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-[#16213e] text-gray-400 border border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:border-[#e94560]/60 cursor-pointer"
            >
              <option value="newest">最新順</option>
              <option value="mastery_desc">習熟度↓</option>
              <option value="mastery_asc">習熟度↑</option>
              <option value="name">名前順</option>
            </select>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#e94560] hover:bg-[#c73652] text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          + テクニックを追加
        </button>
      </div>

      {/* 検索バー */}
      {!initialLoading && techniques.length > 0 && (
        <div className="relative mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="テクニック名・メモを検索..."
            className="w-full bg-[#16213e] text-white rounded-xl px-4 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-blue-400 pl-9"
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
                : "bg-[#16213e] text-gray-400 border border-gray-700"
            }`}
          >
            すべて
          </button>
          {CATEGORIES.filter((c) =>
            techniques.some((t) => t.category === c.value)
          ).map((c) => (
            <button
              key={c.value}
              onClick={() => setFilterCategory(c.value)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterCategory === c.value
                  ? "bg-[#e94560] text-white"
                  : "bg-[#16213e] text-gray-400 border border-gray-700"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* 追加フォーム */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4"
        >
          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-red-400 text-xs">
              {formError}
            </div>
          )}
          <div className="mb-3">
            <label className="block text-gray-400 text-xs mb-1">テクニック名</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例: アームバー (クローズドガードから)"
              className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1">カテゴリ</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">習熟度</label>
              <select
                value={form.mastery_level}
                onChange={(e) =>
                  setForm({ ...form, mastery_level: Number(e.target.value) })
                }
                className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
              >
                {MASTERY_LABELS.slice(1).map((label, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} - {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-400 text-xs mb-1">メモ</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="ポイント・注意点・参考動画URLなど..."
              rows={2}
              className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* ローデアング */}
      {initialLoading && (
        <div className="text-center py-8 text-gray-500">
          <div className="inline-block w-6 h-6 border-2 border-gray-600 border-t-[#e94560] rounded-full animate-spin mb-2" />
          <p className="text-sm">読み込み中...</p>
        </div>
      )}

      {/* 空状態 */}
      {!initialLoading && techniques.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-3">📚</div>
          <p>テクニックがまだありません</p>
          <p className="text-sm mt-1">最初のテクニックを追加しましょう！</p>
        </div>
      )}

      {/* テクニック一覧 */}
      {!initialLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((technique) => (
            <div
              key={technique.id}
              className="bg-[#16213e] rounded-xl p-4 border border-gray-700"
            >
              {editingId === technique.id ? (
                <form onSubmit={(e) => handleUpdate(e, technique.id)}>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-400 mb-2"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none"
                    >
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <select
                      value={editForm.mastery_level}
                      onChange={(e) => setEditForm({ ...editForm, mastery_level: Number(e.target.value) })}
                      className="bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none"
                    >
                      {MASTERY_LABELS.slice(1).map((l, i) => <option key={i + 1} value={i + 1}>{i + 1} - {l}</option>)}
                    </select>
                  </div>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={2}
                    className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none mb-2 resize-none"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-[#e94560] text-white text-xs font-semibold py-1.5 rounded-lg">更新</button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 text-gray-400 text-xs">キャンセル</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm truncate">
                        {technique.name}
                      </span>
                      <span className="text-xs bg-[#0f3460] text-gray-300 px-2 py-0.5 rounded-full flex-shrink-0">
                        {CATEGORIES.find((c) => c.value === technique.category)?.label || technique.category}
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
                          title={`習熟度${star}: ${MASTERY_LABELS[star]}`}
                        >
                          ★
                        </button>
                      ))}
                      <span className={`text-xs ml-1 ${MASTERY_COLORS[technique.mastery_level]}`}>
                        {MASTERY_LABELS[technique.mastery_level]}
                      </span>
                      {technique.created_at && (
                           <span className="text-[10px] text-gray-600 ml-auto">
                          {relativeDate(technique.created_at)}
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
                            {expandedIds.has(technique.id) ? "▲ 折りたたむ" : "▼ 続きを見る"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 ml-3 flex-shrink-0">
                    <button
                      onClick={() => startEdit(technique)}
                      className="text-gray-600 hover:text-blue-400 transition-colors p-1"
                      title="編集"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(technique.id)}
                      disabled={deletingId === technique.id}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
                      title="削除"
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
        </div>
      )}

      {/* フィルター結果ゼロ */}
      {!initialLoading && techniques.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          このカテゴリにテクニックはありません
        </div>
      )}
    </div>
  );
}
