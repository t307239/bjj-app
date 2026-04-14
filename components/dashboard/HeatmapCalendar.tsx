"use client";

import { useMemo } from "react";
import { useLocale } from "@/lib/i18n";

/**
 * HeatmapCalendar — GitHub-style contribution calendar for training activity.
 * Shows last 16 weeks (112 days) of training in a compact grid.
 * Each cell = 1 day. Green intensity based on training count per day.
 */

type Props = {
  /** Array of date strings (YYYY-MM-DD) for all training logs in the period */
  trainingDates: string[];
};

/** Build a map of date → count from training dates */
function buildCountMap(dates: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of dates) {
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return map;
}

/** Generate array of dates for last N weeks ending today (JST) */
function generateDateGrid(weeks: number): string[] {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = now.toISOString().slice(0, 10);
  const todayDate = new Date(today + "T00:00:00Z");
  const dayOfWeek = todayDate.getUTCDay(); // 0=Sun

  // End of grid is today, start from (weeks * 7 - (6 - dayOfWeek)) days ago
  // We want the grid to end on today's column
  const totalDays = weeks * 7;
  const endOffset = 6 - dayOfWeek; // days remaining in current week
  const startMs = todayDate.getTime() - (totalDays - 1 - endOffset) * 86400000;

  const dates: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startMs + i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getIntensityClass(count: number): string {
  if (count === 0) return "bg-zinc-800/60";
  if (count === 1) return "bg-emerald-900/80";
  if (count === 2) return "bg-emerald-700/80";
  return "bg-emerald-500/80"; // 3+
}

const MONTH_LABELS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_LABELS_JA = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

export default function HeatmapCalendar({ trainingDates }: Props) {
  const { t, locale } = useLocale();
  const WEEKS = 16;
  const countMap = useMemo(() => buildCountMap(trainingDates), [trainingDates]);
  const dateGrid = useMemo(() => generateDateGrid(WEEKS), []);

  // Build 7 rows × WEEKS columns (row = day of week, col = week)
  const grid: string[][] = [];
  for (let row = 0; row < 7; row++) {
    grid[row] = [];
    for (let col = 0; col < WEEKS; col++) {
      grid[row][col] = dateGrid[col * 7 + row];
    }
  }

  // Month labels: detect which columns start a new month
  const monthMarkers: { col: number; label: string }[] = [];
  const isJa = locale === "ja";
  const labels = isJa ? MONTH_LABELS_JA : MONTH_LABELS_EN;
  let lastMonth = -1;
  for (let col = 0; col < WEEKS; col++) {
    const firstDateInCol = dateGrid[col * 7]; // Sunday of that week
    if (firstDateInCol) {
      const month = parseInt(firstDateInCol.slice(5, 7), 10) - 1;
      if (month !== lastMonth) {
        monthMarkers.push({ col, label: labels[month] });
        lastMonth = month;
      }
    }
  }

  // Total training days in period
  const totalDaysInPeriod = new Set(trainingDates.filter((d) => dateGrid.includes(d))).size;

  return (
    <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl px-4 py-3.5 mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-medium text-zinc-400">
          {t("home.heatmapTitle")}
        </span>
        <span className="text-xs text-zinc-500 tabular-nums">
          {t("home.heatmapDays", { n: totalDaysInPeriod })}
        </span>
      </div>

      {/* Month labels row — each cell matches a grid column via flex-1 */}
      <div className="flex gap-1 mb-1">
        {Array.from({ length: WEEKS }).map((_, col) => {
          const marker = monthMarkers.find((m) => m.col === col);
          return (
            <span
              key={col}
              className="flex-1 text-[10px] text-zinc-500 leading-none truncate"
            >
              {marker ? marker.label : ""}
            </span>
          );
        })}
      </div>

      {/* Grid: 7 rows (Sun-Sat) × WEEKS cols — responsive full-width */}
      <div className="flex flex-col gap-1">
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-1">
            {row.map((dateStr) => {
              if (!dateStr) return <div key={`empty-${rowIdx}`} className="flex-1 aspect-square" />;
              const count = countMap.get(dateStr) ?? 0;
              return (
                <div
                  key={dateStr}
                  className={`flex-1 aspect-square rounded-[3px] sm:rounded ${getIntensityClass(count)} transition-colors`}
                  title={`${dateStr}: ${count} ${count === 1 ? "session" : "sessions"}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-2.5">
        <span className="text-[10px] text-zinc-500">{t("home.heatmapLess")}</span>
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[2px] bg-zinc-800/60" />
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[2px] bg-emerald-900/80" />
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[2px] bg-emerald-700/80" />
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[2px] bg-emerald-500/80" />
        <span className="text-[10px] text-zinc-500">{t("home.heatmapMore")}</span>
      </div>
    </div>
  );
}
