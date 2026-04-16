"use client";

// ── Shared Types ──────────────────────────────────────────────────────────────

export type GoalData = {
  weeklyGoal: number;
  monthlyGoal: number;
  techniqueGoal: number;
  weekCount: number;
  monthCount: number;
  techniqueCount: number;
};

export type MonthHistory = {
  ym: string;      // "2026-03"
  label: string;   // "Mar"
  count: number;
  achieved: boolean;
};

export type WeekHistory = {
  weekStart: string; // "2026-03-10"
  label: string;     // "This week" / "Last week" / "2 weeks ago" / "3 weeks ago"
  count: number;
  achieved: boolean;
  isCurrent: boolean;
};

// ── ProgressBar ───────────────────────────────────────────────────────────────

export function ProgressBar({
  current,
  target,
  sessionsUnit,
  doneLabel,
}: {
  current: number;
  target: number;
  sessionsUnit: string;
  doneLabel: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const done = current >= target && target > 0;
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-bold ${done ? "text-green-400" : "text-gray-300"}`}>
          {current}{sessionsUnit} / {target}{sessionsUnit}
        </span>
        <span className={`text-xs ${done ? "text-green-400" : "text-zinc-400"}`}>
          {done ? `✓ ${doneLabel}` : `${pct}%`}
        </span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: done
              ? "#4ade80"
              : "linear-gradient(to right, #a78bfa 0%, #f97316 35%, #eab308 65%, #4ade80 100%)",
          }}
        />
      </div>
    </div>
  );
}

// ── GoalEditor ────────────────────────────────────────────────────────────────

export function GoalEditor({
  header,
  currentDoneText,
  sessionsLabel,
  cancelLabel,
  setLabel,
  current,
  value,
  onChange,
  onSave,
  onCancel,
  saving = false,
}: {
  header: string;
  currentDoneText: string;
  sessionsLabel: string;
  cancelLabel: string;
  setLabel: string;
  current: number;
  value: number;
  onChange: (v: number) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="text-xs text-gray-400 mb-3">{header}</div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-9 h-9 rounded-lg bg-white/10 text-white text-lg font-bold hover:bg-white/15 transition-colors"
        >
          -
        </button>
        <div className="flex-1 text-center">
          <span className="text-3xl font-bold text-white">{value}</span>
          <span className="text-gray-400 text-sm ml-1">{sessionsLabel}</span>
        </div>
        <button
          onClick={() => onChange(Math.min(30, value + 1))}
          className="w-9 h-9 rounded-lg bg-white/10 text-white text-lg font-bold hover:bg-white/15 transition-colors"
        >
          +
        </button>
      </div>
      {value > 0 && (
        <div className="text-xs text-zinc-400 text-center mb-3">
          {currentDoneText}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg bg-white/10 text-gray-300 text-sm hover:bg-white/15 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onSave}
          disabled={value === 0 || saving}
          className="flex-1 py-2 rounded-lg bg-[#10B981] text-white text-sm font-semibold hover:bg-[#0d9668] active:scale-95 disabled:opacity-40 transition-all"
        >
          {setLabel}
        </button>
      </div>
    </div>
  );
}
