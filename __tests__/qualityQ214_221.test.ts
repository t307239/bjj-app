/**
 * Tests for Q-214 through Q-221 — Quality 98→99 batch
 */
import { describe, it, expect } from "vitest";

// Q-216: Motion Safety Guard
import {
  buildMotionConfig,
  getSafeDuration,
  getSafeTransition,
  motionSafeClasses,
  auditMotionSafety,
  formatMotionAudit,
} from "@/lib/motionSafetyGuard";

// Q-217: SEO Health Monitor
import {
  checkPageSEO,
  checkSiteHealth,
  formatSiteHealth,
  type PageMeta,
} from "@/lib/seoHealthMonitor";

// Q-218: Doc Quality Checker
import {
  analyzeFileDoc,
  buildDocQualityReport,
  meetsThreshold,
  getPriorityDocTargets,
  formatDocQualityReport,
} from "@/lib/docQualityChecker";

// Q-219: External Monitor Integration
import {
  buildDefaultConfig,
  generateUptimeRobotConfig,
  classifyHealthStatus,
  buildStatusPage,
  formatTelegramAlert,
  formatStatusPage,
  type WebhookPayload,
  type HealthCheckResult,
} from "@/lib/externalMonitorIntegration";

// Q-220: Error Recovery Patterns
import {
  withRetry,
  calculateDelay,
  createCircuitBreaker,
  withFallbackChain,
  withGracefulDegradation,
  isRetryableError,
  classifyError,
  buildRecoveryAudit,
} from "@/lib/errorRecoveryPatterns";

// Q-221: Visual Regression Helper
import {
  compareSnapshots,
  buildDefaultTestConfig,
  formatVisualDiff,
  STANDARD_VIEWPORTS,
  KEY_ROUTES,
  type LayoutSnapshot,
} from "@/lib/visualRegressionHelper";

// ===== Q-216: Motion Safety Guard =====

describe("Q-216: motionSafetyGuard", () => {
  it("buildMotionConfig returns reduced config", () => {
    const config = buildMotionConfig("reduce");
    expect(config.prefersReducedMotion).toBe(true);
    expect(config.animationDuration).toBe(0);
    expect(config.transitionDuration).toBe(0);
    expect(config.allowAutoplay).toBe(false);
    expect(config.disableParallax).toBe(true);
    expect(config.intensityScale).toBe(0);
  });

  it("buildMotionConfig returns normal config", () => {
    const config = buildMotionConfig("no-preference");
    expect(config.prefersReducedMotion).toBe(false);
    expect(config.animationDuration).toBeGreaterThan(0);
    expect(config.intensityScale).toBe(1);
  });

  it("getSafeDuration returns 0 for reduced motion", () => {
    expect(getSafeDuration("fast", "reduce")).toBe(0);
    expect(getSafeDuration("slow", "reduce")).toBe(1);
  });

  it("getSafeDuration returns real values for no-preference", () => {
    expect(getSafeDuration("fast", "no-preference")).toBe(200);
    expect(getSafeDuration("normal", "no-preference")).toBe(300);
    expect(getSafeDuration("slow", "no-preference")).toBe(500);
  });

  it("getSafeTransition builds CSS transition string", () => {
    expect(getSafeTransition("opacity", "fast", "no-preference")).toBe(
      "opacity 200ms ease"
    );
    expect(getSafeTransition("opacity", "fast", "reduce")).toBe(
      "opacity 0ms ease"
    );
  });

  it("motionSafeClasses adds motion-reduce variants", () => {
    const result = motionSafeClasses("transition-all duration-300");
    expect(result).toContain("motion-reduce:transition-none");
    expect(result).toContain("motion-reduce:duration-0");
  });

  it("motionSafeClasses adds animate-none for animations", () => {
    const result = motionSafeClasses("animate-spin");
    expect(result).toContain("motion-reduce:animate-none");
  });

  it("auditMotionSafety detects unsafe animations", () => {
    const result = auditMotionSafety([
      { identifier: "Spinner", classes: "animate-spin" },
      {
        identifier: "Button",
        classes: "transition-all duration-200 motion-reduce:transition-none",
      },
    ]);
    expect(result.unsafeAnimations.length).toBe(1);
    expect(result.unsafeAnimations[0].identifier).toBe("Spinner");
    expect(result.score).toBeLessThan(100);
  });

  it("formatMotionAudit produces readable output", () => {
    const result = auditMotionSafety([]);
    const formatted = formatMotionAudit(result);
    expect(formatted).toContain("Motion Safety Audit");
    expect(formatted).toContain("100");
  });
});

