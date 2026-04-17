/**
 * Tests for Q-178~Q-186: UI/UX/i18n/Data/Retention/Legal/Cost/Ops/Conversion 94→95
 */
import { describe, it, expect } from "vitest";

// ── Q-178: Theme Validator (UI 94→95) ──────────────────────

describe("Q-178: themeValidator", () => {
  it("detectLightBackgrounds", async () => {
    const m = await import("@/lib/themeValidator");
    const violations = m.detectLightBackgrounds("bg-white p-4 text-zinc-100");
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toBe("no_light_background");
    expect(violations[0].severity).toBe("error");
    expect(m.detectLightBackgrounds("bg-zinc-900 p-4").length).toBe(0);
  });

  it("detectGrayUsage", async () => {
    const m = await import("@/lib/themeValidator");
    const violations = m.detectGrayUsage("text-gray-500 bg-gray-100");
    expect(violations.length).toBe(2);
    expect(violations[0].suggestion).toBe("text-zinc-500");
    expect(m.detectGrayUsage("text-zinc-500").length).toBe(0);
  });

  it("detectRawWhite", async () => {
    const m = await import("@/lib/themeValidator");
    expect(m.detectRawWhite("text-white font-bold").length).toBe(1);
    expect(m.detectRawWhite("text-zinc-50").length).toBe(0);
  });

  it("detectInconsistentBorders", async () => {
    const m = await import("@/lib/themeValidator");
    const violations = m.detectInconsistentBorders("border-gray-300 rounded");
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(m.detectInconsistentBorders("border-zinc-700").length).toBe(0);
  });

  it("detectOpacityText", async () => {
    const m = await import("@/lib/themeValidator");
    expect(m.detectOpacityText("text-opacity-50").length).toBe(1);
    expect(m.detectOpacityText("text-zinc-400").length).toBe(0);
  });

  it("auditTheme scoring", async () => {
    const m = await import("@/lib/themeValidator");
    const clean = m.auditTheme([{ classes: "bg-zinc-900 text-zinc-100 border-zinc-700" }]);
    expect(clean.score).toBe(100);
    expect(clean.grade).toBe("A+");
    expect(clean.darkModeCompliant).toBe(true);

    const bad = m.auditTheme([{ classes: "bg-white text-gray-500 border-gray-300" }]);
    expect(bad.score).toBeLessThan(100);
    expect(bad.violations.length).toBeGreaterThan(0);
  });

  it("isDarkColor", async () => {
    const m = await import("@/lib/themeValidator");
    expect(m.isDarkColor("#0B1120")).toBe(true);
    expect(m.isDarkColor("#18181B")).toBe(true);
    expect(m.isDarkColor("#FFFFFF")).toBe(false);
    expect(m.isDarkColor("#F5F5F5")).toBe(false);
  });

  it("calculateContrastRatio", async () => {
    const m = await import("@/lib/themeValidator");
    const ratio = m.calculateContrastRatio("#FFFFFF", "#000000");
    expect(ratio).toBeCloseTo(21, 0);
    expect(m.isContrastCompliant("#FFFFFF", "#000000", "AAA")).toBe(true);
    expect(m.isContrastCompliant("#777777", "#888888", "AA")).toBe(false);
  });

  it("formatThemeAudit", async () => {
    const m = await import("@/lib/themeValidator");
    const result = m.auditTheme([{ classes: "bg-white", file: "test.tsx", line: 10 }]);
    const formatted = m.formatThemeAudit(result);
    expect(formatted).toContain("Theme Audit Report");
    expect(formatted).toContain("test.tsx:10");
  });
});

// ── Q-179: Navigation Flow (UX 94→95) ─────────────────────

