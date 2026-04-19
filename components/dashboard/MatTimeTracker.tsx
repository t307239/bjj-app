/**
 * Milestone-based Mat Time Tracker
 * Shows cumulative training hours toward the NEXT achievable milestone.
 * Milestones: 10h → 50h → 100h → 500h → 1,000h → 5,000h → 10,000h
 */

import { formatNumber } from "@/lib/formatDate";
import type { Locale } from "@/lib/i18n";

type Props = {
  totalMinutes: number;
  /** Average minutes per week (based on recent data) — used for ETA */
  weeklyAvgMinutes: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale?: Locale;
};

const MILESTONES = [10, 50, 100, 500, 1000, 5000, 10000];

function getNextMilestone(hours: number): number {
  for (const ms of MILESTONES) {
    if (hours < ms) return ms;
  }
  return MILESTONES[MILESTONES.length - 1];
}

export default function MatTimeTracker({ totalMinutes, weeklyAvgMinutes, t, locale = "en" }: Props) {
  if (totalMinutes <= 0) return null;

  const totalHours = totalMinutes / 60;
  const target = getNextMilestone(totalHours);
  const reachedAll = totalHours >= MILESTONES[MILESTONES.length - 1];

  // Progress within current milestone segment
  const prevMilestone = MILESTONES.filter((ms) => ms <= totalHours).pop() ?? 0;
  const segmentTotal = target - prevMilestone;
  const segmentProgress = totalHours - prevMilestone;
  const percent = reachedAll ? 100 : Math.min((segmentProgress / segmentTotal) * 100, 100);

  // Format hours display — locale-aware number formatting
  const displayHours = totalHours >= 100
    ? formatNumber(Math.round(totalHours), locale)
    : totalHours.toFixed(1);

  // ETA to next milestone
  const remainingMinutes = (target * 60) - totalMinutes;
  let etaText = "";
  if (reachedAll || remainingMinutes <= 0) {
    etaText = t("matTime.reached");
  } else if (weeklyAvgMinutes > 0) {
    const weeksRemaining = remainingMinutes / weeklyAvgMinutes;
    if (weeksRemaining >= 52) {
      const years = Math.round((weeksRemaining / 52) * 10) / 10;
      etaText = t("matTime.etaYears", { n: years });
    } else if (weeksRemaining >= 8) {
      const months = Math.round(weeksRemaining / 4.33);
      etaText = t("matTime.etaMonths", { n: months });
    } else {
      const weeks = Math.max(1, Math.round(weeksRemaining));
      etaText = t("matTime.etaWeeks", { n: weeks });
    }
  }

  // Visual milestone markers on the bar (show passed milestones within segment)
  const visibleMarkers = MILESTONES.filter(
    (ms) => ms > prevMilestone && ms < target
  );

  return (
    <div className="mb-5 bg-zinc-900/40 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">⏱️</span>
        <h3 className="text-sm font-bold text-zinc-200">
          {t("matTime.title")}
        </h3>
      </div>

      {/* Main stat */}
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-2xl font-bold text-white whitespace-nowrap">
          {displayHours}
        </span>
        <span className="text-sm text-zinc-400 whitespace-nowrap">
          {t("matTime.hoursUnit")}
        </span>
        <span className="text-xs text-zinc-600 ml-auto whitespace-nowrap">
          {reachedAll ? "🏆" : t("matTime.nextMilestone", { target: formatNumber(target, locale) })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(percent, 2)}%`,
            background: reachedAll
              ? "linear-gradient(90deg, #10B981, #06D6A0)"
              : "linear-gradient(90deg, #3B82F6, #8B5CF6)",
          }}
        />
        {/* Milestone markers within segment */}
        {visibleMarkers.map((ms) => {
          const pos = ((ms - prevMilestone) / segmentTotal) * 100;
          return (
            <div
              key={ms}
              className="absolute top-0 h-full w-px bg-zinc-600/50"
              style={{ left: `${pos}%` }}
            />
          );
        })}
      </div>

      {/* Percentage + ETA */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {percent.toFixed(0)}%
        </span>
        {etaText && (
          <span className="text-xs text-zinc-500">
            {etaText}
          </span>
        )}
      </div>
    </div>
  );
}
