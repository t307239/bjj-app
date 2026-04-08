import Link from "next/link";

type Props = {
  streak: number;
  weekCount: number;
  monthCount: number;
  prevMonthCount: number;
  weeklyGoal: number;
  monthHoursStr: string | null;
  remainingDays: number;
  dayOfMonth: number;
  daysInMonth: number;
  avgSessionMin: number;
  typeBreakdown: Record<string, number>;
  techniqueCount: number;
  recentTechniques: { name: string }[] | null;
  isPro: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export default function BentoStatsGrid({
  streak,
  weekCount,
  monthCount,
  prevMonthCount,
  weeklyGoal,
  monthHoursStr,
  remainingDays,
  dayOfMonth,
  daysInMonth,
  avgSessionMin,
  typeBreakdown,
  techniqueCount,
  recentTechniques,
  isPro,
  t,
}: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">

      {/* Streak — hero */}
      <Link
        href="/profile"
        className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-yellow-400/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200 active:scale-95 group relative"
      >
        <svg className="absolute top-3 right-3 w-3.5 h-3.5 text-zinc-500 group-hover:text-yellow-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
          {t("dashboard.streak")}
        </span>
        <div className="flex items-baseline gap-1 whitespace-nowrap mt-1">
          <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
            {streak}
          </span>
          <span className="text-zinc-400 text-xs mb-0.5">
            {t("dashboard.streakDaysUnit")}
          </span>
        </div>
        <span className="mt-1.5 block text-xs text-yellow-400/80">
          {streak >= 14
            ? t("dashboard.streakCardExcellent")
            : streak >= 7
              ? t("dashboard.streakCardOnARoll")
              : streak >= 3
                ? t("dashboard.streakCardKeepGoing")
                : streak >= 1
                  ? t("dashboard.streakCardKeepRolling")
                  : (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-yellow-400">
                      {t("dashboard.streakCardStart")}
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
        </span>
      </Link>

      {/* This week */}
      <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-emerald-400/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200">
        <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
          {t("dashboard.weekTraining")}
        </span>
        <div className="flex items-baseline gap-1 whitespace-nowrap mt-1">
          <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            {weekCount}
          </span>
          <span className="text-zinc-400 text-xs mb-0.5">
            {t("dashboard.sessionsUnit")}
          </span>
        </div>
        {weeklyGoal > 0 && (
          <span className="mt-1.5 block text-xs text-emerald-400/80">
            {t("dashboard.bentoGoalLabel", {
              done: weekCount,
              goal: weeklyGoal,
            })}
          </span>
        )}
      </div>

      {/* This month — wide */}
      <div className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-emerald-400/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400 tracking-widest">
            {t("dashboard.monthTraining")}
          </span>
          {prevMonthCount > 0 && monthCount > 0 && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                monthCount >= prevMonthCount
                  ? "text-emerald-400 bg-emerald-400/10"
                  : "text-red-400 bg-red-400/10"
              }`}
            >
              {monthCount >= prevMonthCount ? "▲" : "▼"}
              {Math.abs(monthCount - prevMonthCount)}{" "}
              {t("dashboard.bentoVsLastMonth")}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2 whitespace-nowrap mt-2">
          <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            {monthCount}
          </span>
          <span className="text-zinc-400 text-sm">
            {t("dashboard.sessionsUnit")}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {monthHoursStr && (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-medium">
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <circle cx="12" cy="12" r="10" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6l4 2"
                />
              </svg>
              {monthHoursStr}
            </span>
          )}
          {remainingDays > 0 && (
            <span className="text-xs text-zinc-400">
              {t("dashboard.bentoDaysLeft", { n: remainingDays })}
              {monthCount > 0 && dayOfMonth > 0 && (
                <span className="text-emerald-400 ml-1">
                  {t("dashboard.bentoOnPaceFor", {
                    n: Math.round(
                      (monthCount / dayOfMonth) * daysInMonth
                    ),
                  })}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Avg session — col-span-2 */}
      {avgSessionMin > 0 && (
        <div className="col-span-1 md:col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-white/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200">
          <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
            {t("dashboard.bentoAvgSession")}
          </span>
          <div className="flex items-end gap-1 mt-1">
            <span className="text-3xl font-black leading-none tabular-nums bg-gradient-to-r from-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              {avgSessionMin}
            </span>
            <span className="text-zinc-400 text-xs mb-0.5">
              {t("dashboard.bentoMinPerSession")}
            </span>
          </div>
        </div>
      )}

      {/* Training Type Breakdown */}
      {Object.keys(typeBreakdown).length > 1 && monthCount > 2 && (
        <div className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-2">
            {t("dashboard.typeBreakdownTitle")}
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(typeBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const pct = Math.round((count / monthCount) * 100);
                return (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1 bg-zinc-800/80 text-xs text-zinc-300 px-2.5 py-1.5 rounded-lg border border-white/5"
                  >
                    <span className="font-semibold">{type}</span>
                    <span className="text-zinc-500">{pct}%</span>
                  </span>
                );
              })}
          </div>
        </div>
      )}

      {/* Techniques */}
      <Link
        href="/techniques"
        className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-violet-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200 active:scale-95 group"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
              {t("dashboard.techniques")}
            </span>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-3xl font-black leading-none tabular-nums bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">
                {techniqueCount}
              </span>
              <span className="text-zinc-400 text-xs">
                {t("dashboard.loggedUnit")}
              </span>
            </div>
          </div>
          <svg
            className="w-4 h-4 text-zinc-500 group-hover:text-violet-400 transition-colors flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
        {recentTechniques && recentTechniques.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {recentTechniques
              .filter((tech) => tech.name && tech.name.length > 1)
              .slice(0, 2)
              .map((tech) => (
                <span
                  key={tech.name}
                  className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-700 truncate max-w-[120px]"
                >
                  {tech.name}
                </span>
              ))}
          </div>
        )}
      </Link>

      {/* Pro upsell hook cards (free users only) */}
      {!isPro && (
        <>
          {/* 12-Month Training Graph teaser */}
          <Link
            href="/profile#upgrade"
            className="hidden md:block col-span-2 md:col-span-1 relative bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/5 hover:border-amber-400/30 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 to-transparent pointer-events-none" />
            <div className="relative">
              <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
                {t("dashboard.upsellWinRateLabel")}
              </span>
              <p className="text-sm text-zinc-300 mt-1 leading-snug">
                {t("dashboard.upsellGraphDesc")}
              </p>
              <span className="mt-2 block text-xs text-amber-500/80 font-semibold group-hover:text-amber-400 transition-colors">
                {t("dashboard.upsellUpgradeCta")} →
              </span>
            </div>
          </Link>

          {/* Body Management teaser */}
          <Link
            href="/profile"
            className="hidden md:block col-span-2 md:col-span-1 relative bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/5 hover:border-rose-400/30 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-900/10 to-transparent pointer-events-none" />
            <div className="relative">
              <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
                {t("dashboard.upsellInjuryLabel")}
              </span>
              <p className="text-sm text-zinc-300 mt-1 leading-snug">
                {t("dashboard.upsellBodyDesc")}
              </p>
              <span className="mt-2 block text-xs text-rose-500/80 font-semibold group-hover:text-rose-400 transition-colors">
                {t("dashboard.upsellUpgradeCta")} →
              </span>
            </div>
          </Link>
        </>
      )}

    </div>
  );
}