describe("Q-179: navigationFlow", () => {
  const nodes = [
    { path: "/", label: "Home", requiresAuth: false, depth: 0 },
    { path: "/records", label: "Records", requiresAuth: true, depth: 1 },
    { path: "/records/123", label: "Record Detail", requiresAuth: true, depth: 2 },
    { path: "/settings", label: "Settings", requiresAuth: true, depth: 1 },
    { path: "/orphan", label: "Orphan", requiresAuth: false, depth: 1 },
  ];
  const edges = [
    { from: "/", to: "/records", type: "link" as const },
    { from: "/records", to: "/records/123", type: "link" as const },
    { from: "/", to: "/settings", type: "link" as const },
  ];

  it("detectDeadEnds", async () => {
    const m = await import("@/lib/navigationFlow");
    const deadEnds = m.detectDeadEnds(nodes, edges);
    expect(deadEnds.length).toBeGreaterThan(0);
    expect(deadEnds.some((d) => d.path === "/records/123")).toBe(true);
  });

  it("detectOrphans", async () => {
    const m = await import("@/lib/navigationFlow");
    const orphans = m.detectOrphans(nodes, edges);
    expect(orphans.some((o) => o.path === "/orphan")).toBe(true);
  });

  it("detectDeepNesting", async () => {
    const m = await import("@/lib/navigationFlow");
    const deepNodes = [...nodes, { path: "/a/b/c/d/e", label: "Deep", requiresAuth: false, depth: 5 }];
    const issues = m.detectDeepNesting(deepNodes);
    expect(issues.some((i) => i.type === "deep_nesting")).toBe(true);
  });

  it("detectAuthLeaks", async () => {
    const m = await import("@/lib/navigationFlow");
    const leaks = m.detectAuthLeaks(nodes, edges);
    expect(leaks.some((l) => l.path === "/records")).toBe(true);
  });

  it("countReachable", async () => {
    const m = await import("@/lib/navigationFlow");
    const count = m.countReachable(nodes, edges);
    expect(count).toBe(4); // /, /records, /records/123, /settings
  });

  it("analyzeNavFlow full report", async () => {
    const m = await import("@/lib/navigationFlow");
    const report = m.analyzeNavFlow(nodes, edges);
    expect(report.totalPages).toBe(5);
    expect(report.reachablePages).toBe(4);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("formatNavFlowReport", async () => {
    const m = await import("@/lib/navigationFlow");
    const report = m.analyzeNavFlow(nodes, edges);
    const formatted = m.formatNavFlowReport(report);
    expect(formatted).toContain("Navigation Flow Report");
  });
});

// ── Q-180: Locale Negotiator (i18n 94→95) ──────────────────

describe("Q-180: localeNegotiator", () => {
  it("parseAcceptLanguage", async () => {
    const m = await import("@/lib/localeNegotiator");
    const result = m.parseAcceptLanguage("ja,en-US;q=0.9,en;q=0.8");
    expect(result.length).toBe(3);
    expect(result[0].locale).toBe("ja");
    expect(result[0].quality).toBe(1);
    expect(result[1].quality).toBe(0.9);
    expect(m.parseAcceptLanguage("").length).toBe(0);
  });

  it("normalizeBCP47", async () => {
    const m = await import("@/lib/localeNegotiator");
    expect(m.normalizeBCP47("pt_br")).toBe("pt-BR");
    expect(m.normalizeBCP47("EN-us")).toBe("en-US");
    expect(m.normalizeBCP47("ja")).toBe("ja");
  });

  it("negotiateLocale", async () => {
    const m = await import("@/lib/localeNegotiator");
    expect(m.negotiateLocale("ja,en;q=0.9")).toBe("ja");
    expect(m.negotiateLocale("pt-BR,en;q=0.5")).toBe("pt-BR");
    expect(m.negotiateLocale("fr,de;q=0.9")).toBe("en"); // default
    expect(m.negotiateLocale("pt,en;q=0.5")).toBe("pt-BR"); // language match
  });

  it("buildFallbackChain", async () => {
    const m = await import("@/lib/localeNegotiator");
    expect(m.buildFallbackChain("pt-BR")).toEqual(["pt-BR", "pt", "en"]);
    expect(m.buildFallbackChain("ja")).toEqual(["ja", "en"]);
    expect(m.buildFallbackChain("en")).toEqual(["en"]);
  });

  it("getLocaleConfig", async () => {
    const m = await import("@/lib/localeNegotiator");
    const ja = m.getLocaleConfig("ja");
    expect(ja.displayName).toBe("日本語");
    expect(ja.dateFormat).toBe("YYYY/MM/DD");
    const ptBR = m.getLocaleConfig("pt-BR");
    expect(ptBR.numberSeparator.decimal).toBe(",");
  });

  it("isValidBCP47", async () => {
    const m = await import("@/lib/localeNegotiator");
    expect(m.isValidBCP47("en")).toBe(true);
    expect(m.isValidBCP47("pt-BR")).toBe(true);
    expect(m.isValidBCP47("123")).toBe(false);
  });

  it("calculateI18nCoverage", async () => {
    const m = await import("@/lib/localeNegotiator");
    const result = m.calculateI18nCoverage(["a", "b", "c", "d"], ["a", "b", "c"]);
    expect(result.coverage).toBe(75);
    expect(result.missing).toEqual(["d"]);
    expect(result.extra).toEqual([]);
  });
});

// ── Q-181: Data Migration Helper (Data 94→95) ──────────────

describe("Q-181: dataMigrationHelper", () => {
  const steps = [
    { version: "1.0.0", name: "Initial", description: "Base schema", up: "CREATE TABLE...", down: "DROP TABLE...", destructive: false, requiresDowntime: false },
    { version: "1.1.0", name: "Add column", description: "Add email", up: "ALTER TABLE ADD...", down: "ALTER TABLE DROP...", destructive: false, requiresDowntime: false },
    { version: "2.0.0", name: "Breaking change", description: "Restructure", up: "ALTER TABLE...", down: "ALTER TABLE...", destructive: true, requiresDowntime: true },
  ];

  it("parseSemver", async () => {
    const m = await import("@/lib/dataMigrationHelper");
    const v = m.parseSemver("2.1.3");
    expect(v).toEqual({ major: 2, minor: 1, patch: 3 });
    expect(m.parseSemver("invalid")).toBeNull();
  });

  it("compareSemver", async () => {
    const m = await import("@/lib/dataMigrationHelper");
    expect(m.compareSemver("1.0.0", "2.0.0")).toBe(-1);
    expect(m.compareSemver("2.0.0", "1.0.0")).toBe(1);
    expect(m.compareSemver("1.0.0", "1.0.0")).toBe(0);
  });

  it("getStepsBetween forward", async () => {
    const m = await import("@/lib/dataMigrationHelper");
    const result = m.getStepsBetween(steps, "1.0.0", "2.0.0");
    expect(result.length).toBe(2);
    expect(result[0].version).toBe("1.1.0");
    expect(result[1].version).toBe("2.0.0");
  });

  it("buildMigrationPlan", async () => {
    const m = await import("@/lib/dataMigrationHelper");
    const plan = m.buildMigrationPlan(steps, "1.0.0", "2.0.0");
    expect(plan.totalSteps).toBe(2);
    expect(plan.hasDestructive).toBe(true);
    expect(plan.requiresDowntime).toBe(true);
    expect(plan.rollbackPlan.length).toBe(2);
  });

  it("validateMigrationPlan", async () => {
    const m = await import("@/lib/dataMigrationHelper");
    const plan = m.buildMigrationPlan(steps, "1.0.0", "2.0.0");
    const validation = m.validateMigrationPlan(plan);
    expect(validation.valid).toBe(true);
    expect(validation.warnings.length).toBeGreaterThan(0); // destructive warning
  });

  it("validateSchemaSnapshot", async () => {
    const m = await import("@/lib/dataMigrationHelper");
    const before = { version: "1.0.0", tables: ["users", "logs"], timestamp: "2026-01-01" };
    const after = { version: "2.0.0", tables: ["users", "logs", "events"], timestamp: "2026-04-01" };
    const result = m.validateSchemaSnapshot(before, after, ["events"], []);
    expect(result.valid).toBe(true);
  });

  it("formatMigrationPlan", async () => {
    const m = await import("@/lib/dataMigrationHelper");
    const plan = m.buildMigrationPlan(steps, "1.0.0", "2.0.0");
    const formatted = m.formatMigrationPlan(plan);
    expect(formatted).toContain("Migration Plan");
    expect(formatted).toContain("2.0.0");
  });
});

// ── Q-182: Loyalty Tier System (Retention 94→95) ────────────

describe("Q-182: loyaltyTierSystem", () => {
  it("getTierForPoints", async () => {
    const m = await import("@/lib/loyaltyTierSystem");
    expect(m.getTierForPoints(0).name).toBe("White");
    expect(m.getTierForPoints(100).name).toBe("Blue");
    expect(m.getTierForPoints(5000).name).toBe("Black");
  });

  it("getNextTier", async () => {
    const m = await import("@/lib/loyaltyTierSystem");
    const white = m.getTierForPoints(0);
    expect(m.getNextTier(white)?.name).toBe("Blue");
    const black = m.getTierForPoints(5000);
    expect(m.getNextTier(black)).toBeNull();
  });

  it("calculateProgress", async () => {
    const m = await import("@/lib/loyaltyTierSystem");
    const blue = m.getTierForPoints(100);
    const purple = m.getNextTier(blue)!;
    const progress = m.calculateProgress(300, blue, purple);
    expect(progress.pointsToNext).toBe(200);
    expect(progress.progressPercent).toBe(50);
  });

  it("buildLoyaltyProfile", async () => {
    const m = await import("@/lib/loyaltyTierSystem");
    const profile = m.buildLoyaltyProfile("user1", 1600, 180, 15);
    expect(profile.tier.name).toBe("Brown");
    expect(profile.nextTier?.name).toBe("Black");
    expect(profile.pointsToNext).toBe(3400);
  });

  it("calculateActionPoints with cooldown", async () => {
    const m = await import("@/lib/loyaltyTierSystem");
    const eligible = m.calculateActionPoints("training_logged");
    expect(eligible.points).toBe(10);
    expect(eligible.eligible).toBe(true);

    const unknown = m.calculateActionPoints("nonexistent");
    expect(unknown.eligible).toBe(false);
  });

  it("suggestRetentionActions", async () => {
    const m = await import("@/lib/loyaltyTierSystem");
    const profile = m.buildLoyaltyProfile("user1", 95, 30, 6);
    const suggestions = m.suggestRetentionActions(profile);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes("5 points"))).toBe(true);
  });

  it("formatLoyaltyProfile", async () => {
    const m = await import("@/lib/loyaltyTierSystem");
    const profile = m.buildLoyaltyProfile("user1", 500, 90, 10);
    const formatted = m.formatLoyaltyProfile(profile);
    expect(formatted).toContain("Loyalty Profile");
    expect(formatted).toContain("Purple");
  });
});

