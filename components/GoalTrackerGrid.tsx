"use client";

import { useLocale } from "@/lib/i18n";
import { getLocalDateParts } from "@/lib/timezone";
import type { WeekHistory, MonthHistory } from "./GoalTrackerEditor";

// ── GoalWeekDayGrid ───────────────────────────────────────────────────────────
// Shows Mon–Sun completion dots for the current week.

export function GoalWeekDayGrid({
  currentWeekDayGrid,
}: {
  currentWeekDayGrid: boolean[];
}) {
  const DAY_LABELS = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(2024, 0, 1 + i))
  );
  const dowNow = getLocalDateParts().dayOfWeek; // 0=Sun
  const todayIdx = dowNow === 0 ? 6 : dowNow - 1; // Mon=0...Sun=6

  return (
    <div className="mt-2 flex items-center gap-1">
      {DAY_LABELS.map((label, i) => {
        const isPast = i < todayIdx;
        const isToday = i === todayIdx;
        const isFuture = i > todayIdx;
        const trained = currentWeekDayGrid[i];
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className={`w-full h-5 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                trained
                  ? "bg-green-500/30 border border-green-500/50 text-green-300"
                  : isToday
                  ? "bg-blue-500/20 border border-blue-500/50 text-blue-300"
                  : isPast
                  ? "bg-white/3 border border-dashed border-white/20 text-gray-500"
                  : "bg-transparent text-gray-500"
              }`}
            >
              {trained ? "✓" : isToday ? "•" : ""}
            </div>
            <span className={`text-xs leading-none ${
              isToday ? "text-gray-300 font-semibold" : isFuture ? "text-gray-600" : "text-gray-500"
            }`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── GoalDaysLeftText ──────────────────────────────────────────────────────────
// Shows "X more sessions needed in Y days" hint below weekly progress.

export function GoalDaysLeftText({
  weeklyGoal,
  weekCount,
}: {
  weeklyGoal: number;
  weekCount: number;
}) {
  const { t } = useLocale();
  const dow = getLocalDateParts().dayOfWeek; // 0=Sun
  const daysLeftInWeek = dow === 0 ? 0 : 7 - dow;
  const needed = Math.max(0, weeklyGoal - weekCount);

  if (needed === 0) return (
    <p className="text-xs text-green-400 mt-1.5">
      {weekCount > weeklyGoal
        ? t("goal.extraWeek", { n: weekCount - weeklyGoal })
        : t("goal.weeklyClear")}
    </p>
  );
  if (daysLeftInWeek === 0) return (
    <p className="text-xs text-gray-500 mt-1.5">{t("goal.zeroDaysLeft", { n: needed })}</p>
  );
  return (
    <p className="text-xs text-gray-500 mt-1.5">
      {t("goal.moreNeeded", { needed, days: daysLeftInWeek })}
      {needed <= daysLeftInWeek ? t("goal.onTrackSuffix") : t("goal.pickUpPace")}
    </p>
  );
}

// ── GoalWeekHeatmap ───────────────────────────────────────────────────────────
// Shows 4-week achievement heatmap below the weekly section.

export function GoalWeekHeatmap({
  weekHistory,
  consecutiveAchievedWeeks,
}: {
  weekHistory: WeekHistory[];
  consecutiveAchievedWeeks: number;
}) {
  const { t } = useLocale();
  if (weekHistory.length === 0) return null;

  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-1.5">
        {weekHistory.map((w) => (
          <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className={`w-full h-6 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                w.isCurrent
                  ? w.achieved
                    ? "bg-green-500/30 border border-green-500/50 text-green-300"
                    : "bg-blue-500/20 border border-blue-500/40 text-blue-300"
                  : w.achieved
                  ? "bg-green-500/25 text-green-400"
                  : "bg-transparent border border-dashed border-white/20 text-gray-500"
              }`}
            >
              {w.achieved ? "✓" : w.count > 0 ? w.count : "-"}
            </div>
            <span className={`text-xs leading-none ${w.isCurrent ? "text-gray-300" : "text-gray-500"}`}>
              {w.isCurrent
                ? t("goal.thisWeek")
                : weekHistory.indexOf(w) === weekHistory.length - 2
                ? t("goal.lastWeek")
                : t("goal.weeksAgo", { n: weekHistory.length - 1 - weekHistory.indexOf(w) })}
            </span>
          </div>
        ))}
      </div>
      {consecutiveAchievedWeeks >= 2 && (
        <div className="mt-1.5 flex justify-center">
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-500/15 border border-green-500/30 text-green-300 px-2 py-0.5 rounded-full">
            {t("goal.weeksInRow", { n: consecutiveAchievedWeeks })}
          </span>
        </div>
      )}
    </div>
  );
}

// ── GoalMonthHistoryBadges ────────────────────────────────────────────────────
// Shows 6-month achievement badge row at the bottom of the goal tracker.

export function GoalMonthHistoryBadges({
  monthHistory,
}: {
  monthHistory: MonthHistory[];
}) {
  const { t } = useLocale();
  if (monthHistory.length === 0) return null;

  return (
    <div className="border-t border-white/10 px-4 py-3">
      <p className="text-xs text-gray-500 mb-2 tracking-wider">{t("goal.past6Months")}</p>
      <div className="flex items-end justify-between gap-1">
        {monthHistory.map((m) => (
          <div key={m.ym} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                m.achieved
                  ? "bg-green-500 text-white shadow-sm shadow-green-500/40"
                  : "border border-dashed border-white/20 text-gray-500"
              }`}
            >
              {m.achieved ? "✓" : m.count}
            </div>
            <span className={`text-xs ${m.achieved ? "text-green-400" : "text-gray-500"}`}>
              {m.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">
        {t("goal.monthsAchieved", { n: monthHistory.filter((m) => m.achieved).length })}
      </p>
    </div>
  );
}
