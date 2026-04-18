/**
 * qualityQ196.test.ts — Tests for Q-196 through Q-202 modules
 *
 * Covers: seoStructuredData, localeRoutingOptimizer, zeroDowntimeDeploy,
 * dataLineageTracker, consentFlowAuditor, cloudCostAnalyzer, onboardingFunnelOptimizer
 *
 * ~70 tests total with barrel export verification.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";

/* ================================================================
 * 1. seoStructuredData (Q-196)
 * ================================================================ */
describe("seoStructuredData", () => {
  const load = () => import("@/lib/seoStructuredData");

  describe("validateStructuredData", () => {
    it("returns error when @context is missing", async () => {
      const { validateStructuredData } = await load();
      const errors = validateStructuredData({ "@type": "WebSite", name: "Test", url: "https://example.com" });
      expect(errors.some((e) => e.field === "@context")).toBe(true);
    });

    it("returns error for missing required fields", async () => {
      const { validateStructuredData, SCHEMA_CONTEXT } = await load();
      const errors = validateStructuredData({ "@context": SCHEMA_CONTEXT, "@type": "WebSite" });
      expect(errors.some((e) => e.field === "name" && e.severity === "error")).toBe(true);
      expect(errors.some((e) => e.field === "url" && e.severity === "error")).toBe(true);
    });

    it("returns warnings for missing recommended fields", async () => {
      const { validateStructuredData, SCHEMA_CONTEXT } = await load();
      const errors = validateStructuredData({ "@context": SCHEMA_CONTEXT, "@type": "WebSite", name: "Test", url: "https://x.com" });
      expect(errors.some((e) => e.severity === "warning")).toBe(true);
    });

    it("returns no errors for a valid entry with all fields", async () => {
      const { validateStructuredData, SCHEMA_CONTEXT } = await load();
      const errors = validateStructuredData({
        "@context": SCHEMA_CONTEXT,
        "@type": "WebSite",
        name: "Test",
        url: "https://x.com",
        description: "desc",
        potentialAction: {},
      });
      const errs = errors.filter((e) => e.severity === "error");
      expect(errs).toHaveLength(0);
    });
  });

  describe("generateWebSiteSchema", () => {
    it("generates basic WebSite schema", async () => {
      const { generateWebSiteSchema, SCHEMA_CONTEXT } = await load();
      const schema = generateWebSiteSchema("BJJ App", "https://bjj-app.net");
      expect(schema["@context"]).toBe(SCHEMA_CONTEXT);
      expect(schema["@type"]).toBe("WebSite");
      expect(schema.name).toBe("BJJ App");
      expect(schema.url).toBe("https://bjj-app.net");
    });

    it("includes potentialAction when searchUrl provided", async () => {
      const { generateWebSiteSchema } = await load();
      const schema = generateWebSiteSchema("App", "https://x.com", "https://x.com/search");
      expect(schema.potentialAction).toBeDefined();
    });
  });

  describe("generateBreadcrumbSchema", () => {
    it("generates BreadcrumbList with correct positions", async () => {
      const { generateBreadcrumbSchema } = await load();
      const schema = generateBreadcrumbSchema([
        { name: "Home", url: "/" },
        { name: "Records", url: "/records" },
      ]);
      expect(schema["@type"]).toBe("BreadcrumbList");
      const items = schema.itemListElement as { position: number; name: string }[];
      expect(items).toHaveLength(2);
      expect(items[0].position).toBe(1);
      expect(items[1].position).toBe(2);
    });
  });

  describe("generateFAQSchema", () => {
    it("generates FAQPage with Question/Answer pairs", async () => {
      const { generateFAQSchema } = await load();
      const schema = generateFAQSchema([{ question: "Q?", answer: "A." }]);
      expect(schema["@type"]).toBe("FAQPage");
      const main = schema.mainEntity as { "@type": string; name: string }[];
      expect(main).toHaveLength(1);
      expect(main[0]["@type"]).toBe("Question");
    });
  });

  describe("generateSoftwareAppSchema", () => {
    it("generates SoftwareApplication with rating and offers", async () => {
      const { generateSoftwareAppSchema } = await load();
      const schema = generateSoftwareAppSchema("BJJ App", "Web", 4.7, "0");
      expect(schema["@type"]).toBe("SoftwareApplication");
      expect(schema.applicationCategory).toBe("SportsApplication");
      expect((schema.aggregateRating as { ratingValue: string }).ratingValue).toBe("4.7");
      expect((schema.offers as { price: string }).price).toBe("0");
    });
  });

  describe("auditPageSEO", () => {
    it("returns perfect score for fully configured page", async () => {
      const { auditPageSEO, generateWebSiteSchema, generateBreadcrumbSchema } = await load();
      const ws = generateWebSiteSchema("App", "https://x.com", "https://x.com/s");
      const bc = generateBreadcrumbSchema([{ name: "Home", url: "/" }]);
      const result = auditPageSEO([ws, bc], "Title", "A good description that is long enough to pass", "https://x.com", "https://x.com/og.png");
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.hasTitle).toBe(true);
      expect(result.hasDescription).toBe(true);
      expect(result.hasCanonical).toBe(true);
      expect(result.hasOgImage).toBe(true);
    });

    it("deducts for missing title and description", async () => {
      const { auditPageSEO } = await load();
      const result = auditPageSEO([], undefined, undefined, undefined, undefined);
      expect(result.score).toBeLessThan(60);
      expect(result.hasTitle).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("formatSEOAudit", () => {
    it("includes header and score line", async () => {
      const { formatSEOAudit, auditPageSEO } = await load();
      const audit = auditPageSEO([], "T", "D is long enough to be fine here", "https://x.com", undefined);
      const text = formatSEOAudit(audit);
      expect(text).toContain("=== SEO Structured Data Audit ===");
      expect(text).toContain("Score:");
    });
  });
});

/* ================================================================
 * 2. localeRoutingOptimizer (Q-197)
 * ================================================================ */
describe("localeRoutingOptimizer", () => {
  const load = () => import("@/lib/localeRoutingOptimizer");

  describe("buildHreflangTags", () => {
    it("includes x-default entry", async () => {
      const { buildHreflangTags } = await load();
      const tags = buildHreflangTags("/dashboard");
      expect(tags.some((t) => t.locale === "x-default")).toBe(true);
    });

    it("generates entries for all supported locales plus x-default", async () => {
      const { buildHreflangTags, SUPPORTED_LOCALES } = await load();
      const tags = buildHreflangTags("/");
      // one per locale + x-default
      expect(tags).toHaveLength(SUPPORTED_LOCALES.length + 1);
    });

    it("default locale URL has no prefix", async () => {
      const { buildHreflangTags, DEFAULT_LOCALE } = await load();
      const tags = buildHreflangTags("/about");
      const defaultTag = tags.find((t) => t.locale === DEFAULT_LOCALE);
      expect(defaultTag?.url).not.toContain(`/${DEFAULT_LOCALE}/`);
    });
  });

  describe("detectUserLocale", () => {
    it("returns cookie locale when valid", async () => {
      const { detectUserLocale } = await load();
      expect(detectUserLocale("en", "pt-BR")).toBe("pt-BR");
    });

    it("returns geo locale when no cookie", async () => {
      const { detectUserLocale } = await load();
      expect(detectUserLocale("en", undefined, "BR")).toBe("pt-BR");
    });

    it("parses Accept-Language header", async () => {
      const { detectUserLocale } = await load();
      expect(detectUserLocale("pt-PT;q=0.9, en;q=0.8")).toBe("pt-BR");
    });

    it("returns default when no signals match", async () => {
      const { detectUserLocale, DEFAULT_LOCALE } = await load();
      expect(detectUserLocale("")).toBe(DEFAULT_LOCALE);
    });
  });

  describe("buildLocalizedUrl", () => {
    it("default locale has no prefix", async () => {
      const { buildLocalizedUrl, DEFAULT_LOCALE } = await load();
      const url = buildLocalizedUrl("/records", DEFAULT_LOCALE);
      expect(url).toBe("https://bjj-app.net/records");
    });

    it("non-default locale includes prefix", async () => {
      const { buildLocalizedUrl } = await load();
      const url = buildLocalizedUrl("/records", "en");
      expect(url).toBe("https://bjj-app.net/en/records");
    });
  });

  describe("validateLocaleRoutes", () => {
    it("detects missing translations", async () => {
      const { validateLocaleRoutes } = await load();
      const issues = validateLocaleRoutes([
        { path: "/", locale: "ja", translated: true },
      ]);
      expect(issues.some((i) => i.type === "missing_translation")).toBe(true);
    });

    it("no issues when all locales covered", async () => {
      const { validateLocaleRoutes, SUPPORTED_LOCALES } = await load();
      const routes = SUPPORTED_LOCALES.map((locale) => ({ path: "/", locale, translated: true }));
      const issues = validateLocaleRoutes(routes);
      expect(issues).toHaveLength(0);
    });
  });

  describe("auditLocaleRouting", () => {
    it("returns high score for full coverage", async () => {
      const { auditLocaleRouting, SUPPORTED_LOCALES } = await load();
      const routes = SUPPORTED_LOCALES.map((locale) => ({ path: "/", locale, translated: true }));
      const audit = auditLocaleRouting(routes, ["/"]);
      expect(audit.score).toBeGreaterThanOrEqual(80);
      expect(audit.coveragePercent).toBe(100);
    });
  });

  describe("formatLocaleRoutingAudit", () => {
    it("includes header", async () => {
      const { formatLocaleRoutingAudit, auditLocaleRouting } = await load();
      const audit = auditLocaleRouting([], []);
      const text = formatLocaleRoutingAudit(audit);
      expect(text).toContain("=== Locale Routing Audit ===");
    });
  });
});

/* ================================================================
 * 3. zeroDowntimeDeploy (Q-198)
 * ================================================================ */
describe("zeroDowntimeDeploy", () => {
  const load = () => import("@/lib/zeroDowntimeDeploy");

  describe("createDeployPlan", () => {
    it("rolling strategy creates multiple phases", async () => {
      const { createDeployPlan } = await load();
      const plan = createDeployPlan("rolling", "1.0.0", "1.1.0", 6);
      expect(plan.strategy).toBe("rolling");
      expect(plan.phases.length).toBeGreaterThanOrEqual(2);
      expect(plan.rollbackPlan).toContain("1.0.0");
    });

    it("blue-green creates 3 phases", async () => {
      const { createDeployPlan } = await load();
      const plan = createDeployPlan("blue-green", "1.0.0", "2.0.0", 4);
      expect(plan.phases).toHaveLength(3);
      expect(plan.rollbackPlan).toContain("blue");
    });

    it("canary creates phases matching CANARY_TRAFFIC_STEPS", async () => {
      const { createDeployPlan, CANARY_TRAFFIC_STEPS } = await load();
      const plan = createDeployPlan("canary", "1.0.0", "1.2.0", 10);
      expect(plan.phases).toHaveLength(CANARY_TRAFFIC_STEPS.length);
    });
  });

  describe("evaluateHealthCheck", () => {
    it("healthy for 200 with low response time", async () => {
      const { evaluateHealthCheck } = await load();
      const result = evaluateHealthCheck("/api/health", 200, 100);
      expect(result.status).toBe("healthy");
      expect(result.message).toBe("OK");
    });

    it("unhealthy for 500 status", async () => {
      const { evaluateHealthCheck } = await load();
      const result = evaluateHealthCheck("/api/health", 500, 50);
      expect(result.status).toBe("unhealthy");
    });

    it("degraded for high response time", async () => {
      const { evaluateHealthCheck } = await load();
      const result = evaluateHealthCheck("/api/health", 200, 800);
      expect(result.status).toBe("degraded");
    });

    it("unhealthy when body reports error", async () => {
      const { evaluateHealthCheck } = await load();
      const result = evaluateHealthCheck("/api/health", 200, 100, { status: "error", message: "DB down" });
      expect(result.status).toBe("unhealthy");
    });
  });

  describe("shouldRollback", () => {
    it("rollback when all unhealthy", async () => {
      const { shouldRollback } = await load();
      const res = shouldRollback([
        { endpoint: "/api/health", status: "unhealthy", statusCode: 500, responseTimeMs: 100, message: "err" },
      ]);
      expect(res.rollback).toBe(true);
    });

    it("no rollback when all healthy", async () => {
      const { shouldRollback } = await load();
      const res = shouldRollback([
        { endpoint: "/api/health", status: "healthy", statusCode: 200, responseTimeMs: 50, message: "OK" },
      ]);
      expect(res.rollback).toBe(false);
    });

    it("rollback when no health results", async () => {
      const { shouldRollback } = await load();
      expect(shouldRollback([]).rollback).toBe(true);
    });
  });

  describe("calculateCanaryTraffic", () => {
    it("returns 0 for phase 0", async () => {
      const { calculateCanaryTraffic } = await load();
      expect(calculateCanaryTraffic(0, 6)).toBe(0);
    });

    it("returns 100 when phase >= totalPhases", async () => {
      const { calculateCanaryTraffic } = await load();
      expect(calculateCanaryTraffic(10, 6)).toBe(100);
    });
  });

  describe("auditDeployReadiness", () => {
    it("returns ready with healthy checks and valid plan", async () => {
      const { auditDeployReadiness, createDeployPlan, HEALTH_CHECK_ENDPOINTS } = await load();
      const plan = createDeployPlan("rolling", "1.0.0", "1.1.0", 4);
      const checks = HEALTH_CHECK_ENDPOINTS.map((e) => ({
        endpoint: e,
        status: "healthy" as const,
        statusCode: 200,
        responseTimeMs: 50,
        message: "OK",
      }));
      const audit = auditDeployReadiness(plan, checks, [{ name: "add_col", reversible: true }]);
      expect(audit.readiness).toBe("ready");
      expect(audit.score).toBeGreaterThanOrEqual(80);
    });
  });

  describe("formatDeployPlan", () => {
    it("contains strategy and version", async () => {
      const { formatDeployPlan, createDeployPlan } = await load();
      const plan = createDeployPlan("blue-green", "1.0.0", "2.0.0", 2);
      const text = formatDeployPlan(plan);
      expect(text).toContain("blue-green");
      expect(text).toContain("1.0.0");
      expect(text).toContain("2.0.0");
    });
  });
});

/* ================================================================
 * 4. dataLineageTracker (Q-199)
 * ================================================================ */
describe("dataLineageTracker", () => {
  const load = () => import("@/lib/dataLineageTracker");

  const makeGraph = async () => {
    const { buildLineageGraph } = await load();
    const nodes = [
      { id: "users", name: "Users Table", source: "database" as const, fields: ["email", "full_name"], isProtected: true },
      { id: "analytics", name: "Analytics", source: "computed" as const, fields: ["email"], isProtected: false },
      { id: "orphan", name: "Orphan", source: "api" as const, fields: ["data"], isProtected: true },
    ];
    const edges = [{ from: "users", to: "analytics", fields: ["email"] }];
    return buildLineageGraph(nodes, edges);
  };

  describe("buildLineageGraph", () => {
    it("creates graph with nodeMap", async () => {
      const graph = await makeGraph();
      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(1);
      expect(graph.nodeMap["users"]).toBeDefined();
    });
  });

  describe("traceDataOrigin", () => {
    it("finds source nodes for a field", async () => {
      const { traceDataOrigin } = await load();
      const graph = await makeGraph();
      const sources = traceDataOrigin(graph, "email");
      expect(sources.some((n) => n.id === "users")).toBe(true);
    });

    it("returns empty for non-existent field", async () => {
      const { traceDataOrigin } = await load();
      const graph = await makeGraph();
      const sources = traceDataOrigin(graph, "nonexistent");
      expect(sources).toHaveLength(0);
    });
  });

  describe("findDownstreamDependencies", () => {
    it("finds downstream nodes", async () => {
      const { findDownstreamDependencies } = await load();
      const graph = await makeGraph();
      const deps = findDownstreamDependencies(graph, "users");
      expect(deps.some((n) => n.id === "analytics")).toBe(true);
    });

    it("returns empty from leaf node", async () => {
      const { findDownstreamDependencies } = await load();
      const graph = await makeGraph();
      const deps = findDownstreamDependencies(graph, "analytics");
      expect(deps).toHaveLength(0);
    });
  });

  describe("detectPIIFlow", () => {
    it("detects PII flowing to unprotected sink", async () => {
      const { detectPIIFlow } = await load();
      const graph = await makeGraph();
      const violations = detectPIIFlow(graph);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.field === "email" && v.sinkName === "Analytics")).toBe(true);
    });
  });

  describe("auditDataLineage", () => {
    it("detects orphaned nodes and PII violations", async () => {
      const { auditDataLineage } = await load();
      const graph = await makeGraph();
      const audit = auditDataLineage(graph);
      expect(audit.orphanedNodes).toBe(1);
      expect(audit.piiViolations.length).toBeGreaterThan(0);
      expect(audit.score).toBeLessThan(100);
    });

    it("perfect score for clean graph", async () => {
      const { auditDataLineage, buildLineageGraph } = await load();
      const graph = buildLineageGraph(
        [
          { id: "a", name: "A", source: "database", fields: ["data"], isProtected: true },
          { id: "b", name: "B", source: "computed", fields: ["data"], isProtected: true },
        ],
        [{ from: "a", to: "b", fields: ["data"] }]
      );
      const audit = auditDataLineage(graph);
      expect(audit.score).toBe(100);
    });
  });

  describe("formatLineageAudit", () => {
    it("contains header and node/edge counts", async () => {
      const { formatLineageAudit, auditDataLineage } = await load();
      const graph = await makeGraph();
      const audit = auditDataLineage(graph);
      const text = formatLineageAudit(audit);
      expect(text).toContain("=== Data Lineage Audit ===");
      expect(text).toContain("Nodes:");
    });
  });
});

/* ================================================================
 * 5. consentFlowAuditor (Q-200)
 * ================================================================ */
describe("consentFlowAuditor", () => {
  const load = () => import("@/lib/consentFlowAuditor");

  const goodStep = (): import("@/lib/consentFlowAuditor").ConsentFlowStep => ({
    id: "analytics",
    purpose: "analytics",
    label: "Analytics Cookies",
    preChecked: false,
    required: false,
    rejectOptionVisible: true,
    rejectButtonSameSize: true,
    withdrawEasy: true,
    description: "We use analytics cookies to understand usage patterns and improve the app.",
    linkToPolicy: true,
  });

  const badStep = (): import("@/lib/consentFlowAuditor").ConsentFlowStep => ({
    id: "marketing",
    purpose: "marketing",
    label: "Marketing Cookies",
    preChecked: true,
    required: true,
    rejectOptionVisible: false,
    rejectButtonSameSize: false,
    withdrawEasy: false,
    description: "We might share data unless you don't opt out.",
    linkToPolicy: false,
  });

  describe("validateConsentFlow", () => {
    it("returns no violations for compliant steps", async () => {
      const { validateConsentFlow } = await load();
      const violations = validateConsentFlow([goodStep()]);
      expect(violations).toHaveLength(0);
    });

    it("detects forced consent and pre-checked", async () => {
      const { validateConsentFlow } = await load();
      const violations = validateConsentFlow([badStep()]);
      expect(violations.some((v) => v.rule === "forced_consent")).toBe(true);
      expect(violations.some((v) => v.rule === "pre_checked")).toBe(true);
    });

    it("returns critical violation for empty flow", async () => {
      const { validateConsentFlow } = await load();
      const violations = validateConsentFlow([]);
      expect(violations.some((v) => v.rule === "no_consent_flow")).toBe(true);
    });
  });

  describe("checkConsentExpiry", () => {
    it("returns valid for recent consent", async () => {
      const { checkConsentExpiry } = await load();
      const today = new Date().toISOString().split("T")[0];
      const result = checkConsentExpiry(today);
      expect(result.status).toBe("valid");
      expect(result.daysRemaining).toBeGreaterThan(300);
    });

    it("returns expired for old consent", async () => {
      const { checkConsentExpiry } = await load();
      const result = checkConsentExpiry("2020-01-01");
      expect(result.status).toBe("expired");
      expect(result.daysRemaining).toBe(0);
    });
  });

  describe("detectDarkPatterns", () => {
    it("detects pre-checked and hidden reject", async () => {
      const { detectDarkPatterns } = await load();
      const patterns = detectDarkPatterns([badStep()]);
      expect(patterns.some((p) => p.type === "pre_checked")).toBe(true);
      expect(patterns.some((p) => p.type === "hidden_reject")).toBe(true);
      expect(patterns.some((p) => p.type === "forced_consent")).toBe(true);
    });

    it("detects confusing language", async () => {
      const { detectDarkPatterns } = await load();
      const patterns = detectDarkPatterns([badStep()]);
      expect(patterns.some((p) => p.type === "confusing_language")).toBe(true);
    });

    it("returns empty for compliant step", async () => {
      const { detectDarkPatterns } = await load();
      const patterns = detectDarkPatterns([goodStep()]);
      expect(patterns).toHaveLength(0);
    });
  });

  describe("auditConsentCompliance", () => {
    it("high score for compliant GDPR flow", async () => {
      const { auditConsentCompliance } = await load();
      const audit = auditConsentCompliance([goodStep()], "gdpr");
      expect(audit.score).toBeGreaterThanOrEqual(80);
      expect(audit.compliance.some((c) => c.regulation === "gdpr")).toBe(true);
    });

    it("low score for non-compliant flow", async () => {
      const { auditConsentCompliance } = await load();
      const audit = auditConsentCompliance([badStep()], "both");
      expect(audit.score).toBeLessThan(70);
      expect(audit.darkPatterns.length).toBeGreaterThan(0);
    });
  });

  describe("buildConsentReport", () => {
    it("includes gdpr and ccpa for 'both'", async () => {
      const { buildConsentReport } = await load();
      const report = buildConsentReport([goodStep()], "both");
      expect(report.gdprCompliance).not.toBeNull();
      expect(report.ccpaCompliance).not.toBeNull();
      expect(report.totalSteps).toBe(1);
      expect(report.validSteps).toBe(1);
    });
  });

  describe("formatConsentReport", () => {
    it("contains header and score", async () => {
      const { formatConsentReport, buildConsentReport } = await load();
      const report = buildConsentReport([goodStep()], "gdpr");
      const text = formatConsentReport(report);
      expect(text).toContain("=== Consent Flow Compliance Report ===");
      expect(text).toContain("Overall Score:");
    });
  });
});

/* ================================================================
 * 6. cloudCostAnalyzer (Q-201)
 * ================================================================ */
describe("cloudCostAnalyzer", () => {
  const load = () => import("@/lib/cloudCostAnalyzer");

  const makeEntries = (): import("@/lib/cloudCostAnalyzer").CostEntry[] => [
    { service: "compute", date: "2026-04-01", amount: 30, currency: "USD" },
    { service: "compute", date: "2026-04-02", amount: 25, currency: "USD" },
    { service: "compute", date: "2026-04-03", amount: 100, currency: "USD" }, // spike
    { service: "storage", date: "2026-04-01", amount: 5, currency: "USD" },
    { service: "storage", date: "2026-04-02", amount: 6, currency: "USD" },
  ];

  describe("detectCostAnomalies", () => {
    it("detects spike anomaly", async () => {
      const { detectCostAnomalies } = await load();
      const anomalies = detectCostAnomalies(makeEntries());
      expect(anomalies.some((a) => a.service === "compute" && a.type === "spike")).toBe(true);
    });

    it("returns empty for normal costs", async () => {
      const { detectCostAnomalies } = await load();
      const entries: import("@/lib/cloudCostAnalyzer").CostEntry[] = [
        { service: "storage", date: "2026-04-01", amount: 5, currency: "USD" },
        { service: "storage", date: "2026-04-02", amount: 5, currency: "USD" },
      ];
      const anomalies = detectCostAnomalies(entries);
      expect(anomalies).toHaveLength(0);
    });
  });

  describe("calculateCostTrend", () => {
    it("returns stable for flat costs", async () => {
      const { calculateCostTrend } = await load();
      const entries: import("@/lib/cloudCostAnalyzer").CostEntry[] = [
        { service: "compute", date: "2026-04-01", amount: 10, currency: "USD" },
        { service: "compute", date: "2026-04-02", amount: 10, currency: "USD" },
      ];
      const trend = calculateCostTrend(entries);
      expect(trend.direction).toBe("stable");
    });

    it("returns stable for single entry", async () => {
      const { calculateCostTrend } = await load();
      const trend = calculateCostTrend([{ service: "compute", date: "2026-04-01", amount: 10, currency: "USD" }]);
      expect(trend.direction).toBe("stable");
      expect(trend.ratePerDay).toBe(0);
    });
  });

  describe("suggestOptimizations", () => {
    it("suggests optimizations for over-baseline services", async () => {
      const { suggestOptimizations } = await load();
      const entries: import("@/lib/cloudCostAnalyzer").CostEntry[] = [
        { service: "compute", date: "2026-04-01", amount: 50, currency: "USD" },
      ];
      const opts = suggestOptimizations(entries);
      expect(opts.length).toBeGreaterThan(0);
      expect(opts[0].service).toBe("compute");
    });

    it("returns empty when costs are within baseline", async () => {
      const { suggestOptimizations } = await load();
      const entries: import("@/lib/cloudCostAnalyzer").CostEntry[] = [
        { service: "push", date: "2026-04-01", amount: 1, currency: "USD" },
      ];
      const opts = suggestOptimizations(entries);
      expect(opts).toHaveLength(0);
    });
  });

  describe("forecastMonthlyCost", () => {
    it("projects from partial data", async () => {
      const { forecastMonthlyCost } = await load();
      const entries: import("@/lib/cloudCostAnalyzer").CostEntry[] = [
        { service: "compute", date: "2026-04-01", amount: 10, currency: "USD" },
        { service: "compute", date: "2026-04-02", amount: 10, currency: "USD" },
      ];
      const forecast = forecastMonthlyCost(entries, 30);
      expect(forecast.projected).toBe(300); // 20/2days * 30
      expect(forecast.daysElapsed).toBe(2);
    });

    it("returns zero for empty entries", async () => {
      const { forecastMonthlyCost } = await load();
      const forecast = forecastMonthlyCost([]);
      expect(forecast.projected).toBe(0);
    });
  });

  describe("buildCostReport", () => {
    it("builds report with all sections", async () => {
      const { buildCostReport } = await load();
      const report = buildCostReport(makeEntries());
      expect(report.totalCost).toBeGreaterThan(0);
      expect(report.costByService.compute).toBeDefined();
      expect(report.trend).toBeDefined();
      expect(report.forecast).toBeDefined();
    });
  });

  describe("formatCostReport", () => {
    it("contains header and total cost", async () => {
      const { formatCostReport, buildCostReport } = await load();
      const report = buildCostReport(makeEntries());
      const text = formatCostReport(report);
      expect(text).toContain("=== Cloud Cost Analysis Report ===");
      expect(text).toContain("Total Cost:");
    });
  });
});

/* ================================================================
 * 7. onboardingFunnelOptimizer (Q-202)
 * ================================================================ */
describe("onboardingFunnelOptimizer", () => {
  const load = () => import("@/lib/onboardingFunnelOptimizer");

  const makeMetrics = (): import("@/lib/onboardingFunnelOptimizer").StepMetrics[] => [
    { step: "signup", entered: 1000, completed: 900, avgTimeToCompleteSec: 30, dropOffCount: 100 },
    { step: "profile_setup", entered: 900, completed: 700, avgTimeToCompleteSec: 60, dropOffCount: 200 },
    { step: "first_training", entered: 700, completed: 400, avgTimeToCompleteSec: 120, dropOffCount: 300 },
    { step: "feature_discovery", entered: 400, completed: 200, avgTimeToCompleteSec: 90, dropOffCount: 200 },
    { step: "pro_trial", entered: 200, completed: 50, avgTimeToCompleteSec: 45, dropOffCount: 150 },
  ];

  describe("analyzeOnboardingFunnel", () => {
    it("calculates conversion and drop-off rates", async () => {
      const { analyzeOnboardingFunnel } = await load();
      const analysis = analyzeOnboardingFunnel(makeMetrics());
      expect(analysis).toHaveLength(5);
      expect(analysis[0].conversionRate).toBe(0.9);
      expect(analysis[0].dropOffRate).toBe(0.1);
    });

    it("handles zero entered", async () => {
      const { analyzeOnboardingFunnel } = await load();
      const analysis = analyzeOnboardingFunnel([
        { step: "signup", entered: 0, completed: 0, avgTimeToCompleteSec: 0, dropOffCount: 0 },
      ]);
      expect(analysis[0].conversionRate).toBe(0);
      expect(analysis[0].dropOffRate).toBe(0);
    });
  });

  describe("identifyDropOffReasons", () => {
    it("returns reasons sorted by likelihood", async () => {
      const { identifyDropOffReasons } = await load();
      const reasons = identifyDropOffReasons("signup", {
        step: "signup",
        entered: 100,
        completed: 50,
        avgTimeToCompleteSec: 30,
        dropOffCount: 50,
      });
      expect(reasons.length).toBeGreaterThan(0);
      // Should be sorted descending by likelihood
      for (let i = 1; i < reasons.length; i++) {
        expect(reasons[i - 1].likelihood).toBeGreaterThanOrEqual(reasons[i].likelihood);
      }
    });

    it("returns zero likelihoods when no drop-off", async () => {
      const { identifyDropOffReasons } = await load();
      const reasons = identifyDropOffReasons("signup", {
        step: "signup",
        entered: 100,
        completed: 100,
        avgTimeToCompleteSec: 30,
        dropOffCount: 0,
      });
      expect(reasons.every((r) => r.likelihood === 0)).toBe(true);
    });
  });

  describe("suggestOnboardingImprovements", () => {
    it("suggests improvements for underperforming steps", async () => {
      const { suggestOnboardingImprovements } = await load();
      const improvements = suggestOnboardingImprovements(makeMetrics());
      expect(improvements.length).toBeGreaterThan(0);
    });

    it("sorted by priority", async () => {
      const { suggestOnboardingImprovements } = await load();
      const improvements = suggestOnboardingImprovements(makeMetrics());
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < improvements.length; i++) {
        expect(order[improvements[i - 1].priority]).toBeLessThanOrEqual(order[improvements[i].priority]);
      }
    });
  });

  describe("calculateTimeToValue", () => {
    it("sums time up to first_training", async () => {
      const { calculateTimeToValue } = await load();
      const ttv = calculateTimeToValue(makeMetrics());
      // signup(30) + profile_setup(60) + first_training(120) = 210
      expect(ttv.totalSec).toBe(210);
      expect(ttv.formatted).toBe("3m 30s");
    });

    it("returns 0s for empty steps", async () => {
      const { calculateTimeToValue } = await load();
      const ttv = calculateTimeToValue([]);
      expect(ttv.totalSec).toBe(0);
      expect(ttv.formatted).toBe("0s");
    });
  });

  describe("compareWithBenchmarks", () => {
    it("marks steps above/at/below benchmark", async () => {
      const { compareWithBenchmarks } = await load();
      const comparisons = compareWithBenchmarks(makeMetrics());
      expect(comparisons).toHaveLength(5);
      // signup: 0.9 actual vs 0.9 benchmark -> "at"
      expect(comparisons[0].status).toBe("at");
    });

    it("identifies below-benchmark steps", async () => {
      const { compareWithBenchmarks } = await load();
      const metrics: import("@/lib/onboardingFunnelOptimizer").StepMetrics[] = [
        { step: "signup", entered: 100, completed: 50, avgTimeToCompleteSec: 30, dropOffCount: 50 },
      ];
      const comparisons = compareWithBenchmarks(metrics);
      expect(comparisons[0].status).toBe("below");
    });
  });

  describe("buildOnboardingReport", () => {
    it("builds full report with score", async () => {
      const { buildOnboardingReport } = await load();
      const report = buildOnboardingReport(makeMetrics());
      expect(report.totalEntered).toBe(1000);
      expect(report.totalCompleted).toBe(50);
      expect(report.overallConversionRate).toBe(0.05);
      expect(report.biggestDropOff).not.toBeNull();
      expect(report.stepAnalysis).toHaveLength(5);
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    });
  });

  describe("formatOnboardingReport", () => {
    it("contains header and step analysis", async () => {
      const { formatOnboardingReport, buildOnboardingReport } = await load();
      const report = buildOnboardingReport(makeMetrics());
      const text = formatOnboardingReport(report);
      expect(text).toContain("=== Onboarding Funnel Report ===");
      expect(text).toContain("Step Analysis:");
      expect(text).toContain("Sign Up:");
    });
  });
});

/* ================================================================
 * Barrel export verification (Q-196~Q-202)
 * ================================================================ */
describe("barrel exports (Q-196~Q-202)", () => {
  const barrel = fs.readFileSync(
    new URL("../lib/index.ts", import.meta.url),
    "utf-8"
  );

  it("Q-196 seoStructuredData", () => {
    expect(barrel).toContain("seoStructuredData");
  });

  it("Q-197 localeRoutingOptimizer", () => {
    expect(barrel).toContain("localeRoutingOptimizer");
  });

  it("Q-198 zeroDowntimeDeploy", () => {
    expect(barrel).toContain("zeroDowntimeDeploy");
  });

  it("Q-199 dataLineageTracker", () => {
    expect(barrel).toContain("dataLineageTracker");
  });

  it("Q-200 consentFlowAuditor", () => {
    expect(barrel).toContain("consentFlowAuditor");
  });

  it("Q-201 cloudCostAnalyzer", () => {
    expect(barrel).toContain("cloudCostAnalyzer");
  });

  it("Q-202 onboardingFunnelOptimizer", () => {
    expect(barrel).toContain("onboardingFunnelOptimizer");
  });
});
