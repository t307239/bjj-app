/**
 * Q-19: Unit tests for timezone utilities.
 * All functions are pure (Intl-based) and take an explicit TZ parameter.
 */
import { describe, it, expect } from "vitest";
import {
  getLocalDateString,
  getLocalDateParts,
  getWeekStartDate,
  getMonthStartDate,
  utcIsoToLocalDateString,
  getYesterdayDateString,
} from "@/lib/timezone";

// ─── getLocalDateString ─────────────────────────────────────────────────────
describe("getLocalDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = getLocalDateString("UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles Asia/Tokyo timezone", () => {
    const result = getLocalDateString("Asia/Tokyo");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles America/Sao_Paulo timezone", () => {
    const result = getLocalDateString("America/Sao_Paulo");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── getLocalDateParts ──────────────────────────────────────────────────────
describe("getLocalDateParts", () => {
  it("returns valid date parts", () => {
    const parts = getLocalDateParts("UTC");
    expect(parts.year).toBeGreaterThan(2020);
    expect(parts.month).toBeGreaterThanOrEqual(1);
    expect(parts.month).toBeLessThanOrEqual(12);
    expect(parts.day).toBeGreaterThanOrEqual(1);
    expect(parts.day).toBeLessThanOrEqual(31);
    expect(parts.dayOfWeek).toBeGreaterThanOrEqual(0);
    expect(parts.dayOfWeek).toBeLessThanOrEqual(6);
    expect(parts.daysInMonth).toBeGreaterThanOrEqual(28);
    expect(parts.daysInMonth).toBeLessThanOrEqual(31);
  });

  it("returns consistent month and daysInMonth", () => {
    const parts = getLocalDateParts("UTC");
    // Feb: 28 or 29, Apr/Jun/Sep/Nov: 30, others: 31
    const daysMap: Record<number, number[]> = {
      1: [31], 2: [28, 29], 3: [31], 4: [30], 5: [31], 6: [30],
      7: [31], 8: [31], 9: [30], 10: [31], 11: [30], 12: [31],
    };
    expect(daysMap[parts.month]).toContain(parts.daysInMonth);
  });
});

// ─── getWeekStartDate ───────────────────────────────────────────────────────
describe("getWeekStartDate", () => {
  it("returns a Monday (YYYY-MM-DD format)", () => {
    const result = getWeekStartDate("UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Verify it's actually a Monday
    const date = new Date(result + "T12:00:00Z");
    expect(date.getUTCDay()).toBe(1); // Monday = 1
  });

  it("returns same or earlier date than today", () => {
    const today = getLocalDateString("UTC");
    const weekStart = getWeekStartDate("UTC");
    expect(weekStart <= today).toBe(true);
  });
});

// ─── getMonthStartDate ──────────────────────────────────────────────────────
describe("getMonthStartDate", () => {
  it("returns first day of month", () => {
    const result = getMonthStartDate("UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

// ─── utcIsoToLocalDateString ────────────────────────────────────────────────
describe("utcIsoToLocalDateString", () => {
  it("converts UTC midnight to correct local date in Tokyo", () => {
    // 2026-03-15 00:00 UTC = 2026-03-15 09:00 JST (same date)
    const result = utcIsoToLocalDateString("2026-03-15T00:00:00Z", "Asia/Tokyo");
    expect(result).toBe("2026-03-15");
  });

  it("handles date boundary crossing (UTC late night → next day in Tokyo)", () => {
    // 2026-03-15 20:00 UTC = 2026-03-16 05:00 JST (next date)
    const result = utcIsoToLocalDateString("2026-03-15T20:00:00Z", "Asia/Tokyo");
    expect(result).toBe("2026-03-16");
  });

  it("handles date boundary crossing (UTC early morning → previous day in NYC)", () => {
    // 2026-03-16 03:00 UTC = 2026-03-15 23:00 EST (previous date)
    const result = utcIsoToLocalDateString("2026-03-16T03:00:00Z", "America/New_York");
    expect(result).toBe("2026-03-15");
  });
});

// ─── getYesterdayDateString ─────────────────────────────────────────────────
describe("getYesterdayDateString", () => {
  it("returns a date one day before today", () => {
    const today = getLocalDateString("UTC");
    const yesterday = getYesterdayDateString("UTC");

    const todayDate = new Date(today + "T12:00:00Z");
    const yesterdayDate = new Date(yesterday + "T12:00:00Z");
    const diffMs = todayDate.getTime() - yesterdayDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    expect(diffDays).toBe(1);
  });
});
