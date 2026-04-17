/**
 * __tests__/qualityQ146_149.test.ts
 *
 * Q-146: Retention — gamificationEngine (XP, levels, badges)
 * Q-147: DX — codeHealthDashboard (aggregate scoring)
 * Q-148: Infra — rollbackGuard (deployment rollback decisions)
 * Q-149: Conversion — funnelAnalytics (funnel step tracking)
 */
import { describe, it, expect } from "vitest";

// ── Q-146: Gamification Engine ──────────────────────────────────────────

import {
  calculateXP,
  calculateBadgeXP,
  getLevel,
  checkBadges,
  getEarnedBadges,
  getNextBadges,
  buildGamificationSummary,
  formatGamificationSummary,
  XP_RATES,
  LEVEL_THRESHOLDS,
  LEVEL_TITLES,
  BADGES,
} from "@/lib/gamificationEngine";
import type { UserStats } from "@/lib/gamificationEngine";

const baseStats: UserStats = {
  totalSessions: 0,
  currentStreak: 0,
  longestStreak: 0,
  uniqueTechniques: 0,
  totalMinutes: 0,
  competitionCount: 0,
  daysSinceFirstSession: 0,
  uniquePartners: 0,
};

describe("Q-146: Gamification Engine", () => {
  describe("constants", () => {
    it("XP_RATES has positive values for all activities", () => {
      expect(XP_RATES.perSession).toBeGreaterThan(0);
      expect(XP_RATES.perStreakDay).toBeGreaterThan(0);
      expect(XP_RATES.perTechnique).toBeGreaterThan(0);
      expect(XP_RATES.perCompetition).toBeGreaterThan(0);
      expect(XP_RATES.perHour).toBeGreaterThan(0);
      expect(XP_RATES.perPartner).toBeGreaterThan(0);
    });

    it("LEVEL_THRESHOLDS are ascending", () => {
      for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
        expect(LEVEL_THRESHOLDS[i]).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]);
      }
    });

    it("LEVEL_TITLES matches LEVEL_THRESHOLDS length", () => {
      expect(LEVEL_TITLES.length).toBe(LEVEL_THRESHOLDS.length);
    });

    it("BADGES has entries across multiple categories", () => {
      const categories = new Set(BADGES.map((b) => b.category));
      expect(categories.size).toBeGreaterThanOrEqual(5);
      expect(BADGES.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe("calculateXP", () => {
    it("returns 0 for zero stats", () => {
      expect(calculateXP(baseStats)).toBe(0);
    });

    it("calculates correctly for mixed stats", () => {
      const stats: UserStats = {
        ...baseStats,
        totalSessions: 10,
        longestStreak: 7,
        uniqueTechniques: 5,
        competitionCount: 2,
        totalMinutes: 120,
        uniquePartners: 3,
      };
      const expected =
        10 * XP_RATES.perSession +
        7 * XP_RATES.perStreakDay +
        5 * XP_RATES.perTechnique +
        2 * XP_RATES.perCompetition +
        2 * XP_RATES.perHour +
        3 * XP_RATES.perPartner;
      expect(calculateXP(stats)).toBe(expected);
    });
  });

  describe("calculateBadgeXP", () => {
    it("returns 0 for zero stats", () => {
      expect(calculateBadgeXP(baseStats)).toBe(0);
    });

    it("accumulates badge XP for qualifying stats", () => {
      const stats: UserStats = {
        ...baseStats,
        totalSessions: 100,
        longestStreak: 30,
        uniqueTechniques: 20,
        competitionCount: 5,
        uniquePartners: 5,
        totalMinutes: 6000,
        daysSinceFirstSession: 365,
      };
      const xp = calculateBadgeXP(stats);
      expect(xp).toBeGreaterThan(0);
    });
  });

  describe("getLevel", () => {
    it("returns level 1 for 0 XP", () => {
      const info = getLevel(0);
      expect(info.level).toBe(1);
      expect(info.title).toBe("White Belt Beginner");
    });

    it("returns level 2 for 500 XP", () => {
      const info = getLevel(500);
      expect(info.level).toBe(2);
    });

    it("returns max level for very high XP", () => {
      const info = getLevel(100000);
      expect(info.level).toBe(LEVEL_THRESHOLDS.length);
      expect(info.progressPercent).toBe(100);
    });

    it("calculates progress within level", () => {
      const info = getLevel(850);
      expect(info.level).toBe(2);
      expect(info.progressPercent).toBeGreaterThan(0);
      expect(info.progressPercent).toBeLessThanOrEqual(100);
    });
  });

  describe("checkBadges / getEarnedBadges / getNextBadges", () => {
    it("checkBadges returns all badges with earned status", () => {
      const progress = checkBadges(baseStats);
      expect(progress.length).toBe(BADGES.length);
      progress.forEach((p) => expect(p.earned).toBe(false));
    });

    it("getEarnedBadges returns only earned", () => {
      const stats: UserStats = { ...baseStats, totalSessions: 50, longestStreak: 7 };
      const earned = getEarnedBadges(stats);
      expect(earned.length).toBeGreaterThan(0);
      earned.forEach((b) => expect(b.check(stats)).toBe(true));
    });

    it("getNextBadges returns unearned sorted by tier", () => {
      const next = getNextBadges(baseStats, 3);
      expect(next.length).toBeLessThanOrEqual(3);
      next.forEach((b) => expect(b.check(baseStats)).toBe(false));
    });
  });

  describe("buildGamificationSummary / formatGamificationSummary", () => {
    it("builds summary with all fields", () => {
      const summary = buildGamificationSummary(baseStats);
      expect(summary.totalXP).toBe(0);
      expect(summary.level.level).toBe(1);
      expect(summary.earnedBadges).toHaveLength(0);
      expect(summary.totalBadges).toBe(BADGES.length);
    });

    it("formats summary as string", () => {
      const summary = buildGamificationSummary(baseStats);
      const formatted = formatGamificationSummary(summary);
      expect(formatted).toContain("Level 1");
      expect(formatted).toContain("Badges:");
    });
  });

  it("barrel exports work", async () => {
    const mod = await import("@/lib");
    expect(mod.calculateXP).toBeDefined();
    expect(mod.getLevel).toBeDefined();
    expect(mod.BADGES).toBeDefined();
    expect(mod.XP_RATES).toBeDefined();
  });
});

// ── Q-147: Code Health Dashboard ────────────────────────────────────────

import {
  calculateCategoryScores,
  calculateHealthScore,
  classifyHealth,
  identifyTopIssues,
  buildHealthReport,
  formatHealthReport,
  HEALTH_WEIGHTS,
  GRADE_THRESHOLDS,
  PENALTIES,
} from "@/lib/codeHealthDashboard";
import type { CodeHealthMetrics } from "@/lib/codeHealthDashboard";

const perfectMetrics: CodeHealthMetrics = {
  tscErrors: 0,
  linterCritical: 0,
  linterWarning: 0,
  testsTotal: 100,
  testsPassed: 100,
  testFiles: 10,
  bundleOverBudget: 0,
  unusedExports: 0,
  typeEscapes: 0,
  barrelMissing: 0,
  eslintErrors: 0,
};

describe("Q-147: Code Health Dashboard", () => {
  describe("constants", () => {
    it("HEALTH_WEIGHTS sum to 1.0", () => {
      const sum = Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
    });

    it("GRADE_THRESHOLDS are descending by min", () => {
      for (let i = 1; i < GRADE_THRESHOLDS.length; i++) {
        expect(GRADE_THRESHOLDS[i].min).toBeLessThan(GRADE_THRESHOLDS[i - 1].min);
      }
    });

    it("PENALTIES are all positive", () => {
      Object.values(PENALTIES).forEach((v) => expect(v).toBeGreaterThan(0));
    });
  });

  describe("calculateCategoryScores", () => {
    it("returns 7 categories", () => {
      const cats = calculateCategoryScores(perfectMetrics);
      expect(cats).toHaveLength(7);
    });

    it("all categories 100 for perfect metrics", () => {
      const cats = calculateCategoryScores(perfectMetrics);
      cats.forEach((c) => expect(c.score).toBe(100));
    });

    it("penalizes tsc errors", () => {
      const cats = calculateCategoryScores({ ...perfectMetrics, tscErrors: 2 });
      const ts = cats.find((c) => c.name === "Type Safety");
      expect(ts!.score).toBeLessThan(100);
      expect(ts!.status).toBe("🔴");
    });
  });

  describe("calculateHealthScore", () => {
    it("returns 100 for perfect metrics", () => {
      expect(calculateHealthScore(perfectMetrics)).toBe(100);
    });

    it("returns lower score for issues", () => {
      const score = calculateHealthScore({ ...perfectMetrics, tscErrors: 3, eslintErrors: 5 });
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("classifyHealth", () => {
    it("returns A+ for 100", () => expect(classifyHealth(100)).toBe("A+"));
    it("returns A for 90", () => expect(classifyHealth(90)).toBe("A"));
    it("returns B for 80", () => expect(classifyHealth(80)).toBe("B"));
    it("returns F for 0", () => expect(classifyHealth(0)).toBe("F"));
  });

  describe("identifyTopIssues", () => {
    it("returns empty for perfect metrics", () => {
      expect(identifyTopIssues(perfectMetrics)).toHaveLength(0);
    });

    it("returns issues sorted by impact", () => {
      const issues = identifyTopIssues({ ...perfectMetrics, tscErrors: 1, eslintErrors: 2, linterWarning: 3 });
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain("TypeScript");
    });

    it("respects limit", () => {
      const issues = identifyTopIssues(
        { ...perfectMetrics, tscErrors: 1, eslintErrors: 2, linterWarning: 3, unusedExports: 5 },
        2,
      );
      expect(issues).toHaveLength(2);
    });
  });

  describe("buildHealthReport / formatHealthReport", () => {
    it("builds complete report", () => {
      const report = buildHealthReport(perfectMetrics);
      expect(report.overallScore).toBe(100);
      expect(report.grade).toBe("A+");
      expect(report.categories).toHaveLength(7);
      expect(report.timestamp).toBeTruthy();
      expect(report.summary).toContain("A+");
    });

    it("formats report as string", () => {
      const report = buildHealthReport(perfectMetrics);
      const formatted = formatHealthReport(report);
      expect(formatted).toContain("Code Health Dashboard");
      expect(formatted).toContain("A+");
    });
  });

  it("barrel exports work", async () => {
    const mod = await import("@/lib");
    expect(mod.calculateHealthScore).toBeDefined();
    expect(mod.classifyHealth).toBeDefined();
    expect(mod.HEALTH_WEIGHTS).toBeDefined();
  });
});

// ── Q-148: Rollback Guard ───────────────────────────────────────────────

import {
  compareDeployments,
  shouldRollback,
  formatRollbackDecision,
  ROLLBACK_THRESHOLDS,
} from "@/lib/rollbackGuard";
import type { DeploymentMetrics } from "@/lib/rollbackGuard";

const healthyMetrics: DeploymentMetrics = {
  version: "v1.0.0",
  deployedAt: "2026-04-17T10:00:00Z",
  healthStatus: 200,
  healthResponseMs: 100,
  errorRate: 0.01,
  p95ResponseMs: 500,
  serverErrors: 0,
  dbHealthy: true,
};

describe("Q-148: Rollback Guard", () => {
  describe("ROLLBACK_THRESHOLDS", () => {
    it("has sensible defaults", () => {
      expect(ROLLBACK_THRESHOLDS.maxErrorRate).toBeGreaterThan(0);
      expect(ROLLBACK_THRESHOLDS.maxErrorRate).toBeLessThan(1);
      expect(ROLLBACK_THRESHOLDS.maxP95Ms).toBeGreaterThan(0);
      expect(ROLLBACK_THRESHOLDS.maxServerErrors).toBeGreaterThan(0);
    });
  });

  describe("compareDeployments", () => {
    it("returns stable for identical metrics", () => {
      const cmp = compareDeployments(healthyMetrics, { ...healthyMetrics, version: "v1.1.0" });
      expect(cmp.assessment).toBe("stable");
      expect(cmp.errorRateDelta).toBe(0);
      expect(cmp.p95Delta).toBe(0);
    });

    it("returns improved for lower error rate", () => {
      const after = { ...healthyMetrics, version: "v1.1.0", errorRate: 0.005, p95ResponseMs: 200 };
      const cmp = compareDeployments(healthyMetrics, after);
      expect(cmp.assessment).toBe("improved");
      expect(cmp.errorRateDelta).toBeLessThan(0);
    });

    it("returns critical for health degradation", () => {
      const after = { ...healthyMetrics, version: "v1.1.0", healthStatus: 503 };
      const cmp = compareDeployments(healthyMetrics, after);
      expect(cmp.assessment).toBe("critical");
      expect(cmp.healthDegraded).toBe(true);
    });

    it("returns degraded for error rate increase", () => {
      const after = { ...healthyMetrics, version: "v1.1.0", errorRate: 0.04 };
      const cmp = compareDeployments(healthyMetrics, after);
      expect(cmp.assessment).toBe("degraded");
    });
  });

  describe("shouldRollback", () => {
    it("returns no_action for healthy deployment", () => {
      const decision = shouldRollback(healthyMetrics, { ...healthyMetrics, version: "v1.1.0" });
      expect(decision.rollback).toBe(false);
      expect(decision.severity).toBe("ok");
      expect(decision.action).toBe("no_action");
    });

    it("returns rollback_immediately for health endpoint failure", () => {
      const after = { ...healthyMetrics, version: "v1.1.0", healthStatus: 500 };
      const decision = shouldRollback(healthyMetrics, after);
      expect(decision.rollback).toBe(true);
      expect(decision.severity).toBe("critical");
      expect(decision.action).toBe("rollback_immediately");
    });

    it("returns rollback_immediately for DB failure", () => {
      const after = { ...healthyMetrics, version: "v1.1.0", dbHealthy: false };
      const decision = shouldRollback(healthyMetrics, after);
      expect(decision.rollback).toBe(true);
      expect(decision.severity).toBe("critical");
    });

    it("returns rollback for high error rate", () => {
      const after = { ...healthyMetrics, version: "v1.1.0", errorRate: 0.10 };
      const decision = shouldRollback(healthyMetrics, after);
      expect(decision.rollback).toBe(true);
    });

    it("returns monitor_closely for single non-critical failure", () => {
      const after = { ...healthyMetrics, version: "v1.1.0", p95ResponseMs: 4500 };
      const decision = shouldRollback(healthyMetrics, after);
      expect(decision.rollback).toBe(false);
      expect(decision.severity).toBe("warning");
      expect(decision.action).toBe("monitor_closely");
    });

    it("has 7 checks", () => {
      const decision = shouldRollback(healthyMetrics, { ...healthyMetrics, version: "v1.1.0" });
      expect(decision.checks).toHaveLength(7);
    });
  });

  describe("formatRollbackDecision", () => {
    it("formats ok decision", () => {
      const decision = shouldRollback(healthyMetrics, { ...healthyMetrics, version: "v1.1.0" });
      const formatted = formatRollbackDecision(decision);
      expect(formatted).toContain("✅");
      expect(formatted).toContain("NO ACTION");
    });

    it("formats critical decision", () => {
      const after = { ...healthyMetrics, version: "v1.1.0", healthStatus: 500 };
      const decision = shouldRollback(healthyMetrics, after);
      const formatted = formatRollbackDecision(decision);
      expect(formatted).toContain("🔴");
      expect(formatted).toContain("❌");
    });
  });

  it("barrel exports work", async () => {
    const mod = await import("@/lib");
    expect(mod.shouldRollback).toBeDefined();
    expect(mod.compareDeployments).toBeDefined();
    expect(mod.ROLLBACK_THRESHOLDS).toBeDefined();
  });
});

// ── Q-149: Funnel Analytics ─────────────────────────────────────────────

import {
  analyzeFunnel,
  classifyConversion,
  compareFunnels,
  getRecommendations,
  buildFunnelReport,
  formatFunnelReport,
  FUNNELS,
  CONVERSION_THRESHOLDS,
} from "@/lib/funnelAnalytics";

describe("Q-149: Funnel Analytics", () => {
  describe("FUNNELS", () => {
    it("defines at least 3 funnels", () => {
      expect(Object.keys(FUNNELS).length).toBeGreaterThanOrEqual(3);
    });

    it("each funnel has ordered steps", () => {
      Object.values(FUNNELS).forEach((f) => {
        expect(f.steps.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < f.steps.length; i++) {
          expect(f.steps[i].order).toBeGreaterThan(f.steps[i - 1].order);
        }
      });
    });

    it("each funnel has a target rate between 0 and 1", () => {
      Object.values(FUNNELS).forEach((f) => {
        expect(f.targetRate).toBeGreaterThan(0);
        expect(f.targetRate).toBeLessThanOrEqual(1);
      });
    });
  });

  describe("CONVERSION_THRESHOLDS", () => {
    it("are in descending order", () => {
      expect(CONVERSION_THRESHOLDS.excellent).toBeGreaterThan(CONVERSION_THRESHOLDS.good);
      expect(CONVERSION_THRESHOLDS.good).toBeGreaterThan(CONVERSION_THRESHOLDS.poor);
      expect(CONVERSION_THRESHOLDS.poor).toBeGreaterThan(CONVERSION_THRESHOLDS.critical);
    });
  });

  describe("analyzeFunnel", () => {
    const funnel = FUNNELS.signup;
    const counts: Record<string, number> = {
      landing_visit: 1000,
      cta_click: 200,
      auth_start: 100,
      auth_complete: 80,
      onboarding_complete: 60,
    };

    it("calculates overall conversion", () => {
      const analysis = analyzeFunnel(funnel, counts);
      expect(analysis.overallConversion).toBeCloseTo(0.06);
      expect(analysis.totalEntrants).toBe(1000);
      expect(analysis.totalCompletions).toBe(60);
    });

    it("identifies biggest drop-off", () => {
      const analysis = analyzeFunnel(funnel, counts);
      expect(analysis.biggestDropOff).not.toBeNull();
      expect(analysis.biggestDropOff!.stepId).toBe("cta_click");
      expect(analysis.biggestDropOff!.dropOffRate).toBeCloseTo(0.8);
    });

    it("checks target met", () => {
      const analysis = analyzeFunnel(funnel, counts);
      expect(analysis.targetMet).toBe(true); // 6% > 5% target
    });

    it("handles zero entrants", () => {
      const analysis = analyzeFunnel(funnel, {});
      expect(analysis.overallConversion).toBe(0);
      expect(analysis.totalEntrants).toBe(0);
    });

    it("has correct step count", () => {
      const analysis = analyzeFunnel(funnel, counts);
      expect(analysis.steps).toHaveLength(funnel.steps.length);
    });

    it("first step has null conversion/dropOff rates", () => {
      const analysis = analyzeFunnel(funnel, counts);
      expect(analysis.steps[0].conversionRate).toBeNull();
      expect(analysis.steps[0].dropOffRate).toBeNull();
    });

    it("calculates per-step conversion correctly", () => {
      const analysis = analyzeFunnel(funnel, counts);
      const ctaStep = analysis.steps[1];
      expect(ctaStep.conversionRate).toBeCloseTo(0.2); // 200/1000
      expect(ctaStep.dropOffRate).toBeCloseTo(0.8);
      expect(ctaStep.dropOffCount).toBe(800);
    });
  });

  describe("classifyConversion", () => {
    it("classifies excellent", () => expect(classifyConversion(0.9)).toBe("excellent"));
    it("classifies good", () => expect(classifyConversion(0.6)).toBe("good"));
    it("classifies fair", () => expect(classifyConversion(0.3)).toBe("fair"));
    it("classifies poor", () => expect(classifyConversion(0.15)).toBe("poor"));
    it("classifies critical", () => expect(classifyConversion(0.05)).toBe("critical"));
  });

  describe("compareFunnels", () => {
    const funnel = FUNNELS.signup;
    const countsA = { landing_visit: 1000, cta_click: 100, auth_start: 50, auth_complete: 40, onboarding_complete: 30 };
    const countsB = { landing_visit: 1000, cta_click: 200, auth_start: 100, auth_complete: 80, onboarding_complete: 60 };

    it("detects improvement", () => {
      const analysisA = analyzeFunnel(funnel, countsA);
      const analysisB = analyzeFunnel(funnel, countsB);
      const cmp = compareFunnels("Week 1", analysisA, "Week 2", analysisB);
      expect(cmp.assessment).toBe("improved");
      expect(cmp.conversionDelta).toBeGreaterThan(0);
    });

    it("detects decline", () => {
      const analysisA = analyzeFunnel(funnel, countsB);
      const analysisB = analyzeFunnel(funnel, countsA);
      const cmp = compareFunnels("Week 1", analysisA, "Week 2", analysisB);
      expect(cmp.assessment).toBe("declined");
    });

    it("detects stable", () => {
      const analysisA = analyzeFunnel(funnel, countsA);
      const cmp = compareFunnels("Week 1", analysisA, "Week 2", analysisA);
      expect(cmp.assessment).toBe("stable");
    });
  });

  describe("getRecommendations", () => {
    it("recommends for below-target funnel", () => {
      const funnel = { ...FUNNELS.signup, targetRate: 0.99 };
      const analysis = analyzeFunnel(funnel, { landing_visit: 100, cta_click: 10, auth_start: 5, auth_complete: 3, onboarding_complete: 1 });
      const recs = getRecommendations(analysis);
      expect(recs.length).toBeGreaterThan(0);
      expect(recs.some((r) => r.includes("below target"))).toBe(true);
    });

    it("returns positive message for good funnel", () => {
      const funnel = { ...FUNNELS.signup, targetRate: 0.01 };
      const counts = { landing_visit: 100, cta_click: 90, auth_start: 85, auth_complete: 80, onboarding_complete: 75 };
      const analysis = analyzeFunnel(funnel, counts);
      const recs = getRecommendations(analysis);
      expect(recs.some((r) => r.includes("performing well"))).toBe(true);
    });

    it("flags critical step conversion", () => {
      const funnel = FUNNELS.signup;
      const counts = { landing_visit: 1000, cta_click: 50, auth_start: 3, auth_complete: 2, onboarding_complete: 1 };
      const analysis = analyzeFunnel(funnel, counts);
      const recs = getRecommendations(analysis);
      expect(recs.some((r) => r.includes("Critical"))).toBe(true);
    });
  });

  describe("buildFunnelReport", () => {
    it("builds report for known funnel", () => {
      const report = buildFunnelReport("signup", { landing_visit: 100, cta_click: 50, auth_start: 25, auth_complete: 20, onboarding_complete: 10 });
      expect(report.funnelId).toBe("signup");
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it("throws for unknown funnel", () => {
      expect(() => buildFunnelReport("nonexistent", {})).toThrow("Unknown funnel");
    });
  });

  describe("formatFunnelReport", () => {
    it("includes funnel name and conversion", () => {
      const funnel = FUNNELS.signup;
      const analysis = analyzeFunnel(funnel, { landing_visit: 100, cta_click: 50, auth_start: 25, auth_complete: 20, onboarding_complete: 10 });
      const formatted = formatFunnelReport(analysis);
      expect(formatted).toContain("User Signup");
      expect(formatted).toContain("Entrants: 100");
    });
  });

  it("barrel exports work", async () => {
    const mod = await import("@/lib");
    expect(mod.analyzeFunnel).toBeDefined();
    expect(mod.FUNNELS).toBeDefined();
    expect(mod.classifyConversion).toBeDefined();
    expect(mod.buildFunnelReport).toBeDefined();
  });
});