// ── Q-183: Terms Version Manager (Legal 94→95) ─────────────

describe("Q-183: termsVersionManager", () => {
  it("compareTermsVersions", async () => {
    const m = await import("@/lib/termsVersionManager");
    expect(m.compareTermsVersions("1.0.0", "2.0.0")).toBe(-1);
    expect(m.compareTermsVersions("2.0.0", "1.0.0")).toBe(1);
    expect(m.compareTermsVersions("1.0", "1.0")).toBe(0);
  });

  it("isConsentCurrent", async () => {
    const m = await import("@/lib/termsVersionManager");
    expect(m.isConsentCurrent("2.0.0", "2.0.0")).toBe(true);
    expect(m.isConsentCurrent("1.0.0", "2.0.0")).toBe(false);
    expect(m.isConsentCurrent(null, "1.0.0")).toBe(false);
  });

  it("getConsentStatus", async () => {
    const m = await import("@/lib/termsVersionManager");
    const currentVersion: import("@/lib/termsVersionManager").TermsVersion = {
      id: "tos-2.0",
      document: "tos",
      version: "2.0.0",
      effectiveDate: "2026-04-01",
      summary: "Updated terms",
      requiresReAcceptance: true,
      changes: [],
    };
    const userConsent: import("@/lib/termsVersionManager").UserConsent = {
      userId: "u1",
      document: "tos",
      version: "1.0.0",
      acceptedAt: "2026-01-01T00:00:00Z",
    };
    const status = m.getConsentStatus(currentVersion, userConsent);
    expect(status.needsReAcceptance).toBe(true);
    expect(status.isAccepted).toBe(false);
  });

  it("buildConsentAudit", async () => {
    const m = await import("@/lib/termsVersionManager");
    const versions: import("@/lib/termsVersionManager").TermsVersion[] = [
      { id: "tos-2.0", document: "tos", version: "2.0.0", effectiveDate: "2026-04-01", summary: "Updated", requiresReAcceptance: true, changes: [] },
      { id: "pp-1.0", document: "privacy", version: "1.0.0", effectiveDate: "2026-01-01", summary: "Initial", requiresReAcceptance: false, changes: [] },
    ];
    const consents: import("@/lib/termsVersionManager").UserConsent[] = [
      { userId: "u1", document: "tos", version: "2.0.0", acceptedAt: new Date().toISOString() },
      { userId: "u1", document: "privacy", version: "1.0.0", acceptedAt: new Date().toISOString() },
    ];
    const report = m.buildConsentAudit("u1", versions, consents);
    expect(report.allCurrent).toBe(true);
    expect(report.pendingDocuments.length).toBe(0);
  });

  it("detectMaterialChanges", async () => {
    const m = await import("@/lib/termsVersionManager");
    const version: import("@/lib/termsVersionManager").TermsVersion = {
      id: "tos-2.0",
      document: "tos",
      version: "2.0.0",
      effectiveDate: "2026-04-01",
      summary: "Major update",
      requiresReAcceptance: true,
      changes: [
        { section: "§1", type: "modified", description: "Changed data usage", materialChange: true },
        { section: "§5", type: "added", description: "New clause", materialChange: false },
      ],
    };
    const material = m.detectMaterialChanges(version);
    expect(material.length).toBe(1);
    expect(m.requiresNotification(version)).toBe(true);
  });

  it("buildUpdateNotification", async () => {
    const m = await import("@/lib/termsVersionManager");
    const version: import("@/lib/termsVersionManager").TermsVersion = {
      id: "tos-2.0",
      document: "tos",
      version: "2.0.0",
      effectiveDate: "2026-04-01",
      summary: "Updated terms",
      requiresReAcceptance: true,
      changes: [{ section: "§1", type: "modified", description: "Data handling", materialChange: true }],
    };
    const notification = m.buildUpdateNotification(version);
    expect(notification).toContain("Terms of Service");
    expect(notification).toContain("re-accept");
  });

  it("formatConsentAudit", async () => {
    const m = await import("@/lib/termsVersionManager");
    const report = m.buildConsentAudit("u1", [], []);
    const formatted = m.formatConsentAudit(report);
    expect(formatted).toContain("Consent Audit");
  });
});

