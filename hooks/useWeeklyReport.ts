"use client";

/**
 * useWeeklyReport — Client-side aggregation of training_logs for weekly/monthly report.
 * Groups logs by ISO week (Monday start), computes KPIs, deltas, and rule-based insights.
 * Pro users get 8 weeks of data; free users get a teaser (current week count only).
 */

import { useMemo } from "react";
import { getLocalDateString } from "@/lib/timezone";

export type TrainingType = "gi" | "nogi" | "drilling" | "competition" | "open_mat" | "recovery";

export type WeekBucket = {
  /** ISO week start date (Monday), e.g. "2026-04-06" */
  weekStart: string;
  count: number;
  totalMinutes: number;
  typeDistribution: Record<TrainingType, number>;
};

export type WeeklyReportData = {
  // KPIs
  currentWeekCount: number;
  prevWeekCount: number;
  weekDelta: number;
  currentMonthCount: number;
  prevMonthCount: number;
  monthDelta: number;
  avgMinutesPerSession: number;
  maxConsecutiveDays: number;
  /** Total training minutes for the current week */
  currentWeekTotalMinutes: number;
  /** Total training minutes for the current month */
  currentMonthTotalMinutes: number;
  // Type distribution for current period
  typeDistribution: Record<TrainingType, number>;
  // Weekly trend (up to 8 weeks)
  weeklyTrend: WeekBucket[];
  // Rule-based insights
  insights: string[];
  // Has enough data?
  hasEnoughData: boolean;
};

type LogEntry = {
  date: string;
  type: string;
  duration_min: number | null;
};

const ALL_TYPES: TrainingType[] = ["gi", "nogi", "drilling", "competition", "open_mat", "recovery"];

/** Get Monday of the ISO week for a given date string */
function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Get first day of month for a date string */
function getMonthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

/** Compute max consecutive training days from a sorted array of unique date strings (desc) */
function computeMaxConsecutiveDays(dates: string[]): number {
  if (dates.length === 0) return 0;
  // Sort ascending for consecutive check
  const sorted = [...dates].sort();
  let maxStreak = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00Z").getTime();
    const curr = new Date(sorted[i] + "T00:00:00Z").getTime();
    if (curr - prev === 86400000) {
      current++;
      maxStreak = Math.max(maxStreak, current);
    } else {
      current = 1;
    }
  }
  return maxStreak;
}

