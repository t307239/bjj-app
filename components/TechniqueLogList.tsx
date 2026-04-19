"use client";

import React, { useState } from "react";
import { useLocale } from "@/lib/i18n";
import {
  type Technique,
  type TechniqueFormState,
  CATEGORY_VALUES,
  MASTERY_COLORS,
  NOTE_TRUNCATE,
  relativeDate,
  renderNotes,
  isDangerousTechnique,
} from "@/lib/techniqueLogTypes";
import TechniqueVideoButton from "./TechniqueVideoButton";
import SwipeableCard from "./SwipeableCard";

type SortBy = "newest" | "mastery_desc" | "mastery_asc" | "name";

type Props = {
  techniques: Technique[];
  initialLoading: boolean;
  filtered: Technique[];
  searchQuery: string;
  onSearchChange: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  sortBy: SortBy;
  setSortBy: (v: SortBy) => void;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  editingId: string | null;
  editForm: TechniqueFormState;
  setEditForm: (f: TechniqueFormState) => void;
  deletingId: string | null;
  expandedIds: Set<string>;
  setExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onStartEdit: (t: Technique) => void;
  onCancelEdit: () => void;
  onUpdate: (e: React.FormEvent, id: string) => void;
  updating: boolean;
  onDelete: (id: string) => void;
  onQuickMastery: (id: string, level: number) => void;
  onTogglePin?: (id: string) => void;
  onShowForm: (bulk?: boolean) => void;
  userBelt?: string;
};

