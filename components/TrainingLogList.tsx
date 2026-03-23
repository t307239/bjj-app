"use client";

import { TRAINING_TYPES } from "@/lib/trainingTypes";
import {
  type TrainingEntry,
  type CompData,
  BELT_RANKS,
  RESULT_LABELS,
  decodeCompNotes,
} from "@/lib/trainingLogHelpers";

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 150, 180];

function formatRelativeDate(dateStr: string): string {
  // dateStr is "YYYY-MM-DD" (local date)
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";
  // diff in days
  const [y, m, d] = dateStr.split("-").map(Number);
  const logDate = new Date(y, m - 1, d);
  const diffMs = today.setHours(0, 0, 0, 0) - logDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays < 7) return `${diffDays} days ago`;
  return logDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
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
  const isPreset = DURATION_PRESETS.includes(value);
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">Duration</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {DURATION_PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              value === d
                ? "bg-[#10B981] text-white"
                : "bg-zinc-800 text-gray-400 hover:text-white"
            }`}
          >
            {formatDuration(d)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={1}
          max={480}
          step={1}
          className={`w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border focus:outline-none focus:border-[#7c3aed] ${
            isPreset ? "border-white/10" : "border-[#e94560]"
          }`}
        />
        <span className="text-gray-500 text-xs flex-shrink-0">min</span>
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
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  expandedNotes: Set<string>;
  setExpandedNotes: React.Dispatch<React.SetStateAction<Set<string>>>;
  editCompForm: CompData;
  setEditCompForm: (f: CompData) => void;
  today: string;
  onShowForm: () => void;
};

export default function TrainingLogList({
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
  hasMore,
  loadingMore,
  onLoadMore,
  expandedNotes,
  setExpandedNotes,
  editCompForm,
  setEditCompForm,
  today,
  onShowForm,
}: Props) {
  // ── Loading ──────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block w-6 h-6 border-2 border-white/10 border-t-[#e94560] rounded-full animate-spin mb-2" />
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

  // ── Empty State ──────────────────────────────────────────────────────────
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="text-6xl mb-4 animate-bounce inline-block">🥋</div>
        <p className="text-white font-bold text-lg mb-1">No training logs yet</p>
        <p className="text-gray-400 text-sm mb-2">
          Start your growth journey by logging your first session!
        </p>
        <div className="flex justify-center gap-4 text-xs text-gray-600 mb-6">
          <span>✓ Free to use</span>
          <span>✓ Cloud synced</span>
          <span>✓ Track progress</span>
        </div>
        <button
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50]);
            onShowForm();
          }}
          className="bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white text-sm font-bold py-3 px-8 rounded-full transition-all shadow-lg shadow-[#10B981]/30 animate-pulse hover:animate-none"
        >
          + Log First Session
        </button>
      </div>
    );
  }

  // ── Filter empty result ──────────────────────────────────────────────────
  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        {searchQuery ? `No records match "${searchQuery}"` : "No records match this filter"}
      </div>
    );
  }

  // ── Entry list ───────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-3">
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className={`bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/[0.04] transition-colors duration-150${
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
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] mb-2"
                  />
                  <DurationPicker
                    value={editForm.duration_min}
                    onChange={(v) => setEditForm({ ...editForm, duration_min: v })}
                  />
                </div>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] mb-2"
                >
                  {TRAINING_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {editForm.type === "competition" && (
                  <div className="mb-2 bg-red-500/5 border border-red-500/20 rounded-xl p-2 space-y-1.5">
                    <p className="text-[10px] text-red-400 font-semibold">🏆 Competition Details</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={editCompForm.result}
                        onChange={(e) => setEditCompForm({ ...editCompForm, result: e.target.value })}
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400"
                      >
                        <option value="win">Win 🏆</option>
                        <option value="loss">Loss</option>
                        <option value="draw">Draw</option>
                      </select>
                      <input
                        type="text"
                        value={editCompForm.opponent}
                        onChange={(e) => setEditCompForm({ ...editCompForm, opponent: e.target.value })}
                        placeholder="Opponent"
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400 placeholder-gray-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={editCompForm.finish}
                        onChange={(e) => setEditCompForm({ ...editCompForm, finish: e.target.value })}
                        placeholder="Finish technique"
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400 placeholder-gray-500"
                      />
                      <input
                        type="text"
                        value={editCompForm.event}
                        onChange={(e) => setEditCompForm({ ...editCompForm, event: e.target.value })}
                        placeholder="Event name"
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400 placeholder-gray-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={editCompForm.opponent_rank}
                        onChange={(e) =>
                          setEditCompForm({ ...editCompForm, opponent_rank: e.target.value })
                        }
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400"
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
                        className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400"
                      >
                        <option value="gi">Gi</option>
                        <option value="nogi">No-Gi</option>
                      </select>
                    </div>
                  </div>
                )}
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] resize-none mb-2"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-[#10B981] text-white text-xs font-semibold py-1.5 rounded-lg"
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="px-3 text-gray-400 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* Normal display */
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        TRAINING_TYPES.find((t) => t.value === entry.type)?.color ||
                        "bg-white/10 text-gray-300"
                      }`}
                    >
                      <span>
                        {TRAINING_TYPES.find((t) => t.value === entry.type)?.icon || "🥋"}
                      </span>
                      <span>
                        {TRAINING_TYPES.find((t) => t.value === entry.type)?.label || entry.type}
                      </span>
                    </span>
                    <span className="text-gray-400 text-xs">{formatRelativeDate(entry.date)}</span>
                  </div>
                  <div className="text-[#e94560] text-xs font-medium mb-1">
                    ⏱{" "}
                    {entry.duration_min >= 60
                      ? `${Math.floor(entry.duration_min / 60)}h${
                          entry.duration_min % 60 > 0 ? `${entry.duration_min % 60}m` : ""
                        }`
                      : `${entry.duration_min}m`}
                  </div>
                  {entry.notes &&
                    (() => {
                      const { comp, userNotes } = decodeCompNotes(entry.notes);
                      return (
                        <>
                          {comp && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <span
                                className={`text-xs font-semibold ${
                                  RESULT_LABELS[comp.result]?.color ?? "text-gray-400"
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
                                  {comp.gi_type === "nogi" ? "NoGi" : "Gi"}
                                </span>
                              )}
                              {comp.opponent && (
                                <span className="text-xs text-gray-400">
                                  vs {comp.opponent}
                                  {comp.opponent_rank && (
                                    <span className="ml-1 text-gray-500">
                                      (
                                      {BELT_RANKS.find((b) => b.value === comp.opponent_rank)
                                        ?.label ?? comp.opponent_rank}
                                      )
                                    </span>
                                  )}
                                </span>
                              )}
                              {comp.finish && (
                                <span className="text-xs text-gray-500">by {comp.finish}</span>
                              )}
                              {comp.event && (
                                <span className="text-xs text-gray-500">🏟 {comp.event}</span>
                              )}
                            </div>
                          )}
                          {userNotes &&
                            (expandedNotes.has(entry.id) || userNotes.length <= 80 ? (
                              <div>
                                <p className="text-gray-300 text-sm mt-1">{userNotes}</p>
                                {userNotes.length > 80 && (
                                  <button
                                    onClick={() =>
                                      setExpandedNotes((prev) => {
                                        const s = new Set(prev);
                                        s.delete(entry.id);
                                        return s;
                                      })
                                    }
                                    className="text-[11px] text-gray-600 hover:text-gray-400 mt-0.5"
                                  >
                                    Collapse ▲
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="text-gray-300 text-sm mt-1">
                                  {userNotes.slice(0, 80)}…
                                </p>
                                <button
                                  onClick={() =>
                                    setExpandedNotes((prev) => new Set([...prev, entry.id]))
                                  }
                                  className="text-[11px] text-gray-600 hover:text-gray-400 mt-0.5"
                                >
                                  Show More ▼
                                </button>
                              </div>
                            ))}
                        </>
                      );
                    })()}
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  <button
                    onClick={() => onStartEdit(entry)}
                    className="text-gray-600 hover:text-blue-400 transition-colors p-2 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="text-gray-600 hover:text-red-400 transition-colors p-2 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === entry.id ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="text-blue-400 hover:text-blue-300 text-sm border border-blue-400/30 hover:border-blue-300/50 px-6 py-2 rounded-full transition-colors disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </>
  );
}
