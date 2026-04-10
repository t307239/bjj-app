/**
 * StatusBar — compact 1-line stats overview at top of home screen
 * Replaces HeroCard + BentoStatsGrid with a high-density single row.
 */

type Props = {
  weekCount: number;
  monthCount: number;
  streak: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export default function StatusBar({ weekCount, monthCount, streak, t }: Props) {
  return (
    <div className="bg-zinc-900/60 border border-white/[0.08] rounded-2xl px-4 py-3.5 mb-5">
      <div className="flex items-center justify-between gap-3">
        {/* Week sessions */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white tabular-nums">
            {t("home.weekSessions", { n: weekCount })}
          </span>
          <span className="w-px h-3.5 bg-white/10" />
          <span className="text-sm font-semibold text-white tabular-nums">
            {t("home.monthSessions", { n: monthCount })}
          </span>
        </div>

        {/* Streak */}
        <span
          className={`text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full ${
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
    </div>
  );
}
