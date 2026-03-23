"use client";

import { type TrainingEntry, formatDuration } from "@/lib/trainingLogHelpers";

type Props = {
  entries: TrainingEntry[];
  hasMore: boolean;
};

export default function TrainingLogStats({ entries, hasMore }: Props) {
  if (entries.length === 0) return null;

  // This week summary (Monday start)
  const nowForWeek = new Date();
  const dowForWeek = nowForWeek.getDay(); // 0=Sun
  const daysToMon = dowForWeek === 0 ? 6 : dowForWeek - 1;
  const mondayDate = new Date(nowForWeek);
  mondayDate.setDate(nowForWeek.getDate() - daysToMon);
  const thisWeekStart = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, "0")}-${String(mondayDate.getDate()).padStart(2, "0")}`;
  const weekEntries = entries.filter((e) => e.date >= thisWeekStart);
  const weekTotalMins = weekEntries.reduce((sum, e) => sum + e.duration_min, 0);
  const weekHoursDisplay = weekTotalMins >= 60
    ? `${Math.floor(weekTotalMins / 60)}h${weekTotalMins % 60 > 0 ? `${weekTotalMins % 60}m` : ""}`
    : `${weekTotalMins}m`;

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
      {weekEntries.length > 0 && (
        <div className="flex items-center gap-3 mb-1 pb-1">
          <span className="text-[10px] font-semibold text-yellow-400/80 uppercase tracking-wide flex-shrink-0">
            This Week
          </span>
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-yellow-400">{weekEntries.length}</span>
              <span className="text-[10px] text-gray-500">sessions</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-yellow-400/80">{weekHoursDisplay}</span>
              <span className="text-[10px] text-gray-500">total</span>
            </div>
            {weekEntries.length > 0 && (
              <>
                <div className="w-px h-4 bg-white/10" />
                <span className="text-xs text-gray-400">
                  {formatDuration(Math.round(weekTotalMins / weekEntries.length))}/session
                </span>
              </>
            )}
          </div>
        </div>
      )}
      {hasMore && (
        <p className="text-gray-600 text-xs text-center mt-2">
          ※ More data available. Click &ldquo;Load More&rdquo; to update
        </p>
      )}
    </div>
  );
}
