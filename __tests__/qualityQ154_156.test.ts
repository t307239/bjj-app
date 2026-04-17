/**
 * __tests__/qualityQ154_156.test.ts
 *
 * Q-154: Legal — complianceChecker
 * Q-155: Cost — costAllocator
 * Q-156: Ops — incidentTracker
 */
import { describe, it, expect } from "vitest";

// ── Q-154: complianceChecker ────────────────────────────────────────────

import {
  runComplianceChecks,
  buildComplianceReport,
  getRequirementsByRegulation,
  formatComplianceReport,
  COMPLIANCE_REQUIREMENTS,
} from "@/lib/complianceChecker";
import type { ComplianceState, Regulation } from "@/lib/complianceChecker";

const FULLY_COMPLIANT: ComplianceState = {
  privacyPolicyExists: true,
  termsExists: true,
  cookieConsentActive: true,
  cookieCategoryControl: true,
  dataExportAvailable: true,
  accountDeletionAvailable: true,
  deletionGracePeriodDays: 30,
  ageVerificationExists: true,
  dpaExists: true,
  tokushohoExists: true,
  emailUnsubscribeAvailable: true,
  incidentPolicyDefined: true,
  retentionPolicyDefined: true,
  rlsEnabled: true,
  consentVersionTracking: true,
};

const EMPTY_STATE: ComplianceState = {
  privacyPolicyExists: false,
  termsExists: false,
  cookieConsentActive: false,
  cookieCategoryControl: false,
  dataExportAvailable: false,
  accountDeletionAvailable: false,
  deletionGracePeriodDays: 0,
  ageVerificationExists: false,
  dpaExists: false,
  tokushohoExists: false,
  emailUnsubscribeAvailable: false,
  incidentPolicyDefined: false,
  retentionPolicyDefined: false,
  rlsEnabled: false,
  consentVersionTracking: false,
};

