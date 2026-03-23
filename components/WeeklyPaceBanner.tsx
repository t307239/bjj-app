"use client";

/**
 * WeeklyPaceBanner
 *
 * Shows the user's weekly training pace status:
 * - "🎯 Weekly goal reached!" (green)
 * - "📅 N more sessions needed — on pace" (blue)
 * - "⚡ N more sessions needed — pick up the pace" (yellow)
 *
 * Returns null when weeklyGoal is 0 (goal not set).
 *
 * Extracted from dashboard/page.tsx inline IIFE (CODEREVIEW Day4fo_3b #5).
 */

import { useLocale } from "@/lib/i18n";

interface WeeklyPaceBannerProps {
  weeklyGoal: number;
  weekCount: number;
  daysLeftInWeek: number;
}

export default function WeeklyPaceBanner({
  weeklyGoal,
  weekCount,
  daysLeftInWeek,
}: WeeklyPaceBannerProps) {
  const { t } = useLocale();

  if (weeklyGoal <= 0) return null;

  const needed = Math.max(0, weeklyGoal - weekCount);

  // Goal already reached this week
  if (needed === 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-2.5 flex items-center gap-3">
        <span className="text-lg">🎯</span>
        <div>
          <p className="text-green-400 text-sm font-semibold">{t("dashboard.weeklyGoalReached")}</p>
          <p className="text-gray-400 text-xs">
            {t("dashboard.weeklyGoalDone", { done: weeklyGoal, count: weekCount })}
          </p>
        </div>
      </div>
    );
  }

  const onPace = daysLeftInWeek >= needed;

  return (
    <div
      className={`${
        onPace ? "bg-blue-500/10 border-blue-500/30" : "bg-yellow-500/10 border-yellow-500/30"
      } border rounded-2xl px-4 py-2.5 flex items-center gap-3`}
    >
      <span className="text-lg">{onPace ? "📅" : "⚡"}</span>
      <div className="flex-1">
        <p className={`${onPace ? "text-blue-300" : "text-yellow-300"} text-sm font-semibold`}>
          {needed !== 1
            ? t("dashboard.weeklyMoreSessionsPlural", { n: needed })
            : t("dashboard.weeklyMoreSessions", { n: needed })}
        </p>
        <p className="text-gray-400 text-xs">
          {t("dashboard.weeklyProgressLabel", {
            done: weekCount,
            goal: weeklyGoal,
            days: daysLeftInWeek,
          })}
          {onPace ? t("dashboard.weeklyOnPace") : t("dashboard.weeklyPickUpPace")}
        </p>
      </div>
    </div>
  );
}
