"use client";

import { memo } from "react";
import { useLocale } from "@/lib/i18n";
import { TRAINING_TYPES } from "@/lib/trainingTypes";
import DraftNumberInput from "@/components/ui/DraftNumberInput";
import ShareButton from "@/components/ShareButton";
import CopyLinkButton from "@/components/CopyLinkButton";
import SwipeableCard from "@/components/SwipeableCard";
import {
  type TrainingEntry,
  type CompData,
  BELT_RANKS,
  RESULT_LABELS,
  decodeCompNotes,
  decodeRollNotes,
  formatRollBadge,
} from "@/lib/trainingLogHelpers";

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 150, 180];

function formatRelativeDate(dateStr: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  // dateStr is "YYYY-MM-DD" (local date)
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (dateStr === todayStr) return t("gym.today");
  if (dateStr === yesterdayStr) return t("gym.yesterday");
  // diff in days
  const [y, m, d] = dateStr.split("-").map(Number);
  const logDate = new Date(y, m - 1, d);
  const diffMs = today.setHours(0, 0, 0, 0) - logDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays < 7) return t("gym.daysAgo", { n: diffDays });
  // Compact format: "3/26" or "3/26/24" for >1 year — short enough for 320px screens
  const shortYear = diffDays > 365 ? `/${String(logDate.getFullYear()).slice(2)}` : "";
  return `${logDate.getMonth() + 1}/${logDate.getDate()}${shortYear}`;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useLocale();
  const isPreset = DURATION_PRESETS.includes(value);
  return (
    <div>
      <label className="block text-zinc-400 text-xs mb-1">{t("training.duration")}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {DURATION_PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`px-2.5 py-1.5 min-h-[32px] rounded-lg text-xs font-medium transition-colors ${
              value === d
                ? "bg-[#10B981] text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {formatDuration(d)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <DraftNumberInput
          value={value}
          onChange={onChange}
          min={1}
          max={480}
          className={`w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border focus:outline-none focus:border-white/30 ${
            isPreset ? "border-white/10" : "border-white/30"
          }`}
        />
        <span className="text-zinc-400 text-xs flex-shrink-0">{t("trainingLog.minUnit")}</span>
      </div>
    </div>
  );
}

type EditFormState = {
  date: string;
  duration_min: number;
  type: string;
  notes: string;
};

type Props = {
  initialLoading: boolean;
  entries: TrainingEntry[];
  filtered: TrainingEntry[];
  searchQuery: string;
  editingId: string | null;
  editForm: EditFormState;
  setEditForm: (f: EditFormState) => void;
  onStartEdit: (entry: TrainingEntry) => void;
  onCancelEdit: () => void;
  onUpdate: (e: React.FormEvent, id: string) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  page: number;
  totalPages: number;
  pageLoading: boolean;
  onPageChange: (page: number) => void;
  expandedNotes: Set<string>;
  setExpandedNotes: React.Dispatch<React.SetStateAction<Set<string>>>;
  editCompForm: CompData;
  setEditCompForm: (f: CompData) => void;
  totalCount: number | null;
  today: string;
  onShowForm: () => void;
};

// memo: prevents re-render when unrelated state (showForm, filterType, etc.) changes in parent
const TrainingLogList = memo(function TrainingLogList({
  initialLoading,
  entries,
  filtered,
  searchQuery,
  editingId,
  editForm,
  setEditForm,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  deletingId,
  page,
  totalPages,
  pageLoading,
  onPageChange,
  expandedNotes,
  setExpandedNotes,
  editCompForm,
  setEditCompForm,
  totalCount,
  today,
  onShowForm,
}: Props) {
  const { t } = useLocale();

  // ── Loading skeleton (CLS防止: 実カードと同形状のダミーブロック) ──────────
  if (initialLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-zinc-900/60 rounded-xl border border-white/5 p-4 animate-pulse">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-4 w-16 bg-white/5 rounded" />
            </div>
            <div className="h-3 w-full bg-white/5 rounded mb-1.5" />
            <div className="h-3 w-3/4 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // ── Empty State ──────────────────────────────────────────────────────────
  // When search is active and returns 0 results, show "no match" instead of new-user empty state
  if (entries.length === 0 && searchQuery) {
    return (
      <div role="status" className="text-center py-8 text-zinc-400 text-sm">
        {t("training.noMatchQuery", { query: searchQuery })}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="text-6xl mb-4 animate-bounce inline-block">🥋</div>
        <p className="text-white font-bold text-lg mb-1">{t("training.empty")}</p>
        <p className="text-zinc-400 text-sm mb-2">
          {t("training.emptyDesc")}
        </p>
        <div className="flex justify-center gap-4 text-xs text-zinc-400 mb-6">
          <span>{t("training.emptyFree")}</span>
          <span>{t("training.emptyCloud")}</span>
          <span>{t("training.emptyTrack")}</span>
        </div>
        <button
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50]);
            onShowForm();
          }}
          className="bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white text-sm font-bold py-3 px-8 rounded-full transition-all shadow-lg shadow-[#10B981]/30 animate-pulse hover:animate-none"
        >
          {t("training.firstRecord")}
        </button>
      </div>
    );
  }

  // ── Filter empty result ──────────────────────────────────────────────────
  if (filtered.length === 0) {
    return (
      <div role="status" className="text-center py-8 text-zinc-400 text-sm">
        {searchQuery ? t("training.noMatchQuery", { query: searchQuery }) : t("training.noMatch")}
      </div>
    );
  }

  // ── Entry list ───────────────────────────────────────────────────────────
  return (
    <>
      {searchQuery && totalCount !== null && (
        <div className="text-xs text-zinc-400 mb-2">
          {t("training.searchResultCount", { count: String(totalCount) })}
        </div>
      )}
      <div className="max-h-[520px] overflow-y-auto scrollbar-hide space-y-3 pr-0.5">
        {filtered.map((entry) => (
          // B-10: SwipeableCard — left swipe = delete, right swipe = edit
          <SwipeableCard
            key={entry.id}
            onDelete={() => onDelete(entry.id)}
            onEdit={() => onStartEdit(entry)}
            className={`group/row bg-zinc-900/50 backdrop-blur-sm rounded-2xl py-3 px-4 ring-1 ring-inset ring-white/[0.04] shadow-md shadow-black/30 hover:ring-white/[0.08] hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors duration-150${
              entry.type === "competition" ? " border-l-2 border-l-red-500" : ""
            }`}
          >
            {editingId === entry.id ? (
              /* Inline edit form */
              <form onSubmit={(e) => onUpdate(e, entry.id)}>
                <div className="mb-2">
                  <input
                    type="date"
                    value={editForm.date}
                    max={today}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-white/30 mb-2"
                  />
                  <DurationPicker
                    value={editForm.duration_min}
                    onChange={(v) => setEditForm({ ...editForm, duration_min: v })}
                  />
                </div>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-white/30 mb-2"
                >
                  {TRAINING_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {editForm.type === "competition" && (
                  <div className="mb-2 bg-red-500/5 border border-red-500/20 rounded-xl p-2 space-y-1.5">
                    <p className="text-xs text-red-400 font-semibold">{t("trainingLog.competitionDetailsLabel")}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={editCompForm.result}
                        onChange={(e) => setEditCompForm({ ...editCompForm, result: e.target.value })}
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-white/30"
                      >
                        <option value="win">{t("csv.win")} 🏆</option>
                        <option value="loss">{t("csv.loss")}</option>
                        <option value="draw">{t("csv.draw")}</option>
                      </select>
                      <input
                        type="text"
                        value={editCompForm.opponent}
                        onChange={(e) => setEditCompForm({ ...editCompForm, opponent: e.target.value })}
                        placeholder={t("competition.opponentShortPlaceholder")}
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-white/30 placeholder-gray-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={editCompForm.finish}
                        onChange={(e) => setEditCompForm({ ...editCompForm, finish: e.target.value })}
                        placeholder={t("competition.finishShortPlaceholder")}
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-white/30 placeholder-gray-500"
                      />
                      <input
                        type="text"
                        value={editCompForm.event}
                        onChange={(e) => setEditCompForm({ ...editCompForm, event: e.target.value })}
                        placeholder={t("competition.eventShortPlaceholder")}
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-white/30 placeholder-gray-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={editCompForm.opponent_rank}
                        onChange={(e) =>
                          setEditCompForm({ ...editCompForm, opponent_rank: e.target.value })
                        }
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-white/30"
                      >
                        {BELT_RANKS.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editCompForm.gi_type}
                        onChange={(e) => setEditCompForm({ ...editCompForm, gi_type: e.target.value })}
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-white/30"
                      >
                        <option value="gi">{t("training.gi")}</option>
                        <option value="nogi">{t("training.nogi")}</option>
                      </select>
                    </div>
                  </div>
                )}
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-white/30 resize-none mb-2"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white text-xs font-semibold py-2 min-h-[40px] rounded-lg transition-all"
                  >
                    {t("training.update")}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="px-3 text-zinc-400 hover:text-gray-200 text-xs transition-colors"
                  >
                    {t("training.cancel")}
                  </button>
                </div>
              </form>
            ) : (
              /* Normal display — compressed 1-row layout (㉕) */
              <div>
                {/* Primary row: left = type badge + date, right = duration + actions */}
                <div className="flex items-center justify-between w-full">
                  {/* Left: type badge + relative date */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        TRAINING_TYPES.find((t) => t.value === entry.type)?.color ||
                        "bg-white/10 text-zinc-300"
                      }`}
                    >
                      <span>
                        {TRAINING_TYPES.find((t) => t.value === entry.type)?.icon || "🥋"}
                      </span>
                      <span>
                        {TRAINING_TYPES.find((t) => t.value === entry.type)?.label || entry.type}
                      </span>
                    </span>
                    <span className="text-zinc-400 text-xs whitespace-nowrap">{formatRelativeDate(entry.date, t)}</span>
                  </div>
                  {/* Right: duration + action buttons */}
                  <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-zinc-400 text-xs font-medium mr-1">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                      </svg>
                      {entry.duration_min >= 60
                        ? `${Math.floor(entry.duration_min / 60)}h${
                            entry.duration_min % 60 > 0 ? `${entry.duration_min % 60}m` : ""
                          }`
                        : `${entry.duration_min}m`}
                    </span>
                    {/* Action buttons — visible on mobile, hover-only on desktop (Linear-style) */}
                    <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover/row:opacity-100 md:transition-opacity md:duration-150">
                      <CopyLinkButton entryId={entry.id} />
                      <ShareButton entry={entry} />
                      <button
                        onClick={() => onStartEdit(entry)}
                        className="text-zinc-400 hover:text-[#10B981] transition-colors p-2 rounded-lg flex items-center justify-center min-w-[44px] min-h-[44px]"
                        title={t("training.edit")}
                        aria-label={t("training.edit")}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(entry.id)}
                        disabled={deletingId === entry.id}
                        className="text-zinc-400 hover:text-red-400 transition-colors p-2 rounded-lg flex items-center justify-center min-w-[44px] min-h-[44px] disabled:opacity-50"
                        title={t("training.delete")}
                        aria-label={t("training.delete")}
                      >
                        {deletingId === entry.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                {/* Secondary row: instructor/partner tags (B-04/B-09) */}
                {(entry.instructor_name || entry.partner_username) && (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {entry.instructor_name && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {entry.instructor_name}
                      </span>
                    )}
                    {entry.partner_username && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        @{entry.partner_username}
                      </span>
                    )}
                  </div>
                )}
                {/* Tertiary row: notes / roll details / competition details */}
                {entry.notes &&
                  (() => {
                    const { comp, userNotes: afterComp } = decodeCompNotes(entry.notes);
                    const { roll, userNotes } = decodeRollNotes(afterComp);
                    return (
                      <>
                        {comp && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span
                              className={`text-xs font-semibold ${
                                RESULT_LABELS[comp.result]?.color ?? "text-zinc-400"
                              }`}
                            >
                              {RESULT_LABELS[comp.result]?.label ?? comp.result}
                            </span>
                            {comp.gi_type && (
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  comp.gi_type === "nogi"
                                    ? "bg-orange-500/20 text-orange-400"
                                    : "bg-blue-500/20 text-blue-400"
                                }`}
                              >
                                {comp.gi_type === "nogi" ? t("training.calendarNogi") : t("training.calendarGi")}
                              </span>
                            )}
                            {comp.opponent && (
                              <span className="text-xs text-zinc-400">
                                vs {comp.opponent}
                                {comp.opponent_rank && (
                                  <span className="ml-1 text-zinc-400">
                                    (
                                    {BELT_RANKS.find((b) => b.value === comp.opponent_rank)
                                      ?.label ?? comp.opponent_rank}
                                    )
                                  </span>
                                )}
                              </span>
                            )}
                            {comp.finish && (
                              <span className="text-xs text-zinc-400">by {comp.finish}</span>
                            )}
                            {comp.event && (
                              <span className="text-xs text-zinc-400">🏟 {comp.event}</span>
                            )}
                          </div>
                        )}
                        {roll && (
                          <p className="text-xs text-emerald-400/80 mt-1">
                            {formatRollBadge(roll)}
                          </p>
                        )}
                        {userNotes &&
                          (expandedNotes.has(entry.id) || userNotes.length <= 80 ? (
                            <div>
                              <p className="text-zinc-300 text-sm mt-1">{userNotes}</p>
                              {userNotes.length > 80 && (
                                <button
                                  onClick={() =>
                                    setExpandedNotes((prev) => {
                                      const s = new Set(prev);
                                      s.delete(entry.id);
                                      return s;
                                    })
                                  }
                                  className="text-xs text-zinc-400 hover:text-zinc-300 mt-0.5"
                                >
                                  {t("training.collapse")}
                                </button>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="text-zinc-300 text-sm mt-1">
                                {userNotes.slice(0, 80)}…
                              </p>
                              <button
                                onClick={() =>
                                  setExpandedNotes((prev) => new Set([...prev, entry.id]))
                                }
                                className="text-xs text-zinc-400 hover:text-zinc-300 mt-0.5"
                              >
                                {t("training.showMore")}
                              </button>
                            </div>
                          ))}
                      </>
                    );
                  })()}
              </div>
            )}
          </SwipeableCard>
        ))}
        {/* Pagination — shown only when there are multiple pages */}
        {totalPages > 1 && (
          <div className="border-t border-white/5 pt-4 pb-2 mt-2">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1 || pageLoading}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors active:scale-95"
                aria-label="Previous page"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {t("training.prev")}
              </button>

              <span className="text-xs text-zinc-500 tabular-nums">
                {pageLoading ? (
                  <svg className="w-4 h-4 animate-spin mx-auto" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  `${page} / ${totalPages}`
                )}
              </span>

              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages || pageLoading}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors active:scale-95"
                aria-label="Next page"
              >
                {t("training.next")}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
});

export default TrainingLogList;
