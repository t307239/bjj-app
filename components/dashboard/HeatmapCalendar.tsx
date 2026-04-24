"use client";

import { useMemo, memo } from "react";
import Link from "next/link";
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
// pt-BR の短縮月名（JA/EN と同じ配列構造、locale drift 防止）
const MONTH_LABELS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

/** Mobile: last 7 days bar chart view */
function WeekBarChart({ countMap, locale }: { countMap: Map<string, number>; locale: string }) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10);
  const todayMs = new Date(todayStr + "T00:00:00Z").getTime();

  const days: { date: string; count: number; label: string }[] = [];
  const dayLabelsEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayLabelsJa = ["日", "月", "火", "水", "木", "金", "土"];
  // pt-BR の短縮曜日名（日曜始まり）。locale drift 防止で 3 言語すべて対応。
  const dayLabelsPt = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const labels =
    locale === "ja" ? dayLabelsJa : locale === "pt" ? dayLabelsPt : dayLabelsEn;

  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayMs - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const dayIdx = d.getUTCDay();
    days.push({ date: dateStr, count: countMap.get(dateStr) ?? 0, label: labels[dayIdx] });
  }

  const maxCount = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="flex items-end gap-2 h-16">
      {days.map((d) => {
        const height = d.count > 0 ? Math.max(20, (d.count / maxCount) * 100) : 8;
        const isToday = d.date === todayStr;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <span className={`text-[10px] tabular-nums ${d.count > 0 ? "text-emerald-400" : "text-zinc-600"}`}>
              {d.count > 0 ? d.count : ""}
            </span>
            <div
              className={`w-full rounded-t-sm transition-all ${
                d.count === 0 ? "bg-zinc-800/60" : d.count >= 2 ? "bg-emerald-500/80" : "bg-emerald-700/80"
              }`}
              style={{ height: `${height}%` }}
            />
            <span className={`text-[10px] ${isToday ? "text-white font-semibold" : "text-zinc-500"}`}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const HeatmapCalendar = memo(function HeatmapCalendar({ trainingDates }: Props) {
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
  // locale drift 防止: JA/EN/PT 3 言語すべてに対応（PT 欠落で EN にフォールバック
  // していた旧実装を修正）
  const labels =
    locale === "ja"
      ? MONTH_LABELS_JA
      : locale === "pt"
        ? MONTH_LABELS_PT
        : MONTH_LABELS_EN;
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
    <div className="bg-zinc-900/40 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl px-4 py-3.5 mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-medium text-zinc-400">
          {t("home.heatmapTitle")}
        </span>
        <Link
          href="/records?tab=stats"
          className="text-xs text-zinc-500 tabular-nums hover:text-zinc-300 transition-colors"
        >
          {t("home.heatmapDays", { n: totalDaysInPeriod })}
          <span className="ml-1 text-zinc-600">›</span>
        </Link>
      </div>

      {/* Mobile: 7-day bar chart (< sm) */}
      <div className="sm:hidden">
        <WeekBarChart countMap={countMap} locale={locale} />
      </div>

      {/* Desktop: full 16-week heatmap grid (>= sm) */}
      <div className="hidden sm:block max-w-[480px]">
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

        {/* Grid: 7 rows (Sun-Sat) × WEEKS cols */}
        <div className="flex flex-col gap-1">
          {grid.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1">
              {row.map((dateStr) => {
                if (!dateStr) return <div key={`empty-${rowIdx}`} className="flex-1 aspect-square" />;
                const count = countMap.get(dateStr) ?? 0;
                return (
                  <div
                    key={dateStr}
                    className={`flex-1 aspect-square rounded-[3px] ${getIntensityClass(count)} transition-colors`}
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
          <div className="w-2.5 h-2.5 rounded-[2px] bg-zinc-800/60" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-900/80" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-700/80" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500/80" />
          <span className="text-[10px] text-zinc-500">{t("home.heatmapMore")}</span>
        </div>
      </div>
    </div>
  );
});

export default HeatmapCalendar;