// ── Q-184: Revenue Forecaster (Cost 94→95) ─────────────────

describe("Q-184: revenueForecaster", () => {
  it("forecastRevenue basic", async () => {
    const m = await import("@/lib/revenueForecaster");
    const result = m.forecastRevenue({
      currentMRR: 1000,
      monthlyGrowthRate: 0.1,
      monthlyChurnRate: 0.03,
      expansionRate: 0.02,
      avgRevenuePerUser: 10,
      currentCustomers: 100,
      months: 6,
    });
    expect(result.months.length).toBe(6);
    expect(result.endMRR).toBeGreaterThan(1000);
    expect(result.endARR).toBeCloseTo(result.endMRR * 12, 1);
    expect(result.netRevenueRetention).toBeCloseTo(0.99, 2);
  });

  it("calculateNRR", async () => {
    const m = await import("@/lib/revenueForecaster");
    expect(m.calculateNRR(1000, 200, 100)).toBe(1.1); // 110% NRR
    expect(m.calculateNRR(0, 0, 0)).toBe(0);
  });

  it("calculateGrowthRate", async () => {
    const m = await import("@/lib/revenueForecaster");
    expect(m.calculateGrowthRate(1000, 1100)).toBeCloseTo(0.1, 5);
    expect(m.calculateGrowthRate(0, 100)).toBe(1);
  });

  it("analyzePricingSensitivity", async () => {
    const m = await import("@/lib/revenueForecaster");
    const results = m.analyzePricingSensitivity(10, 0.05, -1.5, 10000, [5, 10, 15, 20]);
    expect(results.length).toBe(4);
    // Lower price should have higher conversion
    expect(results[0].expectedConversion).toBeGreaterThan(results[3].expectedConversion);
  });

  it("evaluateRevenueHealth", async () => {
    const m = await import("@/lib/revenueForecaster");
    const health = m.evaluateRevenueHealth(0.01, 1.25, 0.15);
    expect(health[0].status).toBe("good"); // churn
    expect(health[1].status).toBe("good"); // NRR
    expect(health[2].status).toBe("good"); // growth
  });

  it("formatForecast", async () => {
    const m = await import("@/lib/revenueForecaster");
    const result = m.forecastRevenue({
      currentMRR: 1000,
      monthlyGrowthRate: 0.05,
      monthlyChurnRate: 0.02,
      expansionRate: 0.01,
      avgRevenuePerUser: 10,
      currentCustomers: 100,
      months: 3,
    });
    const formatted = m.formatForecast(result);
    expect(formatted).toContain("Revenue Forecast");
    expect(formatted).toContain("Month");
  });
});

