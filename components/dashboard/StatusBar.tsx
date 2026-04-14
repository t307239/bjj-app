/**
 * StatusBar — compact 2-row stats overview at top of home screen.
 * Row 1: week / month sessions + streak badge
 * Row 2: total session count + BJJ duration (muted secondary info)
 */

type Props = {
  weekCount: number;
  monthCount: number;
  streak: number;
  totalCount: number;
  bjjDuration: string | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export default function StatusBar({
  weekCount,
  monthCount,
  streak,
  totalCount,
  bjjDuration,
  t,
}: Props) {
  return (
    <div className="bg-zinc-900/60 border border-white/[0.08] rounded-2xl px-4 py-3.5 mb-5">
      {/* Row 1: Primary stats */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white tabular-nums whitespace-nowrap">
            {t("home.weekSessions", { n: weekCount })}
          </span>
          <span className="w-px h-3.5 bg-white/10" />
          <span className="text-sm font-semibold text-white tabular-nums whitespace-nowrap">
            {t("home.monthSessions", { n: monthCount })}
          </span>
        </div>

        {/* Streak badge */}
        <span
          className={`text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full whitespace-nowrap ${
            streak >= 7
              ? "text-orange-400 bg-orange-500/10 border border-orange-500/20"
              : streak >= 1
                ? "text-yellow-400 bg-yellow-500/10 border border-yellow-500/20"
                : "text-zinc-500 bg-zinc-800 border border-white/5"
          }`}
        >
          {streak > 0
            ? t("home.streakDays", { n: streak })
            : t("home.streakZero")}
        </span>
      </div>

      {/* Row 2: Secondary stats (total + BJJ duration) */}
      {(totalCount > 0 || bjjDuration) && (
        <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500">
          {totalCount > 0 && (
            <span className="tabular-nums whitespace-nowrap">
              {t("home.totalSessions", { n: totalCount })}
            </span>
          )}
          {totalCount > 0 && bjjDuration && (
            <span className="w-px h-3 bg-white/10" />
          )}
          {bjjDuration && (
            <span className="whitespace-nowrap">
              {t("home.bjjDuration", { duration: bjjDuration })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