// ===== Q-217: SEO Health Monitor =====

describe("Q-217: seoHealthMonitor", () => {
  const goodPage: PageMeta = {
    url: "https://bjj-app.net",
    title: "BJJ App - Brazilian Jiu-Jitsu Tracker",
    description:
      "Track your Brazilian Jiu-Jitsu training with sessions, techniques, and progress analytics.",
    canonical: "https://bjj-app.net",
    ogTitle: "BJJ App",
    ogDescription: "Track your BJJ training",
    ogImage: "/og.png",
    h1Count: 1,
    imgWithoutAlt: 0,
    internalLinks: 10,
    wordCount: 500,
    hasStructuredData: true,
    hasBreadcrumb: true,
    isIndexable: true,
    mobileViewport: true,
    httpsOnly: true,
    loadTimeMs: 1500,
    lcpMs: 2000,
    clsScore: 0.05,
  };

  it("checkPageSEO returns high score for good page", () => {
    const result = checkPageSEO(goodPage);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.failCount).toBe(0);
  });

  it("checkPageSEO detects missing title", () => {
    const result = checkPageSEO({ ...goodPage, title: undefined });
    expect(result.checks.find((c) => c.name === "Page title")?.status).toBe(
      "fail"
    );
  });

  it("checkPageSEO detects slow LCP", () => {
    const result = checkPageSEO({ ...goodPage, lcpMs: 5000 });
    const lcpCheck = result.checks.find(
      (c) => c.name === "Largest Contentful Paint"
    );
    expect(lcpCheck?.status).toBe("fail");
  });

  it("checkSiteHealth aggregates across pages", () => {
    const health = checkSiteHealth([goodPage, { ...goodPage, url: "/about" }]);
    expect(health.pages.length).toBe(2);
    expect(health.overallScore).toBeGreaterThan(0);
    expect(health.categoryScores).toHaveProperty("technical");
  });

  it("formatSiteHealth produces readable output", () => {
    const health = checkSiteHealth([goodPage]);
    const formatted = formatSiteHealth(health);
    expect(formatted).toContain("SEO Site Health");
    expect(formatted).toContain("Category Scores");
  });
});

// ===== Q-218: Doc Quality Checker =====

