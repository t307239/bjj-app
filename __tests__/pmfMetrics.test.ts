/**
 * pmfMetrics.test.ts — z255kk: PMF metrics helper functions
 */
import { describe, it, expect } from "vitest";
import {
  countSignupsLastDays,
  calcSignupWow,
  calcD7Retention,
  calcSourceBreakdown,
  calcWeeklyActiveTrend,
  type SignupCohort,
} from "@/lib/adminMetrics";

const NOW = new Date("2026-05-06T00:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86400000).toISOString();
const dateAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86400000).toISOString().split("T")[0];

describe("countSignupsLastDays", () => {
  const cohorts: SignupCohort[] = [
    { user_id: "u1", created_at: daysAgo(2) },
    { user_id: "u2", created_at: daysAgo(5) },
    { user_id: "u3", created_at: daysAgo(10) },
    { user_id: "u4", created_at: daysAgo(45) },
  ];

  it("counts last 7 days", () => {
    expect(countSignupsLastDays(cohorts, 7, NOW)).toBe(2);
  });
  it("counts last 30 days", () => {
    expect(countSignupsLastDays(cohorts, 30, NOW)).toBe(3);
  });
  it("counts last 90 days includes all", () => {
    expect(countSignupsLastDays(cohorts, 90, NOW)).toBe(4);
  });
  it("returns 0 for empty cohorts", () => {
    expect(countSignupsLastDays([], 30, NOW)).toBe(0);
  });
});

describe("calcSignupWow", () => {
  it("calculates positive WoW", () => {
    // 4 in last 7d, 2 in prev 7d → +100%
    const cohorts: SignupCohort[] = [
      { user_id: "u1", created_at: daysAgo(1) },
      { user_id: "u2", created_at: daysAgo(2) },
      { user_id: "u3", created_at: daysAgo(3) },
      { user_id: "u4", created_at: daysAgo(6) },
      { user_id: "u5", created_at: daysAgo(8) },
      { user_id: "u6", created_at: daysAgo(12) },
    ];
    expect(calcSignupWow(cohorts, NOW)).toBe(100);
  });
  it("returns 100 when prev=0 and last>0", () => {
    const cohorts: SignupCohort[] = [
      { user_id: "u1", created_at: daysAgo(2) },
    ];
    expect(calcSignupWow(cohorts, NOW)).toBe(100);
  });
  it("returns 0 when both periods empty", () => {
    expect(calcSignupWow([], NOW)).toBe(0);
  });
  it("calculates negative WoW", () => {
    // 1 in last 7d, 4 in prev 7d → -75%
    const cohorts: SignupCohort[] = [
      { user_id: "u1", created_at: daysAgo(2) },
      { user_id: "u2", created_at: daysAgo(8) },
      { user_id: "u3", created_at: daysAgo(9) },
      { user_id: "u4", created_at: daysAgo(10) },
      { user_id: "u5", created_at: daysAgo(13) },
    ];
    expect(calcSignupWow(cohorts, NOW)).toBe(-75);
  });
});

describe("calcD7Retention", () => {
  it("returns 0/0 when no eligible cohort", () => {
    const cohorts: SignupCohort[] = [
      { user_id: "u1", created_at: daysAgo(2) }, // too recent
    ];
    const r = calcD7Retention(cohorts, [], NOW);
    expect(r).toEqual({ percent: 0, cohort_size: 0 });
  });

  it("calculates retention for eligible cohort with logs", () => {
    const cohorts: SignupCohort[] = [
      { user_id: "u1", created_at: daysAgo(15) }, // eligible
      { user_id: "u2", created_at: daysAgo(20) }, // eligible
      { user_id: "u3", created_at: daysAgo(28) }, // eligible
    ];
    // u1 logged within 7 days of signup, u2 didn't, u3 did
    const logs = [
      { user_id: "u1", date: dateAgo(13) }, // 2 days after signup ✅
      { user_id: "u3", date: dateAgo(25) }, // 3 days after signup ✅
      { user_id: "u2", date: dateAgo(5) }, // way after 7-day window ❌
    ];
    const r = calcD7Retention(cohorts, logs, NOW);
    expect(r.cohort_size).toBe(3);
    expect(r.percent).toBeCloseTo(66.7, 1); // 2/3
  });

  it("excludes users who signed up < 7 days ago", () => {
    const cohorts: SignupCohort[] = [
      { user_id: "u1", created_at: daysAgo(3) }, // too recent
    ];
    const r = calcD7Retention(
      cohorts,
      [{ user_id: "u1", date: dateAgo(2) }],
      NOW
    );
    expect(r.cohort_size).toBe(0);
  });
});

describe("calcSourceBreakdown", () => {
  it("aggregates signup_source, falls back to paid_ref then 'direct'", () => {
    const cohorts: SignupCohort[] = [
      { user_id: "u1", created_at: daysAgo(5), signup_source: "wiki" },
      { user_id: "u2", created_at: daysAgo(10), signup_source: "wiki" },
      { user_id: "u3", created_at: daysAgo(20), signup_source: null, paid_ref: "twitter" },
      { user_id: "u4", created_at: daysAgo(30), signup_source: null, paid_ref: null },
      { user_id: "u5", created_at: daysAgo(100), signup_source: "wiki" }, // outside 90d
    ];
    const r = calcSourceBreakdown(cohorts, NOW);
    expect(r).toEqual({ wiki: 2, twitter: 1, direct: 1 });
  });

  it("returns empty for no recent signups", () => {
    expect(calcSourceBreakdown([], NOW)).toEqual({});
  });
});

describe("calcWeeklyActiveTrend", () => {
  it("returns 4 weeks of unique-user counts (oldest first)", () => {
    // Window mapping (with weekOffset = 3,2,1,0):
    // trend[0] = week -28..-21 (oldest)
    // trend[1] = week -21..-14
    // trend[2] = week -14..-7
    // trend[3] = week -7..0 (current)
    const logs = [
      // trend[1] (-21..-14): u1, u2
      { user_id: "u1", date: dateAgo(18) },
      { user_id: "u2", date: dateAgo(16) },
      // trend[2] (-14..-7): u1, u3
      { user_id: "u1", date: dateAgo(12) },
      { user_id: "u3", date: dateAgo(10) },
      // trend[3] (-7..0): u4
      { user_id: "u4", date: dateAgo(3) },
    ];
    const trend = calcWeeklyActiveTrend(logs, NOW);
    expect(trend).toHaveLength(4);
    expect(trend[0]).toBe(0); // oldest week (-28..-21): no logs
    expect(trend[1]).toBe(2); // (-21..-14): u1, u2
    expect(trend[2]).toBe(2); // (-14..-7): u1, u3
    expect(trend[3]).toBe(1); // current (-7..0): u4
  });

  it("returns [0,0,0,0] for empty logs", () => {
    expect(calcWeeklyActiveTrend([], NOW)).toEqual([0, 0, 0, 0]);
  });
});
