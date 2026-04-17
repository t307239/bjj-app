/**
 * qualityQ134_137 — tests for Q-134 through Q-137 quality improvements
 *
 * Tests:
 * - Q-134: Deployment guard (deploymentGuard.ts)
 * - Q-135: Cost estimator (costEstimator.ts)
 * - Q-136: Design tokens (designTokens.ts)
 * - Q-137: Offline queue (offlineQueue.ts)
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.resolve(ROOT, "lib");

// ── Q-134: Deployment Guard ─────────────────────────────────────────────
describe("Q-134: Infra — deploymentGuard", () => {
  let checkEnvVars: typeof import("../lib/deploymentGuard").checkEnvVars;
  let getAllRequiredEnvVars: typeof import("../lib/deploymentGuard").getAllRequiredEnvVars;
  let validateHealthResponse: typeof import("../lib/deploymentGuard").validateHealthResponse;
  let validateBuildManifest: typeof import("../lib/deploymentGuard").validateBuildManifest;
  let aggregateChecks: typeof import("../lib/deploymentGuard").aggregateChecks;
  let formatReadinessSummary: typeof import("../lib/deploymentGuard").formatReadinessSummary;
  let REQUIRED_ENV_VARS: typeof import("../lib/deploymentGuard").REQUIRED_ENV_VARS;

  beforeAll(async () => {
    const mod = await import("../lib/deploymentGuard");
    checkEnvVars = mod.checkEnvVars;
    getAllRequiredEnvVars = mod.getAllRequiredEnvVars;
    validateHealthResponse = mod.validateHealthResponse;
    validateBuildManifest = mod.validateBuildManifest;
    aggregateChecks = mod.aggregateChecks;
    formatReadinessSummary = mod.formatReadinessSummary;
    REQUIRED_ENV_VARS = mod.REQUIRED_ENV_VARS;
  });

  it("REQUIRED_ENV_VARS has all categories", () => {
    expect(REQUIRED_ENV_VARS).toHaveProperty("database");
    expect(REQUIRED_ENV_VARS).toHaveProperty("auth");
    expect(REQUIRED_ENV_VARS).toHaveProperty("stripe");
    expect(REQUIRED_ENV_VARS).toHaveProperty("monitoring");
    expect(REQUIRED_ENV_VARS).toHaveProperty("push");
    expect(REQUIRED_ENV_VARS).toHaveProperty("cron");
  });

  it("getAllRequiredEnvVars returns flat list", () => {
    const vars = getAllRequiredEnvVars();
    expect(vars.length).toBeGreaterThan(10);
    expect(vars).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(vars).toContain("STRIPE_SECRET_KEY");
  });

  it("checkEnvVars detects missing vars", () => {
    const checks = checkEnvVars({});
    const fails = checks.filter((c) => c.status === "fail");
    expect(fails.length).toBe(Object.keys(REQUIRED_ENV_VARS).length);
  });

  it("checkEnvVars passes when all present", () => {
    const env: Record<string, string> = {};
    for (const v of getAllRequiredEnvVars()) env[v] = "test-value";
    const checks = checkEnvVars(env);
    const passes = checks.filter((c) => c.status === "pass");
    expect(passes.length).toBe(Object.keys(REQUIRED_ENV_VARS).length);
  });

  it("validateHealthResponse passes for valid response", () => {
    const check = validateHealthResponse({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      dbStatus: "fast",
    });
    expect(check.status).toBe("pass");
  });

  it("validateHealthResponse warns for db error", () => {
    const check = validateHealthResponse({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      dbStatus: "error",
    });
    expect(check.status).toBe("warn");
  });

  it("validateHealthResponse fails for missing fields", () => {
    const check = validateHealthResponse({ status: "ok" });
    expect(check.status).toBe("fail");
    expect(check.message).toContain("missing");
  });

  it("validateBuildManifest passes for complete build", () => {
    const check = validateBuildManifest({
      pages: {
        "/dashboard": ["chunk1.js"],
        "/records": ["chunk2.js"],
        "/profile": ["chunk3.js"],
        "/login": ["chunk4.js"],
      },
    });
    expect(check.status).toBe("pass");
  });

  it("validateBuildManifest fails for missing pages", () => {
    const check = validateBuildManifest({ pages: { "/dashboard": ["chunk1.js"] } });
    expect(check.status).toBe("fail");
    expect(check.message).toContain("Missing");
  });

  it("aggregateChecks marks ready when no failures", () => {
    const result = aggregateChecks([
      { name: "test", status: "pass", message: "ok" },
      { name: "test2", status: "warn", message: "warn" },
    ]);
    expect(result.ready).toBe(true);
    expect(result.warnings.length).toBe(1);
  });

  it("aggregateChecks marks not ready when failures exist", () => {
    const result = aggregateChecks([
      { name: "test", status: "pass", message: "ok" },
      { name: "test2", status: "fail", message: "fail" },
    ]);
    expect(result.ready).toBe(false);
    expect(result.failures.length).toBe(1);
  });

  it("formatReadinessSummary contains status icon", () => {
    const readiness = aggregateChecks([
      { name: "test", status: "pass", message: "ok" },
    ]);
    const summary = formatReadinessSummary(readiness);
    expect(summary).toContain("READY");
    expect(summary).toContain("✅");
  });

  it("barrel export includes deploymentGuard", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("checkEnvVars");
    expect(barrel).toContain("validateHealthResponse");
    expect(barrel).toContain("REQUIRED_ENV_VARS");
    expect(barrel).toContain("DeployReadiness");
  });
});

// ── Q-135: Cost Estimator ───────────────────────────────────────────────
describe("Q-135: Cost — costEstimator", () => {
  let estimateMonthlyCost: typeof import("../lib/costEstimator").estimateMonthlyCost;
  let detectCostAnomalies: typeof import("../lib/costEstimator").detectCostAnomalies;
  let formatCostSummary: typeof import("../lib/costEstimator").formatCostSummary;
  let PRICING: typeof import("../lib/costEstimator").PRICING;

  const baseUsage = {
    mau: 50,
    dbSizeGb: 1,
    storageGb: 0.5,
    apiInvocations: 50_000,
    bandwidthGb: 10,
    emailsSent: 100,
    proSubscribers: 5,
    avgRevenueCentsPerPro: 50000, // ¥500/mo
  };

  beforeAll(async () => {
    const mod = await import("../lib/costEstimator");
    estimateMonthlyCost = mod.estimateMonthlyCost;
    detectCostAnomalies = mod.detectCostAnomalies;
    formatCostSummary = mod.formatCostSummary;
    PRICING = mod.PRICING;
  });

  it("PRICING has vercel, supabase, stripe, resend", () => {
    expect(PRICING).toHaveProperty("vercel");
    expect(PRICING).toHaveProperty("supabase");
    expect(PRICING).toHaveProperty("stripe");
    expect(PRICING).toHaveProperty("resend");
  });

  it("free tier estimate has zero infra costs", () => {
    const estimate = estimateMonthlyCost({
      ...baseUsage,
      mau: 5,
      dbSizeGb: 0.1,
      apiInvocations: 1000,
      proSubscribers: 0,
      avgRevenueCentsPerPro: 0,
    });
    expect(estimate.costs.vercelCents).toBe(0);
    expect(estimate.costs.supabaseCents).toBe(0);
    expect(estimate.tier).toBe("free");
  });

  it("growth tier includes Vercel + Supabase base costs", () => {
    const estimate = estimateMonthlyCost({
      ...baseUsage,
      mau: 500,
      apiInvocations: 500_000,
    });
    expect(estimate.costs.vercelCents).toBeGreaterThanOrEqual(PRICING.vercel.proBaseMonthlyCents);
    expect(estimate.costs.supabaseCents).toBeGreaterThanOrEqual(PRICING.supabase.proBaseMonthlyCents);
    expect(estimate.tier).toBe("growth");
  });

  it("calculates stripe fees correctly", () => {
    const estimate = estimateMonthlyCost(baseUsage);
    const expectedFeePercent = Math.round(
      baseUsage.proSubscribers * baseUsage.avgRevenueCentsPerPro * (PRICING.stripe.ratePercent / 100),
    );
    const expectedFixedFee = baseUsage.proSubscribers * PRICING.stripe.fixedFeeCents;
    expect(estimate.costs.stripeFeesCents).toBe(expectedFeePercent + expectedFixedFee);
  });

  it("calculates revenue and margins", () => {
    const estimate = estimateMonthlyCost(baseUsage);
    expect(estimate.revenue.monthlyRevenueCents).toBe(
      baseUsage.proSubscribers * baseUsage.avgRevenueCentsPerPro,
    );
    expect(estimate.margins.marginPercent).toBeGreaterThan(0);
  });

  it("warns when DB size is high", () => {
    const estimate = estimateMonthlyCost({ ...baseUsage, dbSizeGb: 7 });
    expect(estimate.warnings.some((w) => w.includes("DB size"))).toBe(true);
  });

  it("detectCostAnomalies finds significant changes", () => {
    const prev = estimateMonthlyCost(baseUsage);
    const curr = estimateMonthlyCost({ ...baseUsage, mau: 5000 });
    const anomalies = detectCostAnomalies(curr, prev);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((a) => a.metric === "mau")).toBe(true);
  });

  it("detectCostAnomalies returns empty for stable usage", () => {
    const prev = estimateMonthlyCost(baseUsage);
    const curr = estimateMonthlyCost(baseUsage);
    const anomalies = detectCostAnomalies(curr, prev);
    expect(anomalies.length).toBe(0);
  });

  it("formatCostSummary contains tier and totals", () => {
    const estimate = estimateMonthlyCost(baseUsage);
    const summary = formatCostSummary(estimate);
    expect(summary).toContain("Monthly Cost Estimate");
    expect(summary).toContain("Vercel");
    expect(summary).toContain("Supabase");
    expect(summary).toContain("Margin");
  });

  it("barrel export includes costEstimator", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("estimateMonthlyCost");
    expect(barrel).toContain("detectCostAnomalies");
    expect(barrel).toContain("PRICING");
    expect(barrel).toContain("CostEstimate");
  });
});

// ── Q-136: Design Tokens ────────────────────────────────────────────────
describe("Q-136: UI — designTokens", () => {
  let COLORS: typeof import("../lib/designTokens").COLORS;
  let BREAKPOINTS: typeof import("../lib/designTokens").BREAKPOINTS;
  let SPACING: typeof import("../lib/designTokens").SPACING;
  let RADII: typeof import("../lib/designTokens").RADII;
  let SHADOWS: typeof import("../lib/designTokens").SHADOWS;
  let Z_INDEX: typeof import("../lib/designTokens").Z_INDEX;
  let ANIMATION: typeof import("../lib/designTokens").ANIMATION;
  let TYPOGRAPHY: typeof import("../lib/designTokens").TYPOGRAPHY;
  let isAboveBreakpoint: typeof import("../lib/designTokens").isAboveBreakpoint;
  let getCurrentBreakpoint: typeof import("../lib/designTokens").getCurrentBreakpoint;

  beforeAll(async () => {
    const mod = await import("../lib/designTokens");
    COLORS = mod.COLORS;
    BREAKPOINTS = mod.BREAKPOINTS;
    SPACING = mod.SPACING;
    RADII = mod.RADII;
    SHADOWS = mod.SHADOWS;
    Z_INDEX = mod.Z_INDEX;
    ANIMATION = mod.ANIMATION;
    TYPOGRAPHY = mod.TYPOGRAPHY;
    isAboveBreakpoint = mod.isAboveBreakpoint;
    getCurrentBreakpoint = mod.getCurrentBreakpoint;
  });

  it("COLORS has brand emerald primary", () => {
    expect(COLORS.brand.primary).toBe("#10B981");
  });

  it("COLORS surface base is dark", () => {
    expect(COLORS.surface.base).toBe("#0B1120");
  });

  it("COLORS text secondary is WCAG AA compliant zinc-400", () => {
    expect(COLORS.text.secondary).toBe("#A1A1AA");
  });

  it("COLORS has belt colors", () => {
    expect(COLORS.belt).toHaveProperty("white");
    expect(COLORS.belt).toHaveProperty("blue");
    expect(COLORS.belt).toHaveProperty("purple");
    expect(COLORS.belt).toHaveProperty("brown");
    expect(COLORS.belt).toHaveProperty("black");
  });

  it("BREAKPOINTS match Tailwind defaults", () => {
    expect(BREAKPOINTS.sm).toBe(640);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
  });

  it("isAboveBreakpoint works correctly", () => {
    expect(isAboveBreakpoint(800, "md")).toBe(true);
    expect(isAboveBreakpoint(600, "md")).toBe(false);
  });

  it("getCurrentBreakpoint returns correct name", () => {
    expect(getCurrentBreakpoint(300)).toBe("xs");
    expect(getCurrentBreakpoint(700)).toBe("sm");
    expect(getCurrentBreakpoint(800)).toBe("md");
    expect(getCurrentBreakpoint(1100)).toBe("lg");
    expect(getCurrentBreakpoint(1300)).toBe("xl");
    expect(getCurrentBreakpoint(1600)).toBe("2xl");
  });

  it("SPACING has touch target minimum 44px", () => {
    expect(SPACING.touchTarget).toBe(44);
  });

  it("Z_INDEX layers are properly ordered", () => {
    expect(Z_INDEX.base).toBeLessThan(Z_INDEX.sticky);
    expect(Z_INDEX.sticky).toBeLessThan(Z_INDEX.dropdown);
    expect(Z_INDEX.dropdown).toBeLessThan(Z_INDEX.overlay);
    expect(Z_INDEX.overlay).toBeLessThan(Z_INDEX.modal);
    expect(Z_INDEX.modal).toBeLessThan(Z_INDEX.toast);
  });

  it("ANIMATION has standard timing values", () => {
    expect(ANIMATION.fast).toBeLessThan(ANIMATION.normal);
    expect(ANIMATION.normal).toBeLessThan(ANIMATION.slow);
  });

  it("TYPOGRAPHY has Inter font family", () => {
    expect(TYPOGRAPHY.fontFamily).toContain("Inter");
  });

  it("barrel export includes designTokens", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("COLORS");
    expect(barrel).toContain("BREAKPOINTS");
    expect(barrel).toContain("SPACING");
    expect(barrel).toContain("Z_INDEX");
    expect(barrel).toContain("isAboveBreakpoint");
  });
});

// ── Q-137: Offline Queue ────────────────────────────────────────────────
describe("Q-137: UX — offlineQueue", () => {
  let OfflineQueue: typeof import("../lib/offlineQueue").OfflineQueue;
  let MAX_QUEUE_SIZE: typeof import("../lib/offlineQueue").MAX_QUEUE_SIZE;
  let MAX_ATTEMPTS: typeof import("../lib/offlineQueue").MAX_ATTEMPTS;

  beforeAll(async () => {
    const mod = await import("../lib/offlineQueue");
    OfflineQueue = mod.OfflineQueue;
    MAX_QUEUE_SIZE = mod.MAX_QUEUE_SIZE;
    MAX_ATTEMPTS = mod.MAX_ATTEMPTS;
  });

  it("enqueue adds action to queue", () => {
    const q = new OfflineQueue();
    q.enqueue({ type: "log_training", key: "1", payload: { duration: 60 } });
    expect(q.size).toBe(1);
    expect(q.hasPending).toBe(true);
  });

  it("enqueue deduplicates by type+key", () => {
    const q = new OfflineQueue();
    q.enqueue({ type: "log_training", key: "1", payload: { duration: 60 } });
    q.enqueue({ type: "log_training", key: "1", payload: { duration: 90 } });
    expect(q.size).toBe(1);
    const queue = q.getQueue();
    expect(queue[0].payload.duration).toBe(90);
  });

  it("enqueue allows different keys", () => {
    const q = new OfflineQueue();
    q.enqueue({ type: "log_training", key: "1", payload: {} });
    q.enqueue({ type: "log_training", key: "2", payload: {} });
    expect(q.size).toBe(2);
  });

  it("enforces MAX_QUEUE_SIZE", () => {
    const q = new OfflineQueue();
    for (let i = 0; i < MAX_QUEUE_SIZE + 10; i++) {
      q.enqueue({ type: "log_training", key: `${i}`, payload: {} });
    }
    expect(q.size).toBe(MAX_QUEUE_SIZE);
  });

  it("flush processes actions in order", async () => {
    const q = new OfflineQueue();
    const processed: string[] = [];
    q.registerHandler("log_training", async (action) => {
      processed.push(action.key);
      return { ok: true };
    });
    q.enqueue({ type: "log_training", key: "a", payload: {} });
    q.enqueue({ type: "log_training", key: "b", payload: {} });
    const results = await q.flush();
    expect(results.length).toBe(2);
    expect(processed).toEqual(["a", "b"]);
    expect(q.size).toBe(0);
  });

  it("flush retains failed actions up to MAX_ATTEMPTS", async () => {
    const q = new OfflineQueue();
    q.registerHandler("log_training", async () => {
      return { ok: false, error: "network error" };
    });
    q.enqueue({ type: "log_training", key: "1", payload: {} });
    await q.flush();
    expect(q.size).toBe(1); // still in queue
    const queue = q.getQueue();
    expect(queue[0].attempts).toBe(1);
    expect(queue[0].lastError).toBe("network error");
  });

  it("flush drops actions after MAX_ATTEMPTS", async () => {
    const q = new OfflineQueue();
    q.registerHandler("log_training", async () => {
      return { ok: false, error: "fail" };
    });
    q.enqueue({ type: "log_training", key: "1", payload: {} });
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await q.flush();
    }
    expect(q.size).toBe(0);
  });

  it("onSync callback fires after flush", async () => {
    const q = new OfflineQueue();
    let callbackResults: unknown[] = [];
    q.onSync((results) => { callbackResults = results; });
    q.registerHandler("update_profile", async () => ({ ok: true }));
    q.enqueue({ type: "update_profile", key: "1", payload: {} });
    await q.flush();
    expect(callbackResults.length).toBe(1);
  });

  it("onSync returns unsubscribe function", async () => {
    const q = new OfflineQueue();
    let called = false;
    const unsub = q.onSync(() => { called = true; });
    unsub();
    q.registerHandler("update_profile", async () => ({ ok: true }));
    q.enqueue({ type: "update_profile", key: "1", payload: {} });
    await q.flush();
    expect(called).toBe(false);
  });

  it("remove removes specific action", () => {
    const q = new OfflineQueue();
    q.enqueue({ type: "log_training", key: "1", payload: {} });
    q.enqueue({ type: "log_training", key: "2", payload: {} });
    const removed = q.remove("log_training", "1");
    expect(removed).toBe(true);
    expect(q.size).toBe(1);
  });

  it("clear empties the queue", () => {
    const q = new OfflineQueue();
    q.enqueue({ type: "log_training", key: "1", payload: {} });
    q.clear();
    expect(q.size).toBe(0);
  });

  it("getRetryDelay uses exponential backoff", () => {
    const d0 = OfflineQueue.getRetryDelay(0);
    const d1 = OfflineQueue.getRetryDelay(1);
    const d2 = OfflineQueue.getRetryDelay(2);
    expect(d1).toBe(d0 * 2);
    expect(d2).toBe(d0 * 4);
  });

  it("barrel export includes offlineQueue", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("OfflineQueue");
    expect(barrel).toContain("MAX_QUEUE_SIZE");
    expect(barrel).toContain("QueuedAction");
  });
});