// ── Q-185: Alert Escalation Policy (Ops 94→95) ─────────────

describe("Q-185: alertEscalationPolicy", () => {
  it("getPolicy", async () => {
    const m = await import("@/lib/alertEscalationPolicy");
    const p1 = m.getPolicy("P1");
    expect(p1.slaMinutes).toBe(60);
    expect(p1.tiers.length).toBe(3);
    const p4 = m.getPolicy("P4");
    expect(p4.slaMinutes).toBe(10080);
  });

  it("getCurrentEscalationLevel", async () => {
    const m = await import("@/lib/alertEscalationPolicy");
    expect(m.getCurrentEscalationLevel("P1", 5)).toBe(1);
    expect(m.getCurrentEscalationLevel("P1", 15)).toBe(2);
    expect(m.getCurrentEscalationLevel("P1", 35)).toBe(3);
  });

  it("calculateSLAStatus", async () => {
    const m = await import("@/lib/alertEscalationPolicy");
    const alert: import("@/lib/alertEscalationPolicy").AlertEvent = {
      id: "a1",
      severity: "P1",
      title: "DB down",
      description: "Primary DB unreachable",
      source: "monitor",
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
      escalationLevel: 1,
      escalationHistory: [],
    };
    const sla = m.calculateSLAStatus(alert);
    expect(sla.withinSLA).toBe(true);
    expect(sla.status).toBe("unacknowledged");
    expect(sla.elapsedMinutes).toBeCloseTo(30, 0);
  });

  it("calculateSLAStatus resolved", async () => {
    const m = await import("@/lib/alertEscalationPolicy");
    const now = Date.now();
    const alert: import("@/lib/alertEscalationPolicy").AlertEvent = {
      id: "a2",
      severity: "P2",
      title: "Slow API",
      description: "p95 above threshold",
      source: "apm",
      createdAt: new Date(now - 120 * 60 * 1000).toISOString(),
      acknowledgedAt: new Date(now - 100 * 60 * 1000).toISOString(),
      resolvedAt: new Date(now - 60 * 60 * 1000).toISOString(),
      escalationLevel: 1,
      escalationHistory: [],
    };
    const sla = m.calculateSLAStatus(alert);
    expect(sla.status).toBe("resolved");
    expect(sla.elapsedMinutes).toBeCloseTo(60, 0);
  });

  it("buildEscalationAudit", async () => {
    const m = await import("@/lib/alertEscalationPolicy");
    const now = Date.now();
    const alerts: import("@/lib/alertEscalationPolicy").AlertEvent[] = [
      {
        id: "a1", severity: "P1", title: "Test", description: "d", source: "s",
        createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
        acknowledgedAt: new Date(now - 55 * 60 * 1000).toISOString(),
        resolvedAt: new Date(now - 30 * 60 * 1000).toISOString(),
        escalationLevel: 1, escalationHistory: [],
      },
      {
        id: "a2", severity: "P3", title: "Test2", description: "d", source: "s",
        createdAt: new Date(now - 120 * 60 * 1000).toISOString(),
        resolvedAt: new Date(now - 60 * 60 * 1000).toISOString(),
        escalationLevel: 1, escalationHistory: [],
      },
    ];
    const report = m.buildEscalationAudit(alerts);
    expect(report.totalAlerts).toBe(2);
    expect(report.slaCompliance).toBeGreaterThan(0);
    expect(report.avgResolveTime).toBeGreaterThan(0);
  });

  it("buildEscalationAudit empty", async () => {
    const m = await import("@/lib/alertEscalationPolicy");
    const report = m.buildEscalationAudit([]);
    expect(report.totalAlerts).toBe(0);
    expect(report.slaCompliance).toBe(100);
  });

  it("formatEscalationAudit", async () => {
    const m = await import("@/lib/alertEscalationPolicy");
    const report = m.buildEscalationAudit([]);
    const formatted = m.formatEscalationAudit(report);
    expect(formatted).toContain("Escalation Audit Report");
  });
});

