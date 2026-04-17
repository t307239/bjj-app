/**
 * Tests for Q-167: cohortAnalyzer (Retention 93→94)
 */
import { describe, it, expect } from "vitest";

describe("Q-167: cohortAnalyzer", () => {
  it("dateToPeriodKey and daysBetween", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    // Month key
    expect(m.dateToPeriodKey("2026-01-15", "month")).toBe("2026-01");
    expect(m.dateToPeriodKey("2026-12-31", "month")).toBe("2026-12");

    // Week key
    const weekKey = m.dateToPeriodKey("2026-01-15", "week");
    expect(weekKey).toMatch(/^2026-W\d{2}$/);

    // daysBetween
    expect(m.daysBetween("2026-01-01", "2026-01-10")).toBe(9);
    expect(m.daysBetween("2026-01-10", "2026-01-01")).toBe(9); // absolute
    expect(m.daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("RETENTION_DAYS and RETENTION_THRESHOLDS", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    expect(m.RETENTION_DAYS).toContain(7);
    expect(m.RETENTION_DAYS).toContain(30);
    expect(m.RETENTION_THRESHOLDS.strong).toBe(40);
    expect(m.RETENTION_THRESHOLDS.moderate).toBe(20);
  });

  it("INTERVENTION_TEMPLATES", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    expect(m.INTERVENTION_TEMPLATES.day1_drop.type).toBe("onboarding");
    expect(m.INTERVENTION_TEMPLATES.month2_drop.type).toBe("reactivation");
    expect(Object.keys(m.INTERVENTION_TEMPLATES).length).toBeGreaterThanOrEqual(5);
  });

  it("buildCohortMatrix: empty input", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    const matrix = m.buildCohortMatrix([], "month");
    expect(matrix.cohorts).toEqual([]);
    expect(matrix.totalUsers).toBe(0);
  });

  it("buildCohortMatrix: single cohort", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    const users = [
      { userId: "u1", signupDate: "2026-01-01", activityDates: ["2026-01-08", "2026-01-15", "2026-02-01"] },
      { userId: "u2", signupDate: "2026-01-05", activityDates: ["2026-01-12"] },
      { userId: "u3", signupDate: "2026-01-10", activityDates: [] },
    ];

    const matrix = m.buildCohortMatrix(users, "month");
    expect(matrix.cohorts.length).toBe(1);
    expect(matrix.cohorts[0].period).toBe("2026-01");
    expect(matrix.cohorts[0].size).toBe(3);
    expect(matrix.totalUsers).toBe(3);
    expect(matrix.granularity).toBe("month");
    expect(matrix.periodLabels.length).toBeGreaterThan(0);
  });

  it("buildCohortMatrix: multiple cohorts", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    const users = [
      { userId: "u1", signupDate: "2026-01-01", activityDates: ["2026-01-08"] },
      { userId: "u2", signupDate: "2026-02-01", activityDates: ["2026-02-08", "2026-03-01"] },
      { userId: "u3", signupDate: "2026-02-15", activityDates: ["2026-02-22"] },
    ];

    const matrix = m.buildCohortMatrix(users, "month");
    expect(matrix.cohorts.length).toBe(2);
    expect(matrix.cohorts[0].period).toBe("2026-01");
    expect(matrix.cohorts[1].period).toBe("2026-02");
  });

  it("buildCohortMatrix: weekly granularity", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    const users = [
      { userId: "u1", signupDate: "2026-01-01", activityDates: ["2026-01-02", "2026-01-08"] },
    ];

    const matrix = m.buildCohortMatrix(users, "week");
    expect(matrix.granularity).toBe("week");
    expect(matrix.periodLabels[0]).toBe("Day 1");
  });

  it("analyzeCohort: empty matrix", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    const matrix = m.buildCohortMatrix([], "month");
    const analysis = m.analyzeCohort(matrix);
    expect(analysis.bestCohort).toBeNull();
    expect(analysis.worstCohort).toBeNull();
    expect(analysis.health).toBe("weak");
    expect(analysis.overallRetention).toEqual([]);
  });

  it("analyzeCohort: identifies best/worst cohorts", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    // Cohort 1: active users
    // Cohort 2: inactive users
    const users = [
      { userId: "u1", signupDate: "2026-01-01", activityDates: ["2026-01-08", "2026-01-15", "2026-02-01", "2026-03-01", "2026-04-01", "2026-07-01"] },
      { userId: "u2", signupDate: "2026-01-05", activityDates: ["2026-01-12", "2026-01-20", "2026-02-05", "2026-03-05", "2026-04-05", "2026-07-05"] },
      { userId: "u3", signupDate: "2026-02-01", activityDates: [] },
      { userId: "u4", signupDate: "2026-02-05", activityDates: [] },
    ];

    const matrix = m.buildCohortMatrix(users, "month");
    const analysis = m.analyzeCohort(matrix);

    expect(analysis.bestCohort).not.toBeNull();
    expect(analysis.worstCohort).not.toBeNull();
    expect(analysis.bestCohort!.period).toBe("2026-01");
    expect(analysis.overallRetention.length).toBeGreaterThan(0);
    expect(analysis.dropRates.length).toBe(analysis.overallRetention.length - 1);
  });

  it("analyzeCohort: health assessment", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    // All users very active → strong
    const activeUsers = Array.from({ length: 10 }, (_, i) => ({
      userId: `u${i}`,
      signupDate: "2026-01-01",
      activityDates: ["2026-01-08", "2026-01-15", "2026-02-01", "2026-03-01"],
    }));

    const matrix = m.buildCohortMatrix(activeUsers, "month");
    const analysis = m.analyzeCohort(matrix);
    expect(["strong", "moderate"]).toContain(analysis.health);
  });

  it("calculateNDayRetention", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    const users = [
      { userId: "u1", signupDate: "2026-01-01", activityDates: ["2026-01-08"] },
      { userId: "u2", signupDate: "2026-01-01", activityDates: ["2026-01-08"] },
      { userId: "u3", signupDate: "2026-01-01", activityDates: [] },
    ];

    const d7 = m.calculateNDayRetention(users, 7);
    expect(d7).toBeCloseTo(66.7, 0);

    // Empty
    expect(m.calculateNDayRetention([], 7)).toBe(0);
  });

  it("compareCohorts", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    const users = [
      { userId: "u1", signupDate: "2026-01-01", activityDates: ["2026-01-08"] },
      { userId: "u2", signupDate: "2026-02-01", activityDates: [] },
    ];

    const matrix = m.buildCohortMatrix(users, "month");
    const comparison = m.compareCohorts(matrix, "2026-01", "2026-02");
    expect(comparison).not.toBeNull();
    expect(comparison!.differences.length).toBeGreaterThan(0);

    // Non-existent period
    expect(m.compareCohorts(matrix, "2026-01", "2099-01")).toBeNull();
  });

  it("formatCohortMatrix", async () => {
    const m = await import("@/lib/cohortAnalyzer");

    // Empty
    const empty = m.buildCohortMatrix([], "month");
    expect(m.formatCohortMatrix(empty)).toContain("No cohort data");

    // With data
    const users = [
      { userId: "u1", signupDate: "2026-01-01", activityDates: ["2026-01-08"] },
    ];
    const matrix = m.buildCohortMatrix(users, "month");
    const formatted = m.formatCohortMatrix(matrix);
    expect(formatted).toContain("Cohort Retention Matrix");
    expect(formatted).toContain("2026-01");
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("buildCohortMatrix");
    expect(idx).toContain("analyzeCohort");
    expect(idx).toContain("RETENTION_THRESHOLDS");
  });
});
