/**
 * RecentLogs — compact list of 3 most recent training entries for home screen.
 * Shows date, type badge, duration, and notes preview in a single line per entry.
 */
import Link from "next/link";
import { TRAINING_TYPES } from "@/lib/trainingTypes";

type LogEntry = {
  id: string;
  date: string;
  type: string;
  duration_min: number;
  notes: string | null;
};

type Props = {
  logs: LogEntry[];
  weekCount?: number;
  streak?: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const TYPE_COLORS: Record<string, string> = {
  gi: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  nogi: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  drilling: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  competition: "bg-red-500/20 text-red-400 border-red-500/30",
  open_mat: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

function formatDuration(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

const WEEKDAY_KEYS = [
  "home.weekdaySun", "home.weekdayMon", "home.weekdayTue",
  "home.weekdayWed", "home.weekdayThu", "home.weekdayFri", "home.weekdaySat",
];

function formatDate(
  dateStr: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = t(WEEKDAY_KEYS[d.getDay()]);
  return `${month}/${day} ${weekday}`;
}

function getTypeLabel(
  type: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const key = `training.${type}`;
  const translated = t(key);
  // Fallback: if t() returns the key itself (untranslated), use TRAINING_TYPES label
  if (translated === key) {
    const found = TRAINING_TYPES.find((tt) => tt.value === type);
    return found ? found.label : type;
  }
  return translated;
}

/** Extract user-facing notes, stripping competition metadata */
function cleanNotes(raw: string | null): string {
  if (!raw) return "";
  // Strip [COMP:{...}] metadata prefix
  const cleaned = raw.replace(/^\[COMP:\{[^}]*\}\]\s*/i, "");
  return cleaned.trim();
}

export default function RecentLogs({ logs, weekCount = 0, streak = 0, t }: Props) {
  if (logs.length === 0) {
    return (
      <div className="bg-zinc-900/40 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-8 mb-5 text-center">
        {/* Stat-integrated empty state */}
        <div className="text-5xl mb-4">🥋</div>
        <p className="text-white text-base font-bold mb-1.5">
          {t("home.emptyMotivationTitle")}
        </p>
        <p className="text-zinc-400 text-sm mb-5 max-w-[260px] mx-auto leading-relaxed">
          {t("home.emptyWeekStat", { n: weekCount })}
        </p>
        <Link
          href="/records"
          className="inline-flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white text-sm font-bold px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all min-h-[48px]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t("home.emptyCtaRecord")}
        </Link>
        <p className="text-zinc-500 text-xs mt-4">
          {t("home.emptyTip")}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-5">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-white tracking-wide">{t("home.recentTitle")}</h2>
        <Link
          href="/records"
          className="text-xs font-medium text-zinc-500 hover:text-emerald-400 transition-colors"
        >
          {t("home.viewAllRecords")}
        </Link>
      </div>
      <div className="space-y-2">
        {logs.slice(0, 3).map((log) => {
          const typeColor = TYPE_COLORS[log.type] ?? "bg-zinc-700/50 text-zinc-400 border-zinc-600/30";
          const notes = cleanNotes(log.notes);

          return (
            <div
              key={log.id}
              className="bg-zinc-900/40 ring-1 ring-inset ring-white/[0.04] shadow-md shadow-black/30 rounded-xl px-3.5 py-3 flex items-center gap-3 hover:ring-white/[0.08] active:scale-[0.98] transition-all"
            >
              {/* Date */}
              <span className="text-xs text-zinc-500 font-medium tabular-nums whitespace-nowrap w-[72px] flex-shrink-0">
                {formatDate(log.date, t)}
              </span>

              {/* Type badge */}
              <span className={`text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${typeColor}`}>
                {getTypeLabel(log.type, t)}
              </span>

              {/* Duration */}
              <span className="text-xs text-zinc-400 font-medium tabular-nums whitespace-nowrap flex-shrink-0">
                {formatDuration(log.duration_min)}
              </span>

              {/* Notes preview */}
              {notes && (
                <span className="text-xs text-zinc-500 truncate min-w-0 flex-1">
                  {notes}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* View all — mobile: bottom link, desktop: header only */}
      <Link
        href="/records"
        className="flex sm:hidden items-center justify-center gap-1 mt-3 py-2 text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors"
      >
        <span>{t("home.viewAllRecords")}</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
