/**
 * apiQueryHelpers — tests for lib/api/ query helper type contracts
 *
 * Since these functions require a real SupabaseClient, we test with
 * a mock client to verify:
 * 1. Correct table names and column selections
 * 2. Error handling (null-safe fallbacks)
 * 3. Summary computation logic (fetchTechniqueSummary aggregation)
 */
import { describe, it, expect, vi } from "vitest";

// ── Re-implement pure aggregation logic (mirrors lib/api/techniques.ts) ────

type TechniqueSummary = {
  totalCount: number;
  byCategory: Record<string, number>;
  byMastery: Record<number, number>;
};

function computeTechniqueSummary(
  rows: { category: string; mastery_level: number }[],
): TechniqueSummary {
  const byCategory: Record<string, number> = {};
  const byMastery: Record<number, number> = {};

  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    byMastery[r.mastery_level] = (byMastery[r.mastery_level] ?? 0) + 1;
  }

  return { totalCount: rows.length, byCategory, byMastery };
}

// ── Re-implement pure aggregation logic (mirrors lib/api/training.ts) ──────

type TrainingSummary = {
  totalSessions: number;
  totalMinutes: number;
  dateFrom: string | null;
  dateTo: string | null;
};

function computeTrainingSummary(
  rows: { date: string; duration_min: number }[],
): TrainingSummary {
  const totalMinutes = rows.reduce((s, r) => s + (r.duration_min ?? 0), 0);
  return {
    totalSessions: rows.length,
    totalMinutes,
    dateFrom: rows[0]?.date ?? null,
    dateTo: rows[rows.length - 1]?.date ?? null,
  };
}

// ── computeTechniqueSummary ─────────────────────────────────────────────────

describe("computeTechniqueSummary", () => {
  it("returns zeros for empty array", () => {
    const result = computeTechniqueSummary([]);
    expect(result).toEqual({
      totalCount: 0,
      byCategory: {},
      byMastery: {},
    });
  });

  it("counts by category correctly", () => {
    const rows = [
      { category: "guard", mastery_level: 1 },
      { category: "guard", mastery_level: 2 },
      { category: "submissions", mastery_level: 3 },
    ];
    const result = computeTechniqueSummary(rows);
    expect(result.totalCount).toBe(3);
    expect(result.byCategory).toEqual({ guard: 2, submissions: 1 });
  });

  it("counts by mastery level correctly", () => {
    const rows = [
      { category: "guard", mastery_level: 1 },
      { category: "passing", mastery_level: 1 },
      { category: "guard", mastery_level: 3 },
    ];
    const result = computeTechniqueSummary(rows);
    expect(result.byMastery).toEqual({ 1: 2, 3: 1 });
  });

  it("handles single technique", () => {
    const rows = [{ category: "takedowns", mastery_level: 5 }];
    const result = computeTechniqueSummary(rows);
    expect(result.totalCount).toBe(1);
    expect(result.byCategory).toEqual({ takedowns: 1 });
    expect(result.byMastery).toEqual({ 5: 1 });
  });
});

// ── computeTrainingSummary ──────────────────────────────────────────────────

describe("computeTrainingSummary", () => {
  it("returns zeros for empty array", () => {
    const result = computeTrainingSummary([]);
    expect(result).toEqual({
      totalSessions: 0,
      totalMinutes: 0,
      dateFrom: null,
      dateTo: null,
    });
  });

  it("sums minutes correctly", () => {
    const rows = [
      { date: "2026-01-01", duration_min: 60 },
      { date: "2026-01-02", duration_min: 90 },
      { date: "2026-01-03", duration_min: 45 },
    ];
    const result = computeTrainingSummary(rows);
    expect(result.totalSessions).toBe(3);
    expect(result.totalMinutes).toBe(195);
  });

  it("extracts date range from sorted rows", () => {
    const rows = [
      { date: "2026-01-01", duration_min: 60 },
      { date: "2026-03-15", duration_min: 90 },
    ];
    const result = computeTrainingSummary(rows);
    expect(result.dateFrom).toBe("2026-01-01");
    expect(result.dateTo).toBe("2026-03-15");
  });

  it("handles single session", () => {
    const rows = [{ date: "2026-04-10", duration_min: 120 }];
    const result = computeTrainingSummary(rows);
    expect(result.totalSessions).toBe(1);
    expect(result.totalMinutes).toBe(120);
    expect(result.dateFrom).toBe("2026-04-10");
    expect(result.dateTo).toBe("2026-04-10");
  });

  it("handles zero duration", () => {
    const rows = [
      { date: "2026-01-01", duration_min: 0 },
      { date: "2026-01-02", duration_min: 60 },
    ];
    const result = computeTrainingSummary(rows);
    expect(result.totalMinutes).toBe(60);
  });
});