describe("Q-154 complianceChecker", () => {
  describe("COMPLIANCE_REQUIREMENTS", () => {
    it("has at least 15 requirements", () => {
      expect(COMPLIANCE_REQUIREMENTS.length).toBeGreaterThanOrEqual(15);
    });
    it("covers multiple regulations", () => {
      const regs = new Set(COMPLIANCE_REQUIREMENTS.map((r) => r.regulation));
      expect(regs.size).toBeGreaterThanOrEqual(5);
      expect(regs.has("GDPR")).toBe(true);
      expect(regs.has("CCPA")).toBe(true);
      expect(regs.has("COPPA")).toBe(true);
    });
    it("each requirement has required fields", () => {
      for (const req of COMPLIANCE_REQUIREMENTS) {
        expect(req.id).toBeTruthy();
        expect(req.name).toBeTruthy();
        expect(req.description).toBeTruthy();
        expect(req.reference).toBeTruthy();
        expect(["critical", "warning", "info"]).toContain(req.severity);
      }
    });
    it("has unique IDs", () => {
      const ids = COMPLIANCE_REQUIREMENTS.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("runComplianceChecks", () => {
    it("returns result for each requirement", () => {
      const results = runComplianceChecks(FULLY_COMPLIANT);
      expect(results.length).toBe(COMPLIANCE_REQUIREMENTS.length);
    });
    it("all pass when fully compliant", () => {
      const results = runComplianceChecks(FULLY_COMPLIANT);
      expect(results.every((r) => r.passed)).toBe(true);
    });
    it("all fail when empty state", () => {
      const results = runComplianceChecks(EMPTY_STATE);
      expect(results.every((r) => !r.passed)).toBe(true);
    });
    it("cookie consent requires both active and category control", () => {
      const partialCookie: ComplianceState = {
        ...FULLY_COMPLIANT,
        cookieCategoryControl: false,
      };
      const results = runComplianceChecks(partialCookie);
      const cookieCheck = results.find((r) => r.requirement.id === "gdpr_consent");
      expect(cookieCheck?.passed).toBe(false);
    });
    it("grace period checks ≥30 days", () => {
      const shortGrace: ComplianceState = {
        ...FULLY_COMPLIANT,
        deletionGracePeriodDays: 15,
      };
      const results = runComplianceChecks(shortGrace);
      const graceCheck = results.find((r) => r.requirement.id === "app_grace");
      expect(graceCheck?.passed).toBe(false);
      expect(graceCheck?.detail).toContain("15");
    });
    it("each result has detail string", () => {
      const results = runComplianceChecks(FULLY_COMPLIANT);
      for (const r of results) {
        expect(typeof r.detail).toBe("string");
        expect(r.detail.length).toBeGreaterThan(0);
      }
    });
  });

  describe("buildComplianceReport", () => {
    it("returns compliant when all pass", () => {
      const results = runComplianceChecks(FULLY_COMPLIANT);
      const report = buildComplianceReport(results);
      expect(report.status).toBe("compliant");
      expect(report.passRate).toBe(1);
      expect(report.criticalFailures).toHaveLength(0);
    });
    it("returns non-compliant when critical fails", () => {
      const results = runComplianceChecks(EMPTY_STATE);
      const report = buildComplianceReport(results);
      expect(report.status).toBe("non-compliant");
      expect(report.criticalFailures.length).toBeGreaterThan(0);
      expect(report.passRate).toBe(0);
    });
    it("returns partial when only warnings fail", () => {
      // Fail only non-critical items
      const warningOnly: ComplianceState = {
        ...FULLY_COMPLIANT,
        dpaExists: false,
        retentionPolicyDefined: false,
        incidentPolicyDefined: false,
        consentVersionTracking: false,
      };
      const results = runComplianceChecks(warningOnly);
      const report = buildComplianceReport(results);
      expect(report.status).toBe("partial");
      expect(report.criticalFailures).toHaveLength(0);
    });
    it("includes regulationsCovered", () => {
      const results = runComplianceChecks(FULLY_COMPLIANT);
      const report = buildComplianceReport(results);
      expect(report.regulationsCovered.length).toBeGreaterThanOrEqual(5);
    });
    it("has timestamp", () => {
      const results = runComplianceChecks(FULLY_COMPLIANT);
      const report = buildComplianceReport(results);
      expect(report.timestamp).toBeTruthy();
      expect(() => new Date(report.timestamp)).not.toThrow();
    });
  });

  describe("getRequirementsByRegulation", () => {
    it("filters GDPR requirements", () => {
      const gdpr = getRequirementsByRegulation("GDPR");
      expect(gdpr.length).toBeGreaterThanOrEqual(5);
      expect(gdpr.every((r) => r.regulation === "GDPR")).toBe(true);
    });
    it("filters CCPA requirements", () => {
      const ccpa = getRequirementsByRegulation("CCPA");
      expect(ccpa.length).toBeGreaterThanOrEqual(2);
    });
    it("returns empty for unknown regulation", () => {
      const result = getRequirementsByRegulation("UNKNOWN" as Regulation);
      expect(result).toHaveLength(0);
    });
  });

  describe("formatComplianceReport", () => {
    it("includes status and pass rate", () => {
      const results = runComplianceChecks(FULLY_COMPLIANT);
      const report = buildComplianceReport(results);
      const text = formatComplianceReport(report);
      expect(text).toContain("COMPLIANT");
      expect(text).toContain("100%");
    });
    it("lists critical failures when non-compliant", () => {
      const results = runComplianceChecks(EMPTY_STATE);
      const report = buildComplianceReport(results);
      const text = formatComplianceReport(report);
      expect(text).toContain("Critical failures");
      expect(text).toContain("🔴");
    });
  });

  describe("barrel exports", () => {
    it("exports from lib/index", async () => {
      const mod = await import("@/lib/index");
      expect(mod.runComplianceChecks).toBeDefined();
      expect(mod.buildComplianceReport).toBeDefined();
      expect(mod.COMPLIANCE_REQUIREMENTS).toBeDefined();
      expect(mod.formatComplianceReport).toBeDefined();
    });
  });
});

// ── Q-155: costAllocator ────────────────────────────────────────────────

import {
  allocateUserCost,
  calculateLTV,
  calculateCAC,
  analyzeUnitEconomics,
  formatCostAllocation,
  formatUnitEconomics,
  COST_CENTERS,
  TIER_PRICING,
  ECONOMICS_THRESHOLDS,
} from "@/lib/costAllocator";
import type { UserUsage } from "@/lib/costAllocator";

const TYPICAL_FREE_USAGE: UserUsage = {
  apiRequests: 500,
  storageMB: 10,
  aiQueries: 0,
  pushNotifications: 30,
  emailsSent: 4,
};

const TYPICAL_PRO_USAGE: UserUsage = {
  apiRequests: 2000,
  storageMB: 50,
  aiQueries: 20,
  pushNotifications: 100,
  emailsSent: 12,
};

describe("Q-155 costAllocator", () => {
  describe("COST_CENTERS", () => {
    it("has at least 5 centers", () => {
      expect(Object.keys(COST_CENTERS).length).toBeGreaterThanOrEqual(5);
    });
    it("each center has positive unitCost", () => {
      for (const center of Object.values(COST_CENTERS)) {
        expect(center.unitCost).toBeGreaterThan(0);
        expect(center.name).toBeTruthy();
        expect(center.unit).toBeTruthy();
        expect(center.provider).toBeTruthy();
      }
    });
  });

  describe("TIER_PRICING", () => {
    it("free tier is $0", () => {
      expect(TIER_PRICING.free).toBe(0);
    });
    it("pro_annual cheaper than pro_monthly", () => {
      expect(TIER_PRICING.pro_annual).toBeLessThan(TIER_PRICING.pro_monthly);
    });
    it("pro tiers are positive", () => {
      expect(TIER_PRICING.pro_monthly).toBeGreaterThan(0);
      expect(TIER_PRICING.pro_annual).toBeGreaterThan(0);
    });
  });

  describe("ECONOMICS_THRESHOLDS", () => {
    it("excellent > healthy > concerning", () => {
      expect(ECONOMICS_THRESHOLDS.excellent).toBeGreaterThan(ECONOMICS_THRESHOLDS.healthy);
      expect(ECONOMICS_THRESHOLDS.healthy).toBeGreaterThan(ECONOMICS_THRESHOLDS.concerning);
    });
  });

  describe("allocateUserCost", () => {
    it("free tier has zero Stripe fees", () => {
      const cost = allocateUserCost(TYPICAL_FREE_USAGE, "free");
      expect(cost.stripeFees).toBe(0);
      expect(cost.tier).toBe("free");
    });
    it("pro tier has positive Stripe fees", () => {
      const cost = allocateUserCost(TYPICAL_PRO_USAGE, "pro_monthly");
      expect(cost.stripeFees).toBeGreaterThan(0);
    });
    it("total is sum of components", () => {
      const cost = allocateUserCost(TYPICAL_PRO_USAGE, "pro_monthly");
      const sum = cost.compute + cost.storage + cost.ai + cost.notification + cost.stripeFees;
      expect(Math.abs(cost.total - sum)).toBeLessThan(0.0001);
    });
    it("zero usage yields zero cost (except Stripe)", () => {
      const zero: UserUsage = { apiRequests: 0, storageMB: 0, aiQueries: 0, pushNotifications: 0, emailsSent: 0 };
      const cost = allocateUserCost(zero, "free");
      expect(cost.total).toBe(0);
      expect(cost.costPerRequest).toBe(0);
    });
    it("costPerRequest is total/apiRequests", () => {
      const cost = allocateUserCost(TYPICAL_PRO_USAGE, "pro_monthly");
      expect(Math.abs(cost.costPerRequest - cost.total / TYPICAL_PRO_USAGE.apiRequests)).toBeLessThan(0.000001);
    });
    it("AI cost scales with queries", () => {
      const low = allocateUserCost({ ...TYPICAL_PRO_USAGE, aiQueries: 5 }, "pro_monthly");
      const high = allocateUserCost({ ...TYPICAL_PRO_USAGE, aiQueries: 100 }, "pro_monthly");
      expect(high.ai).toBeGreaterThan(low.ai);
    });
  });

  describe("calculateLTV", () => {
    it("returns revenue/churn for positive churn", () => {
      expect(calculateLTV(10, 0.05)).toBeCloseTo(200, 0);
    });
    it("caps at 120x revenue for zero churn", () => {
      expect(calculateLTV(10, 0)).toBe(1200);
    });
    it("caps at 120x for negative churn", () => {
      expect(calculateLTV(10, -0.01)).toBe(1200);
    });
    it("handles zero revenue", () => {
      expect(calculateLTV(0, 0.05)).toBe(0);
    });
  });

  describe("calculateCAC", () => {
    it("returns spend/customers", () => {
      expect(calculateCAC(1000, 50)).toBe(20);
    });
    it("returns 0 for zero customers", () => {
      expect(calculateCAC(1000, 0)).toBe(0);
    });
  });

  describe("analyzeUnitEconomics", () => {
    it("excellent when LTV/CAC > 5", () => {
      const econ = analyzeUnitEconomics(10, 2, 0.05, 20);
      // LTV = 200, CAC = 20, ratio = 10
      expect(econ.assessment).toBe("excellent");
      expect(econ.ltvCacRatio).toBeGreaterThanOrEqual(5);
    });
    it("healthy when LTV/CAC between 3 and 5", () => {
      const econ = analyzeUnitEconomics(10, 5, 0.05, 50);
      // LTV = 200, CAC = 50, ratio = 4
      expect(econ.assessment).toBe("healthy");
    });
    it("concerning when LTV/CAC between 1 and 3", () => {
      const econ = analyzeUnitEconomics(10, 5, 0.05, 100);
      // LTV = 200, CAC = 100, ratio = 2
      expect(econ.assessment).toBe("concerning");
    });
    it("unsustainable when LTV/CAC < 1", () => {
      const econ = analyzeUnitEconomics(10, 5, 0.05, 500);
      // LTV = 200, CAC = 500, ratio = 0.4
      expect(econ.assessment).toBe("unsustainable");
    });
    it("calculates gross margin", () => {
      const econ = analyzeUnitEconomics(10, 3, 0.05, 20);
      expect(econ.grossMargin).toBeCloseTo(0.7, 1);
    });
    it("payback infinite when cost > revenue", () => {
      const econ = analyzeUnitEconomics(5, 10, 0.05, 20);
      expect(econ.paybackMonths).toBe(Infinity);
    });
    it("handles zero CAC", () => {
      const econ = analyzeUnitEconomics(10, 2, 0.05, 0);
      expect(econ.ltvCacRatio).toBe(Infinity);
    });
  });

  describe("formatCostAllocation", () => {
    it("includes tier and total", () => {
      const cost = allocateUserCost(TYPICAL_FREE_USAGE, "free");
      const text = formatCostAllocation(cost);
      expect(text).toContain("free");
      expect(text).toContain("Compute");
      expect(text).toContain("Storage");
    });
  });

  describe("formatUnitEconomics", () => {
    it("includes assessment icon", () => {
      const econ = analyzeUnitEconomics(10, 2, 0.05, 20);
      const text = formatUnitEconomics(econ);
      expect(text).toContain("🟢");
      expect(text).toContain("excellent");
    });
    it("shows warning for unsustainable", () => {
      const econ = analyzeUnitEconomics(5, 10, 0.05, 500);
      const text = formatUnitEconomics(econ);
      expect(text).toContain("🔴");
      expect(text).toContain("unsustainable");
    });
  });

  describe("barrel exports", () => {
    it("exports from lib/index", async () => {
      const mod = await import("@/lib/index");
      expect(mod.allocateUserCost).toBeDefined();
      expect(mod.calculateLTV).toBeDefined();
      expect(mod.COST_CENTERS).toBeDefined();
      expect(mod.TIER_PRICING).toBeDefined();
      expect(mod.analyzeUnitEconomics).toBeDefined();
    });
  });
});

// ── Q-156: incidentTracker ──────────────────────────────────────────────

import {
  createIncident,
  acknowledgeIncident,
  resolveIncident,
  addTimelineEntry,
  calculateMetrics,
  generatePostmortemTemplate,
  formatMetrics,
  SEVERITY_LEVELS,
  STATUS_FLOW,
} from "@/lib/incidentTracker";

describe("Q-156 incidentTracker", () => {
  describe("SEVERITY_LEVELS", () => {
    it("has 4 levels", () => {
      expect(Object.keys(SEVERITY_LEVELS)).toHaveLength(4);
    });
    it("critical has shortest response time", () => {
      expect(SEVERITY_LEVELS.critical.responseMinutes).toBeLessThan(SEVERITY_LEVELS.major.responseMinutes);
      expect(SEVERITY_LEVELS.major.responseMinutes).toBeLessThan(SEVERITY_LEVELS.minor.responseMinutes);
      expect(SEVERITY_LEVELS.minor.responseMinutes).toBeLessThan(SEVERITY_LEVELS.cosmetic.responseMinutes);
    });
    it("each level has label and icon", () => {
      for (const level of Object.values(SEVERITY_LEVELS)) {
        expect(level.label).toBeTruthy();
        expect(level.icon).toBeTruthy();
      }
    });
  });

  describe("STATUS_FLOW", () => {
    it("starts with detected and ends with postmortem", () => {
      expect(STATUS_FLOW[0]).toBe("detected");
      expect(STATUS_FLOW[STATUS_FLOW.length - 1]).toBe("postmortem");
    });
    it("has at least 5 statuses", () => {
      expect(STATUS_FLOW.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("createIncident", () => {
    it("creates with detected status", () => {
      const inc = createIncident("Test", "critical", "deployment");
      expect(inc.status).toBe("detected");
      expect(inc.severity).toBe("critical");
      expect(inc.category).toBe("deployment");
      expect(inc.title).toBe("Test");
    });
    it("generates IDs with INC- prefix", () => {
      const a = createIncident("A", "minor", "data");
      expect(a.id).toMatch(/^INC-\d+$/);
    });
    it("sets detectedAt timestamp", () => {
      const inc = createIncident("Test", "major", "infrastructure");
      expect(inc.detectedAt).toBeTruthy();
      expect(() => new Date(inc.detectedAt)).not.toThrow();
    });
    it("acknowledgedAt and resolvedAt are null", () => {
      const inc = createIncident("Test", "critical", "security");
      expect(inc.acknowledgedAt).toBeNull();
      expect(inc.resolvedAt).toBeNull();
      expect(inc.resolution).toBeNull();
    });
    it("has initial timeline entry", () => {
      const inc = createIncident("Test", "minor", "external");
      expect(inc.timeline).toHaveLength(1);
      expect(inc.timeline[0].action).toContain("detected");
    });
    it("includes impact", () => {
      const inc = createIncident("Test", "critical", "deployment", "500 users affected");
      expect(inc.impact).toBe("500 users affected");
    });
  });

  describe("acknowledgeIncident", () => {
    it("sets status to acknowledged", () => {
      const inc = createIncident("Test", "critical", "deployment");
      const acked = acknowledgeIncident(inc, "alice");
      expect(acked.status).toBe("acknowledged");
      expect(acked.acknowledgedAt).toBeTruthy();
    });
    it("adds timeline entry", () => {
      const inc = createIncident("Test", "critical", "deployment");
      const acked = acknowledgeIncident(inc);
      expect(acked.timeline).toHaveLength(2);
      expect(acked.timeline[1].action).toContain("acknowledged");
    });
    it("does not mutate original", () => {
      const inc = createIncident("Test", "critical", "deployment");
      acknowledgeIncident(inc);
      expect(inc.status).toBe("detected");
    });
  });

  describe("resolveIncident", () => {
    it("sets status to resolved with resolution", () => {
      const inc = createIncident("Test", "critical", "deployment");
      const resolved = resolveIncident(inc, "Rolled back v1.2.3");
      expect(resolved.status).toBe("resolved");
      expect(resolved.resolvedAt).toBeTruthy();
      expect(resolved.resolution).toBe("Rolled back v1.2.3");
    });
    it("adds timeline entry with resolution", () => {
      const inc = createIncident("Test", "major", "data");
      const resolved = resolveIncident(inc, "Fixed query");
      const last = resolved.timeline[resolved.timeline.length - 1];
      expect(last.action).toContain("Fixed query");
    });
  });

  describe("addTimelineEntry", () => {
    it("appends entry", () => {
      const inc = createIncident("Test", "minor", "external");
      const updated = addTimelineEntry(inc, "Investigating root cause", "bob");
      expect(updated.timeline).toHaveLength(2);
      expect(updated.timeline[1].actor).toBe("bob");
    });
  });

  describe("calculateMetrics", () => {
    it("returns zeros for empty incidents", () => {
      const metrics = calculateMetrics([]);
      expect(metrics.totalIncidents).toBe(0);
      expect(metrics.mtta).toBe(0);
      expect(metrics.mttr).toBe(0);
      expect(metrics.uptimePercent).toBe(100);
    });
    it("counts by severity", () => {
      const incidents = [
        createIncident("A", "critical", "deployment"),
        createIncident("B", "critical", "data"),
        createIncident("C", "minor", "external"),
      ];
      const metrics = calculateMetrics(incidents);
      expect(metrics.bySeverity.critical).toBe(2);
      expect(metrics.bySeverity.minor).toBe(1);
      expect(metrics.totalIncidents).toBe(3);
    });
    it("counts by category", () => {
      const incidents = [
        createIncident("A", "major", "deployment"),
        createIncident("B", "minor", "deployment"),
        createIncident("C", "minor", "security"),
      ];
      const metrics = calculateMetrics(incidents);
      expect(metrics.byCategory["deployment"]).toBe(2);
      expect(metrics.byCategory["security"]).toBe(1);
    });
    it("calculates MTTA from acknowledged incidents", () => {
      const inc = createIncident("A", "critical", "deployment");
      const acked = acknowledgeIncident(inc);
      const metrics = calculateMetrics([acked]);
      expect(metrics.mtta).toBeGreaterThanOrEqual(0);
    });
    it("calculates MTTR from resolved incidents", () => {
      const inc = createIncident("A", "critical", "deployment");
      const resolved = resolveIncident(inc, "Fixed");
      const metrics = calculateMetrics([resolved]);
      expect(metrics.mttr).toBeGreaterThanOrEqual(0);
    });
    it("uptime is clamped 0-100", () => {
      const metrics = calculateMetrics([], 30);
      expect(metrics.uptimePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.uptimePercent).toBeLessThanOrEqual(100);
    });
  });

  describe("generatePostmortemTemplate", () => {
    it("generates 7 sections", () => {
      const inc = resolveIncident(createIncident("Outage", "critical", "infrastructure"), "Restarted service");
      const template = generatePostmortemTemplate(inc);
      expect(template.sections).toHaveLength(7);
      expect(template.incidentId).toBe(inc.id);
      expect(template.title).toContain("Postmortem");
    });
    it("includes key headings", () => {
      const inc = createIncident("Test", "minor", "data");
      const template = generatePostmortemTemplate(inc);
      const headings = template.sections.map((s) => s.heading);
      expect(headings).toContain("Summary");
      expect(headings).toContain("Root Cause");
      expect(headings).toContain("Action Items");
    });
    it("includes resolution in template when resolved", () => {
      const inc = resolveIncident(createIncident("Test", "major", "deployment"), "Deployed hotfix");
      const template = generatePostmortemTemplate(inc);
      const resSection = template.sections.find((s) => s.heading === "Resolution");
      expect(resSection?.prompt).toContain("Deployed hotfix");
    });
  });

  describe("formatMetrics", () => {
    it("includes MTTA and MTTR", () => {
      const metrics = calculateMetrics([]);
      const text = formatMetrics(metrics);
      expect(text).toContain("MTTA");
      expect(text).toContain("MTTR");
      expect(text).toContain("Uptime");
    });
  });

  describe("barrel exports", () => {
    it("exports from lib/index", async () => {
      const mod = await import("@/lib/index");
      expect(mod.createIncident).toBeDefined();
      expect(mod.resolveIncident).toBeDefined();
      expect(mod.calculateMetrics).toBeDefined();
      expect(mod.SEVERITY_LEVELS).toBeDefined();
      expect(mod.STATUS_FLOW).toBeDefined();
      expect(mod.generatePostmortemTemplate).toBeDefined();
    });
  });
});