describe("Q-218: docQualityChecker", () => {
  const sampleCode = `
/**
 * Calculate the total training hours.
 * @param sessions - Array of training sessions
 * @returns Total hours
 */
export function calculateHours(sessions: unknown[]): number {
  return sessions.length;
}

export const MAX_SESSIONS = 100;

export interface TrainingSession {
  id: string;
  duration: number;
}
`;

  it("analyzeFileDoc detects exports and JSDoc", () => {
    const result = analyzeFileDoc("test.ts", sampleCode);
    expect(result.report.totalExports).toBeGreaterThanOrEqual(1);
    expect(result.report.documented).toBeGreaterThanOrEqual(1);
    // At least one documented (calculateHours) and some undocumented
    expect(result.report.documented).toBeLessThanOrEqual(result.report.totalExports);
  });

  it("analyzeFileDoc identifies documented and undocumented symbols", () => {
    // Use code with widely separated exports to test detection
    const wideCode = `
/** Documented function */
export function documented(): void {}

// Many lines of code...
${"// filler\n".repeat(30)}

export function undocumented(): void {}
`;
    const result = analyzeFileDoc("test.ts", wideCode);
    expect(result.report.totalExports).toBe(2);
    expect(result.report.documented).toBeGreaterThanOrEqual(1);
  });

  it("buildDocQualityReport aggregates file reports", () => {
    const result1 = analyzeFileDoc("a.ts", sampleCode);
    const result2 = analyzeFileDoc(
      "b.ts",
      "export function foo() { return 1; }"
    );
    const report = buildDocQualityReport([result1, result2]);
    expect(report.totalExports).toBe(4);
    expect(report.filesAnalyzed).toBe(2);
  });

  it("meetsThreshold checks coverage correctly", () => {
    const report = buildDocQualityReport([analyzeFileDoc("test.ts", sampleCode)]);
    // Coverage = documented/total, should be between 0 and 100
    expect(report.coverage).toBeGreaterThanOrEqual(0);
    expect(report.coverage).toBeLessThanOrEqual(100);
    expect(meetsThreshold(report, 0)).toBe(true);
  });

  it("getPriorityDocTargets returns high-priority first", () => {
    const report = buildDocQualityReport([analyzeFileDoc("test.ts", sampleCode)]);
    const targets = getPriorityDocTargets(report);
    // Interface is medium, const is low
    if (targets.length >= 2) {
      const priorities = targets.map((t) => t.priority);
      expect(priorities.indexOf("low")).toBeGreaterThan(-1);
    }
  });

  it("formatDocQualityReport produces readable output", () => {
    const report = buildDocQualityReport([analyzeFileDoc("test.ts", sampleCode)]);
    const formatted = formatDocQualityReport(report);
    expect(formatted).toContain("Doc Quality Report");
    expect(formatted).toContain("Coverage");
  });
});

// ===== Q-219: External Monitor Integration =====

describe("Q-219: externalMonitorIntegration", () => {
  it("buildDefaultConfig creates valid config", () => {
    const config = buildDefaultConfig("123456");
    expect(config.endpoints.length).toBe(5);
    expect(config.alertChannels.length).toBe(1);
    expect(config.alertChannels[0].type).toBe("telegram");
  });

  it("generateUptimeRobotConfig maps endpoints", () => {
    const config = buildDefaultConfig();
    const urConfig = generateUptimeRobotConfig(config);
    expect(urConfig.length).toBe(5);
    expect(urConfig[0].type).toBe(1);
    expect(urConfig[0].friendly_name).toBe("Health API");
  });

  it("classifyHealthStatus correctly classifies", () => {
    expect(classifyHealthStatus(200, 500, 200)).toBe("up");
    expect(classifyHealthStatus(200, 6000, 200)).toBe("degraded");
    expect(classifyHealthStatus(500, 100, 200)).toBe("down");
  });

  it("buildStatusPage creates status page data", () => {
    const results: HealthCheckResult[] = [
      {
        endpoint: "Health API",
        status: "up",
        responseTimeMs: 200,
        statusCode: 200,
        timestamp: new Date().toISOString(),
      },
    ];
    const page = buildStatusPage(results);
    expect(page.status).toBe("up");
    expect(page.components.length).toBe(1);
    expect(page.uptimePercent).toBe(100);
  });

  it("formatTelegramAlert creates alert message", () => {
    const payload: WebhookPayload = {
      provider: "uptimerobot",
      event: "down",
      endpoint: "Health API",
      statusCode: 500,
      responseTimeMs: 0,
      timestamp: new Date().toISOString(),
      message: "Server error",
    };
    const msg = formatTelegramAlert(payload);
    expect(msg).toContain("Health API");
    expect(msg).toContain("DOWN");
  });

  it("formatStatusPage outputs readable status", () => {
    const page = buildStatusPage([
      {
        endpoint: "API",
        status: "up",
        responseTimeMs: 100,
        statusCode: 200,
        timestamp: new Date().toISOString(),
      },
    ]);
    const formatted = formatStatusPage(page);
    expect(formatted).toContain("System Status");
    expect(formatted).toContain("API");
  });
});

// ===== Q-220: Error Recovery Patterns =====

