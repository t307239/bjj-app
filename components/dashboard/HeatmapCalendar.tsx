"use client";

import { useMemo } from "react";

/**
 * HeatmapCalendar — GitHub-style contribution calendar for training activity.
 * Shows last 16 weeks (112 days) of training in a compact grid.
 * Each cell = 1 day. Green intensity based on training count per day.
 */

type Props = {
  /** Array of date strings (YYYY-MM-DD) for all training logs in the period */
  trainingDates: string[];
  t: (key: string, vars?: Record<string, string | number>) => string;
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

export default function HeatmapCalendar({ trainingDates, t }: Props) {
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
  const isJa = t("nav.home") === "ホーム";
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

      {/* Month labels row */}
      <div className="flex gap-[3px] mb-1 ml-0">
        {monthMarkers.map((m, i) => {
          const nextCol = monthMarkers[i + 1]?.col ?? WEEKS;
          const span = nextCol - m.col;
          return (
            <span
              key={`${m.col}-${m.label}`}
              className="text-[10px] text-zinc-500 leading-none"
              style={{ width: `${span * 13 + (span - 1) * 3}px`, flexShrink: 0 }}
            >
              {m.label}
            </span>
          );
        })}
      </div>

      {/* Grid: 7 rows (Mon-Sun) × WEEKS cols */}
      <div className="flex flex-col gap-[3px]">
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-[3px]">
            {row.map((dateStr) => {
              if (!dateStr) return <div key={`empty-${rowIdx}`} className="w-[13px] h-[13px]" />;
              const count = countMap.get(dateStr) ?? 0;
              return (
                <div
                  key={dateStr}
                  className={`w-[13px] h-[13px] rounded-[3px] ${getIntensityClass(count)} transition-colors`}
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
        <div className="w-[10px] h-[10px] rounded-[2px] bg-zinc-800/60" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-900/80" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-700/80" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-500/80" />
        <span className="text-[10px] text-zinc-500">{t("home.heatmapMore")}</span>
      </div>
    </div>
  );
}
