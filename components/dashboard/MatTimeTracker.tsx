"use client";

/**
 * 10,000 Hour Mat Time Tracker
 * Shows cumulative training hours as a progress bar toward the 10,000-hour mastery milestone.
 * Includes estimated completion date based on recent training pace.
 */

type Props = {
  totalMinutes: number;
  /** Average minutes per week (based on recent data) — used for ETA */
  weeklyAvgMinutes: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const TARGET_HOURS = 10000;
const TARGET_MINUTES = TARGET_HOURS * 60;

export default function MatTimeTracker({ totalMinutes, weeklyAvgMinutes, t }: Props) {
  if (totalMinutes <= 0) return null;

  const totalHours = totalMinutes / 60;
  const percent = Math.min((totalMinutes / TARGET_MINUTES) * 100, 100);

  // Format hours display
  const displayHours = totalHours >= 100
    ? Math.round(totalHours).toLocaleString()
    : totalHours.toFixed(1);

  // ETA calculation
  const remainingMinutes = TARGET_MINUTES - totalMinutes;
  let etaText = "";
  if (remainingMinutes <= 0) {
    etaText = t("matTime.reached");
  } else if (weeklyAvgMinutes > 0) {
    const weeksRemaining = remainingMinutes / weeklyAvgMinutes;
    const yearsRemaining = weeksRemaining / 52;
    if (yearsRemaining >= 1) {
      etaText = t("matTime.etaYears", { n: Math.round(yearsRemaining * 10) / 10 });
    } else {
      const monthsRemaining = Math.round(weeksRemaining / 4.33);
      etaText = t("matTime.etaMonths", { n: monthsRemaining });
    }
  }

  // Milestone markers (percentage positions)
  const milestones = [
    { hours: 100, label: "100h" },
    { hours: 1000, label: "1,000h" },
    { hours: 5000, label: "5,000h" },
    { hours: 10000, label: "10,000h" },
  ];

  return (
    <div className="mb-5 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4">
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
          / {TARGET_HOURS.toLocaleString()}h
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(percent, 1)}%`,
            background: percent >= 100
              ? "linear-gradient(90deg, #10B981, #06D6A0)"
              : "linear-gradient(90deg, #3B82F6, #8B5CF6)",
          }}
        />
        {/* Milestone markers */}
        {milestones.map((ms) => {
          const pos = (ms.hours / TARGET_HOURS) * 100;
          if (pos > 95) return null; // skip 10K marker (it's the end)
          return (
            <div
              key={ms.hours}
              className="absolute top-0 h-full w-px bg-zinc-600/50"
              style={{ left: `${pos}%` }}
            />
          );
        })}
      </div>

      {/* Percentage + ETA */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {percent.toFixed(1)}%
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