// ── Q-186: A/B Test Analyzer (Conversion 94→95) ────────────

describe("Q-186: abTestAnalyzer", () => {
  it("normalCDF", async () => {
    const m = await import("@/lib/abTestAnalyzer");
    expect(m.normalCDF(0)).toBeCloseTo(0.5, 2);
    expect(m.normalCDF(1.96)).toBeCloseTo(0.975, 2);
    expect(m.normalCDF(-1.96)).toBeCloseTo(0.025, 2);
  });

  it("conversionRate", async () => {
    const m = await import("@/lib/abTestAnalyzer");
    expect(m.conversionRate({ name: "A", visitors: 1000, conversions: 50 })).toBe(0.05);
    expect(m.conversionRate({ name: "B", visitors: 0, conversions: 0 })).toBe(0);
  });

  it("analyzeABTest significant", async () => {
    const m = await import("@/lib/abTestAnalyzer");
    const result = m.analyzeABTest({
      name: "CTA Color Test",
      hypothesis: "Green CTA converts better",
      primaryMetric: "signup_rate",
      control: { name: "A", visitors: 5000, conversions: 250 },
      treatment: { name: "B", visitors: 5000, conversions: 350 },
      startDate: "2026-04-01",
      confidenceLevel: 0.95,
    });
    expect(result.controlRate).toBeCloseTo(0.05, 3);
    expect(result.treatmentRate).toBeCloseTo(0.07, 3);
    expect(result.absoluteLift).toBeGreaterThan(0);
    expect(result.isSignificant).toBe(true);
    expect(result.recommendation).toBe("deploy");
  });

  it("analyzeABTest not significant (small sample)", async () => {
    const m = await import("@/lib/abTestAnalyzer");
    const result = m.analyzeABTest({
      name: "Small Test",
      hypothesis: "Test",
      primaryMetric: "click_rate",
      control: { name: "A", visitors: 50, conversions: 5 },
      treatment: { name: "B", visitors: 50, conversions: 6 },
      startDate: "2026-04-01",
      confidenceLevel: 0.95,
    });
    expect(result.recommendation).toBe("continue"); // too small sample
  });

  it("estimateSampleSize", async () => {
    const m = await import("@/lib/abTestAnalyzer");
    const estimate = m.estimateSampleSize(0.05, 0.01, 0.95, 0.8, 1000);
    expect(estimate.samplePerVariant).toBeGreaterThan(0);
    expect(estimate.totalSample).toBe(estimate.samplePerVariant * 2);
    expect(estimate.estimatedDays).toBeGreaterThan(0);
  });

  it("calculateRevenueLift", async () => {
    const m = await import("@/lib/abTestAnalyzer");
    const lift = m.calculateRevenueLift(
      { name: "A", visitors: 1000, conversions: 50, revenue: 5000 },
      { name: "B", visitors: 1000, conversions: 70, revenue: 7000 }
    );
    expect(lift.controlRPV).toBe(5);
    expect(lift.treatmentRPV).toBe(7);
    expect(lift.liftRPV).toBe(2);
  });

  it("formatABTestResult", async () => {
    const m = await import("@/lib/abTestAnalyzer");
    const result = m.analyzeABTest({
      name: "Test",
      hypothesis: "H",
      primaryMetric: "rate",
      control: { name: "A", visitors: 1000, conversions: 50 },
      treatment: { name: "B", visitors: 1000, conversions: 70 },
      startDate: "2026-04-01",
      confidenceLevel: 0.95,
    });
    const formatted = m.formatABTestResult(result);
    expect(formatted).toContain("A/B Test");
    expect(formatted).toContain("Recommendation");
  });
});