export function useWeeklyReport(
  logs: LogEntry[],
  t: (key: string, vars?: Record<string, string | number>) => string,
): WeeklyReportData {
  return useMemo(() => {
    const emptyDist = (): Record<TrainingType, number> =>
      Object.fromEntries(ALL_TYPES.map((tt) => [tt, 0])) as Record<TrainingType, number>;

    if (!logs || logs.length === 0) {
      return {
        currentWeekCount: 0,
        prevWeekCount: 0,
        weekDelta: 0,
        currentMonthCount: 0,
        prevMonthCount: 0,
        monthDelta: 0,
        avgMinutesPerSession: 0,
        maxConsecutiveDays: 0,
        currentWeekTotalMinutes: 0,
        currentMonthTotalMinutes: 0,
        typeDistribution: emptyDist(),
        weeklyTrend: [],
        insights: [],
        hasEnoughData: false,
      };
    }

    // Current date (today) — z160: ユーザー TZ 尊重 (旧 `new Date().toISOString()`
    // は UTC 今日を返すため PT/EN ユーザーの 0:00 UTC 付近で前日扱いになる bug)
    const todayStr = getLocalDateString();
    const currentMonday = getMonday(todayStr);
    const currentMonthStart = getMonthStart(todayStr);

    // Previous week Monday
    const prevMondayDate = new Date(currentMonday + "T00:00:00Z");
    prevMondayDate.setUTCDate(prevMondayDate.getUTCDate() - 7);
    const prevMonday = prevMondayDate.toISOString().slice(0, 10);

    // Previous month start
    const cmParts = currentMonthStart.split("-");
    const cmYear = parseInt(cmParts[0]);
    const cmMonth = parseInt(cmParts[1]);
    const pmMonth = cmMonth === 1 ? 12 : cmMonth - 1;
    const pmYear = cmMonth === 1 ? cmYear - 1 : cmYear;
    const prevMonthStart = `${pmYear}-${String(pmMonth).padStart(2, "0")}-01`;

    // Group by week
    const weekMap = new Map<string, WeekBucket>();
    let currentWeekCount = 0;
    let prevWeekCount = 0;
    let currentMonthCount = 0;
    let prevMonthCount = 0;
    let totalMinutes = 0;
    let sessionsWithDuration = 0;
    let currentWeekTotalMinutes = 0;
    let currentMonthTotalMinutes = 0;
    const allDates = new Set<string>();
    const currentWeekDist = emptyDist();

    for (const log of logs) {
      const monday = getMonday(log.date);
      const monthStart = getMonthStart(log.date);
      const typ = (ALL_TYPES.includes(log.type as TrainingType) ? log.type : "gi") as TrainingType;

      // Week buckets
      if (!weekMap.has(monday)) {
        weekMap.set(monday, {
          weekStart: monday,
          count: 0,
          totalMinutes: 0,
          typeDistribution: emptyDist(),
        });
      }
      const bucket = weekMap.get(monday)!;
      bucket.count++;
      bucket.totalMinutes += log.duration_min ?? 0;
      bucket.typeDistribution[typ]++;

      // Current/prev week
      if (monday === currentMonday) {
        currentWeekCount++;
        currentWeekDist[typ]++;
        currentWeekTotalMinutes += log.duration_min ?? 0;
      } else if (monday === prevMonday) {
        prevWeekCount++;
      }

      // Current/prev month
      if (monthStart === currentMonthStart) {
        currentMonthCount++;
        currentMonthTotalMinutes += log.duration_min ?? 0;
      } else if (monthStart === prevMonthStart) {
        prevMonthCount++;
      }

      // Duration
      if (log.duration_min && log.duration_min > 0) {
        totalMinutes += log.duration_min;
        sessionsWithDuration++;
      }

      allDates.add(log.date);
    }

    // Weekly trend: sort by weekStart descending, take up to 8
    const weeklyTrend = [...weekMap.values()]
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .slice(0, 8)
      .reverse(); // chronological order for chart

    const weekDelta = currentWeekCount - prevWeekCount;
    const monthDelta = currentMonthCount - prevMonthCount;
    const avgMinutesPerSession = sessionsWithDuration > 0 ? Math.round(totalMinutes / sessionsWithDuration) : 0;
    const maxConsecutiveDays = computeMaxConsecutiveDays([...allDates]);

    // At least 2 weeks of data
    const hasEnoughData = weekMap.size >= 2;

    // Rule-based insights
    const insights: string[] = [];
    if (hasEnoughData) {
      // Week delta insight
      if (weekDelta > 0) {
        insights.push(t("report.insightWeekUp", { n: weekDelta }));
      } else if (weekDelta < 0) {
        insights.push(t("report.insightWeekDown", { n: Math.abs(weekDelta) }));
      }

      // Consecutive weeks trend (3+ weeks increasing)
      if (weeklyTrend.length >= 3) {
        const last3 = weeklyTrend.slice(-3);
        if (last3[0].count < last3[1].count && last3[1].count < last3[2].count) {
          insights.push(t("report.insightConsecutiveUp"));
        }
      }

      // Drilling ratio check
      const totalCurrentWeek = currentWeekCount || 1;
      const drillingRatio = currentWeekDist.drilling / totalCurrentWeek;
      if (totalCurrentWeek >= 3 && drillingRatio < 0.15) {
        insights.push(t("report.insightLowDrilling"));
      }

      // Consecutive days achievement
      if (maxConsecutiveDays >= 3) {
        insights.push(t("report.insightStreak", { n: maxConsecutiveDays }));
      }
    }

    return {
      currentWeekCount,
      prevWeekCount,
      weekDelta,
      currentMonthCount,
      prevMonthCount,
      monthDelta,
      avgMinutesPerSession,
      maxConsecutiveDays,
      currentWeekTotalMinutes,
      currentMonthTotalMinutes,
      typeDistribution: currentWeekDist,
      weeklyTrend,
      insights,
      hasEnoughData,
    };
  }, [logs, t]);
}
