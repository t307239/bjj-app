"use client";

import { memo } from "react";
import { type TrainingEntry, formatDuration } from "@/lib/trainingLogHelpers";
import { getWeekStartDate } from "@/lib/timezone";

type Props = {
  entries: TrainingEntry[];
  totalPages: number;
  page: number;
};

// memo: pure display component — only re-renders when entries/pagination changes
const TrainingLogStats = memo(function TrainingLogStats({ entries, totalPages, page }: Props) {
  if (entries.length === 0) return null;

  // This week summary (Monday start, timezone-aware)
  const thisWeekStart = getWeekStartDate();
  const weekEntries = entries.filter((e) => e.date >= thisWeekStart);
  const weekTotalMins = weekEntries.reduce((sum, e) => sum + e.duration_min, 0);
  const weekHoursDisplay = weekTotalMins >= 60
    ? `${Math.floor(weekTotalMins / 60)}h${weekTotalMins % 60 > 0 ? `${weekTotalMins % 60}m` : ""}`
    : `${weekTotalMins}m`;

  const hasWeekData = weekEntries.length > 0;
  const hasPaginationNote = totalPages > 1 && page < totalPages;
  if (!hasWeekData && !hasPaginationNote) return null;

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
      {weekEntries.length > 0 && (
        <div className="flex items-center gap-3 mb-1 pb-1">
          <span className="text-xs font-semibold text-zinc-400 tracking-wide flex-shrink-0">
            This Week
          </span>
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">{weekEntries.length}</span>
              <span className="text-xs text-gray-500">sessions</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">{weekHoursDisplay}</span>
              <span className="text-xs text-gray-500">total</span>
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
      {totalPages > 1 && page < totalPages && (
        <p className="text-gray-500 text-xs text-center mt-2">
          ※ Stats reflect current page only. Navigate pages to see all sessions.
        </p>
      )}
    </div>
  );
});

export default TrainingLogStats;