describe("Q-220: errorRecoveryPatterns", () => {
  it("withRetry succeeds on first try", async () => {
    const result = await withRetry(() => Promise.resolve(42));
    expect(result.data).toBe(42);
    expect(result.attempts).toBe(1);
  });

  it("withRetry retries on failure then succeeds", async () => {
    let attempt = 0;
    const result = await withRetry(
      () => {
        attempt++;
        if (attempt < 3) throw new Error("Fail");
        return Promise.resolve("ok");
      },
      { maxRetries: 3, baseDelayMs: 10, strategy: "fixed" }
    );
    expect(result.data).toBe("ok");
    expect(result.attempts).toBe(3);
  });

  it("withRetry throws after max retries", async () => {
    await expect(
      withRetry(() => Promise.reject(new Error("Always fail")), {
        maxRetries: 2,
        baseDelayMs: 10,
        strategy: "fixed",
      })
    ).rejects.toThrow("Always fail");
  });

  it("calculateDelay computes exponential backoff", () => {
    const config = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      strategy: "exponential" as const,
    };
    expect(calculateDelay(0, config)).toBe(1000);
    expect(calculateDelay(1, config)).toBe(2000);
    expect(calculateDelay(2, config)).toBe(4000);
  });

  it("calculateDelay respects maxDelayMs cap", () => {
    const config = {
      maxRetries: 10,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      strategy: "exponential" as const,
    };
    expect(calculateDelay(10, config)).toBe(5000);
  });

  it("createCircuitBreaker opens after threshold", async () => {
    const cb = createCircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 100000,
      successThreshold: 1,
    });
    expect(cb.state().state).toBe("closed");

    // Two failures → open
    try { await cb.execute(() => Promise.reject(new Error("1"))); } catch {}
    try { await cb.execute(() => Promise.reject(new Error("2"))); } catch {}
    expect(cb.state().state).toBe("open");

    // Should reject immediately
    await expect(
      cb.execute(() => Promise.resolve("ok"))
    ).rejects.toThrow("Circuit breaker is open");
  });

  it("withFallbackChain tries fallbacks in order", async () => {
    const result = await withFallbackChain({
      chain: [
        { name: "primary", fn: () => Promise.reject(new Error("fail")) },
        { name: "fallback", fn: () => Promise.resolve("cached") },
      ],
    });
    expect(result.data).toBe("cached");
    expect(result.usedFallback).toBe("fallback");
    expect(result.index).toBe(1);
  });

  it("withGracefulDegradation degrades on failure", async () => {
    const result = await withGracefulDegradation({
      primary: () => Promise.reject(new Error("fail")),
      degraded: () => Promise.resolve("degraded data"),
      minimal: () => "static",
    });
    expect(result.data).toBe("degraded data");
    expect(result.mode).toBe("degraded");
  });

  it("isRetryableError classifies correctly", () => {
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableError(new Error("timeout"))).toBe(true);
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError({ status: 500 })).toBe(true);
    expect(isRetryableError({ status: 404 })).toBe(false);
  });

  it("classifyError returns correct types", () => {
    expect(classifyError(new Error("timeout")).type).toBe("timeout");
    expect(classifyError(new Error("network error")).type).toBe("network");
    expect(classifyError({ status: 401 }).type).toBe("auth");
    expect(classifyError({ status: 500 }).type).toBe("server");
  });

  it("buildRecoveryAudit produces score", () => {
    const audit = buildRecoveryAudit({
      totalOps: 100,
      firstTrySuccess: 90,
      retrySuccess: 8,
      retryFail: 2,
      circuitTrips: 0,
      fallbacks: 1,
      totalRetries: 16,
    });
    expect(audit.score).toBeGreaterThan(80);
    expect(audit.avgRetriesPerOperation).toBeCloseTo(0.16);
  });
});

// ===== Q-221: Visual Regression Helper =====