// ── Barrel Export Tests ─────────────────────────────────────

describe("Q-178~Q-186 barrel exports", () => {
  it("barrel includes all Q-178~Q-186 exports", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    // Q-178 themeValidator
    expect(idx).toContain("auditTheme");
    expect(idx).toContain("DARK_MODE_REQUIREMENTS");
    // Q-179 navigationFlow
    expect(idx).toContain("analyzeNavFlow");
    expect(idx).toContain("detectDeadEnds");
    // Q-180 localeNegotiator
    expect(idx).toContain("negotiateLocale");
    expect(idx).toContain("SUPPORTED_LOCALES");
    // Q-181 dataMigrationHelper
    expect(idx).toContain("buildMigrationPlan");
    expect(idx).toContain("validateMigrationPlan");
    // Q-182 loyaltyTierSystem
    expect(idx).toContain("buildLoyaltyProfile");
    expect(idx).toContain("LOYALTY_TIERS");
    // Q-183 termsVersionManager
    expect(idx).toContain("buildConsentAudit");
    expect(idx).toContain("TERMS_DOCUMENTS");
    // Q-184 revenueForecaster
    expect(idx).toContain("forecastRevenue");
    expect(idx).toContain("BENCHMARK_SAAS");
    // Q-185 alertEscalationPolicy
    expect(idx).toContain("buildEscalationAudit");
    expect(idx).toContain("DEFAULT_POLICIES");
    // Q-186 abTestAnalyzer
    expect(idx).toContain("analyzeABTest");
    expect(idx).toContain("estimateSampleSize");
  });
});