export default function TechniqueLogList({
  techniques,
  initialLoading,
  filtered,
  searchQuery,
  onSearchChange,
  filterCategory,
  setFilterCategory,
  sortBy,
  setSortBy,
  page,
  pageSize,
  totalPages,
  onPageChange,
  editingId,
  editForm,
  setEditForm,
  deletingId,
  expandedIds,
  setExpandedIds,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  updating,
  onDelete,
  onQuickMastery,
  onTogglePin,
  onShowForm,
  userBelt = "white",
}: Props) {
  const { t } = useLocale();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div>
      {/* ヘッダー: ソート + 追加ボタン */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {!initialLoading && techniques.length > 0 && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="appearance-none text-xs bg-zinc-900 text-zinc-300 border border-zinc-700 hover:border-zinc-600 rounded-lg px-3 py-2 min-h-[44px] focus:outline-none focus:border-emerald-500 cursor-pointer transition-colors"
            >
              <option value="newest">{t("techniques.sortNewest")}</option>
              <option value="mastery_desc">
                {t("techniques.sortMasteryDesc")}
              </option>
              <option value="mastery_asc">
                {t("techniques.sortMasteryAsc")}
              </option>
              <option value="name">{t("techniques.sortName")}</option>
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onShowForm(false)}
            className="bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all"
          >
            {t("techniques.add")}
          </button>
          <button
            onClick={() => onShowForm(true)}
            title={t("techniques.bulkDesc")}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-semibold py-2 px-3 rounded-lg border border-zinc-700 transition-colors"
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
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("techniques.search")}
            className="w-full bg-zinc-900/50 text-zinc-200 rounded-lg px-4 py-2.5 text-sm border border-zinc-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 pl-9 placeholder:text-zinc-600"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* カテゴリフィルター */}
      {!initialLoading && techniques.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 mt-4 scrollbar-hide scroll-fade-x">
          <button
            onClick={() => setFilterCategory("all")}
            className={`flex-shrink-0 px-3 py-1.5 min-h-[44px] rounded-full text-xs font-medium transition-colors ${
              filterCategory === "all"
                ? "bg-zinc-600 text-white"
                : "bg-zinc-900 text-zinc-400 border border-white/10"
            }`}
          >
            {t("techniques.all")}
          </button>
          {CATEGORY_VALUES.filter((catVal) =>
            techniques.some((t) => t.category === catVal),
          ).map((catVal) => (
            <button
              key={catVal}
              onClick={() => setFilterCategory(catVal)}
              className={`flex-shrink-0 px-3 py-1.5 min-h-[44px] rounded-full text-xs font-medium transition-colors ${
                filterCategory === catVal
                  ? "bg-zinc-600 text-white"
                  : "bg-zinc-900 text-zinc-400 border border-white/10"
              }`}
            >
              {t("techniques.categories." + catVal)}
            </button>
          ))}
        </div>
      )}

      {/* ローディング */}
      {initialLoading && (
        <div className="text-center py-8 text-zinc-400">
          <div className="inline-block w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mb-2" />
          <p className="text-sm">{t("techniques.loading")}</p>
        </div>
      )}

      {/* 空状態 */}
      {!initialLoading && techniques.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          <div className="text-4xl mb-3">📚</div>
          <p>{t("techniques.empty")}</p>
          <p className="text-sm mt-1">{t("techniques.emptyDesc")}</p>
        </div>
      )}

      {/* テクニック一覧 */}
      {!initialLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.slice((page - 1) * pageSize, page * pageSize).map((technique) => (
            <SwipeableCard
              key={technique.id}
              onDelete={() => onDelete(technique.id)}
              onEdit={() => onStartEdit(technique)}
              className="bg-zinc-900 rounded-xl p-4 border border-white/10 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors duration-150"
            >
              {editingId === technique.id ? (
                // インライン編集フォーム
                <form onSubmit={(e) => onUpdate(e, technique.id)}>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-white/30 mb-2"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select
                      value={editForm.category}
                      onChange={(e) =>
                        setEditForm({ ...editForm, category: e.target.value })
                      }
                      className="bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none"
                    >
                      {CATEGORY_VALUES.map((catVal) => (
                        <option key={catVal} value={catVal}>
                          {t("techniques.categories." + catVal)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editForm.mastery_level}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          mastery_level: Number(e.target.value),
                        })
                      }
                      className="bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5].map((level) => (
                        <option key={level} value={level}>
                          {level} - {t("techniques.masteryLevels." + level)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm({ ...editForm, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none mb-2 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={updating}
                      className="flex-1 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white text-xs font-semibold py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {updating ? t("techniques.saving") : t("techniques.update")}
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="px-3 text-zinc-400 text-xs"
                    >
                      {t("techniques.cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                // 表示モード
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {technique.is_pinned && (
                        <span className="text-amber-400 text-xs flex-shrink-0" title={t("techniques.pinned")}>📌</span>
                      )}
                      <span className="font-semibold text-sm truncate">
                        {technique.name}
                      </span>
                      <span className="text-xs bg-zinc-800/80 text-zinc-300 border border-zinc-700/50 px-2 py-0.5 rounded-full flex-shrink-0">
                        {t("techniques.categories." + technique.category) ||
                          technique.category}
                      </span>
                      {userBelt === "white" && isDangerousTechnique(technique.name) && (
                        <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded-full flex-shrink-0" title={t("techniques.dangerTooltip")}>
                          🔒 Blue Belt+
                        </span>
                      )}
                      {userBelt === "blue" && isDangerousTechnique(technique.name) && (
                        <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-full flex-shrink-0" title={t("techniques.dangerTooltip")}>
                          ⚠️ {t("techniques.dangerBadge")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() =>
                              onQuickMastery(technique.id, star)
                            }
                            className={`text-sm leading-none transition-colors ${
                              star <= technique.mastery_level
                                ? MASTERY_COLORS[technique.mastery_level]
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                            title={
                              t("techniques.mastery") +
                              ` ${star}: ${t("techniques.masteryLevels." + star)}`
                            }
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-zinc-400 leading-none">
                        {t("techniques.masteryLevels." + technique.mastery_level)}
                      </span>
                      {technique.created_at && (
                        <span className="text-xs text-zinc-400 ml-auto leading-none">
                          {relativeDate(technique.created_at, t)}
                        </span>
                      )}
                    </div>
                    {technique.notes && (
                      <div className="mt-1.5">
                        <p className="text-zinc-400 text-xs leading-relaxed">
                          {renderNotes(
                            technique.notes,
                            expandedIds.has(technique.id),
                          )}
                        </p>
                        {technique.notes.length > NOTE_TRUNCATE && (
                          <button
                            onClick={() =>
                              setExpandedIds((prev) => {
                                const next = new Set(prev);
                                next.has(technique.id)
                                  ? next.delete(technique.id)
                                  : next.add(technique.id);
                                return next;
                              })
                            }
                            className="text-xs text-[#10B981] hover:text-[#0d9668] mt-0.5"
                          >
                            {expandedIds.has(technique.id)
                              ? t("techniques.collapse")
                              : t("techniques.expand")}
                          </button>
                        )}
                      </div>
                    )}
                    {/* B-23: Private reference video URL (localStorage) */}
                    <TechniqueVideoButton techniqueId={technique.id} />
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    {onTogglePin && (
                      <button
                        onClick={() => onTogglePin(technique.id)}
                        className={`transition-colors p-2 flex items-center justify-center min-w-[44px] min-h-[44px] ${
                          technique.is_pinned
                            ? "text-amber-400 hover:text-amber-300"
                            : "text-zinc-600 hover:text-zinc-400"
                        }`}
                        title={technique.is_pinned ? t("techniques.unpin") : t("techniques.pin")}
                        aria-label={technique.is_pinned ? t("techniques.unpin") : t("techniques.pin")}
                      >
                        <svg className="w-4 h-4" fill={technique.is_pinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                    )}
                    {/* Edit/Delete: desktop only — mobile uses swipe gestures */}
                    <button
                      onClick={() => onStartEdit(technique)}
                      className="hidden md:flex text-zinc-400 hover:text-[#10B981] transition-colors p-2 items-center justify-center min-w-[44px] min-h-[44px]"
                      title={t("techniques.edit")}
                      aria-label={t("techniques.edit")}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    {confirmDeleteId === technique.id && deletingId !== technique.id ? (
                      /* Inline delete confirm — avoids window.confirm() */
                      <div className="hidden md:flex items-center gap-1 ml-1">
                        <button
                          onClick={() => { setConfirmDeleteId(null); onDelete(technique.id); }}
                          className="text-xs font-semibold text-white bg-[#e94560] hover:bg-[#c73652] min-h-[44px] px-3 py-2 rounded-lg transition-colors"
                          title={t("techniques.confirmDelete")}
                          aria-label={t("techniques.confirmDelete")}
                        >
                          {t("common.delete")}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors min-h-[44px] px-3 py-2"
                        >
                          {t("training.cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(technique.id)}
                        disabled={deletingId === technique.id}
                        className="hidden md:flex text-zinc-400 hover:text-red-400 transition-colors p-2 items-center justify-center min-w-[44px] min-h-[44px] disabled:opacity-50"
                        title={t("techniques.delete")}
                        aria-label={t("techniques.delete")}
                      >
                        {deletingId === technique.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </SwipeableCard>
          ))}
          {/* Prev / Next pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="px-3 py-2 min-h-[44px] text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg> {t("training.prev")}
              </button>
              <span className="text-xs text-zinc-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-2 min-h-[44px] text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {t("training.next")} <svg className="w-4 h-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* フィルター結果ゼロ */}
      {!initialLoading && techniques.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-zinc-400 text-sm">
          {t("techniques.noResults")}
        </div>
      )}
    </div>
  );
}