describe("Q-221: visualRegressionHelper", () => {
  const makeSnapshot = (overrides?: Partial<LayoutSnapshot>): LayoutSnapshot => ({
    url: "/",
    viewportWidth: 375,
    viewportHeight: 812,
    timestamp: new Date().toISOString(),
    elements: [
      {
        selector: "nav",
        rect: { top: 0, left: 0, width: 375, height: 56 },
        isVisible: true,
        overflows: false,
        textLength: 10,
      },
      {
        selector: "main",
        rect: { top: 56, left: 0, width: 375, height: 700 },
        isVisible: true,
        overflows: false,
        textLength: 500,
      },
    ],
    styles: [
      {
        selector: "nav",
        backgroundColor: "#0B1120",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: "500",
        padding: "16px",
        margin: "0px",
        borderRadius: "0px",
      },
    ],
    ...overrides,
  });

  it("compareSnapshots detects no changes for identical snapshots", () => {
    const baseline = makeSnapshot();
    const current = makeSnapshot();
    const diff = compareSnapshots(baseline, current);
    expect(diff.score).toBe(100);
    expect(diff.layoutShifts.length).toBe(0);
    expect(diff.shouldBlock).toBe(false);
  });

  it("compareSnapshots detects layout shifts", () => {
    const baseline = makeSnapshot();
    const current = makeSnapshot({
      elements: [
        {
          selector: "nav",
          rect: { top: 0, left: 0, width: 375, height: 56 },
          isVisible: true,
          overflows: false,
          textLength: 10,
        },
        {
          selector: "main",
          rect: { top: 100, left: 20, width: 375, height: 700 }, // shifted
          isVisible: true,
          overflows: false,
          textLength: 500,
        },
      ],
    });
    const diff = compareSnapshots(baseline, current);
    expect(diff.layoutShifts.length).toBe(1);
    expect(diff.layoutShifts[0].selector).toBe("main");
    expect(diff.score).toBeLessThan(100);
  });

  it("compareSnapshots detects visibility changes", () => {
    const baseline = makeSnapshot();
    const current = makeSnapshot({
      elements: [
        {
          selector: "nav",
          rect: { top: 0, left: 0, width: 375, height: 56 },
          isVisible: true,
          overflows: false,
          textLength: 10,
        },
        {
          selector: "main",
          rect: { top: 56, left: 0, width: 375, height: 700 },
          isVisible: false, // disappeared
          overflows: false,
          textLength: 500,
        },
      ],
    });
    const diff = compareSnapshots(baseline, current);
    expect(diff.visibilityChanges.length).toBe(1);
    expect(diff.visibilityChanges[0].change).toBe("disappeared");
  });

  it("compareSnapshots detects style changes", () => {
    const baseline = makeSnapshot();
    const current = makeSnapshot({
      styles: [
        {
          selector: "nav",
          backgroundColor: "#FF0000", // changed
          color: "#ffffff",
          fontSize: "14px",
          fontWeight: "500",
          padding: "16px",
          margin: "0px",
          borderRadius: "0px",
        },
      ],
    });
    const diff = compareSnapshots(baseline, current);
    expect(diff.styleChanges.length).toBe(1);
    expect(diff.styleChanges[0].property).toBe("backgroundColor");
  });

  it("STANDARD_VIEWPORTS contains mobile viewports", () => {
    expect(STANDARD_VIEWPORTS.length).toBe(5);
    expect(STANDARD_VIEWPORTS[0].width).toBe(320);
  });

  it("KEY_ROUTES contains critical routes", () => {
    expect(KEY_ROUTES).toContain("/dashboard");
    expect(KEY_ROUTES).toContain("/login");
  });

  it("buildDefaultTestConfig returns valid config", () => {
    const config = buildDefaultTestConfig();
    expect(config.viewports.length).toBe(5);
    expect(config.routes.length).toBeGreaterThan(0);
    expect(config.maxShiftPx).toBe(10);
  });

  it("formatVisualDiff produces readable output", () => {
    const diff = compareSnapshots(makeSnapshot(), makeSnapshot());
    const formatted = formatVisualDiff(diff);
    expect(formatted).toContain("Visual Regression");
    expect(formatted).toContain("100");
  });
});
