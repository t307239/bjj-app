/**
 * qualityQ126_129 — tests for Q-126 through Q-129 quality improvements
 *
 * Tests:
 * - Q-126: Data export utilities + backup-verify cron
 * - Q-127: Admin metrics aggregation
 * - Q-128: CSRF double-submit protection
 * - Q-129: Performance monitoring utilities
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.resolve(ROOT, "lib");

// ── Q-126: Data Export + Backup Verify ───────────────────────────────────
describe("Q-126: Data — dataExport + backup-verify", () => {
  let buildUserDataExport: typeof import("../lib/dataExport").buildUserDataExport;
  let validateExportData: typeof import("../lib/dataExport").validateExportData;

  beforeAll(async () => {
    const mod = await import("../lib/dataExport");
    buildUserDataExport = mod.buildUserDataExport;
    validateExportData = mod.validateExportData;
  });

  it("buildUserDataExport returns correct structure", () => {
    const result = buildUserDataExport({
      email: "test@example.com",
      profile: { belt: "blue", stripe: 2, is_pro: true, created_at: "2025-01-01T00:00:00Z" },
      trainingLogs: [
        { date: "2025-06-01", type: "gi", duration_min: 60, notes: null, instructor: null, partner: null, techniques: ["armbar"], created_at: "2025-06-01T10:00:00Z" },
      ],
      weights: [{ date: "2025-06-01", weight_kg: 75, created_at: "2025-06-01T08:00:00Z" }],
      competitions: [],
    });
    expect(result.export_version).toBe("1.0");
    expect(result.user_email).toBe("test@example.com");
    expect(result.stats.total_sessions).toBe(1);
    expect(result.stats.total_training_minutes).toBe(60);
    expect(result.stats.first_session_date).toBe("2025-06-01");
  });

  it("buildUserDataExport handles empty data", () => {
    const result = buildUserDataExport({
      email: "empty@test.com",
      profile: null,
      trainingLogs: [],
      weights: [],
      competitions: [],
    });
    expect(result.stats.total_sessions).toBe(0);
    expect(result.stats.first_session_date).toBeNull();
    expect(result.stats.last_session_date).toBeNull();
  });

  it("validateExportData returns empty warnings for valid data", () => {
    const data = buildUserDataExport({
      email: "valid@test.com",
      profile: { belt: "white", stripe: 0, is_pro: false, created_at: "2025-01-01T00:00:00Z" },
      trainingLogs: [
        { date: "2025-01-15", type: "nogi", duration_min: 90, notes: null, instructor: null, partner: null, techniques: [], created_at: "2025-01-15T10:00:00Z" },
      ],
      weights: [],
      competitions: [],
    });
    const warnings = validateExportData(data);
    expect(warnings.length).toBe(0);
  });

  it("validateExportData detects missing email", () => {
    const data = buildUserDataExport({
      email: "",
      profile: null,
      trainingLogs: [],
      weights: [],
      competitions: [],
    });
    const warnings = validateExportData(data);
    expect(warnings).toContain("Missing user email");
  });

  it("validateExportData detects empty export", () => {
    const data = buildUserDataExport({
      email: "test@test.com",
      profile: null,
      trainingLogs: [],
      weights: [],
      competitions: [],
    });
    const warnings = validateExportData(data);
    expect(warnings).toContain("No training logs or weight data to export");
  });

  it("validateExportData detects negative duration", () => {
    const data = buildUserDataExport({
      email: "test@test.com",
      profile: null,
      trainingLogs: [
        { date: "2025-01-01", type: "gi", duration_min: -30, notes: null, instructor: null, partner: null, techniques: [], created_at: "2025-01-01T10:00:00Z" },
      ],
      weights: [],
      competitions: [],
    });
    const warnings = validateExportData(data);
    expect(warnings.some((w) => w.includes("Negative duration"))).toBe(true);
  });

  it("backup-verify cron route exists", () => {
    expect(fs.existsSync(path.resolve(ROOT, "app/api/cron/backup-verify/route.ts"))).toBe(true);
  });

  it("backup-verify has CRON_SECRET auth", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "app/api/cron/backup-verify/route.ts"), "utf-8");
    expect(source).toContain("CRON_SECRET");
    expect(source).toContain("Bearer");
  });

  it("backup-verify checks key tables", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "app/api/cron/backup-verify/route.ts"), "utf-8");
    expect(source).toContain("training_logs");
    expect(source).toContain("profiles");
    expect(source).toContain("push_subscriptions");
    expect(source).toContain("pro_users_count");
  });

  it("backup-verify has Telegram alerting", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "app/api/cron/backup-verify/route.ts"), "utf-8");
    expect(source).toContain("TELEGRAM_BOT_TOKEN");
    expect(source).toContain("Backup Verify Alert");
  });

  it("vercel.json has backup-verify cron", () => {
    const config = JSON.parse(fs.readFileSync(path.resolve(ROOT, "vercel.json"), "utf-8"));
    const backupCron = config.crons.find((c: { path: string }) => c.path === "/api/cron/backup-verify");
    expect(backupCron).toBeDefined();
    expect(backupCron.schedule).toBe("0 4 * * 1");
  });

  it("barrel export includes dataExport", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("buildUserDataExport");
    expect(barrel).toContain("validateExportData");
    expect(barrel).toContain("UserDataExport");
  });
});

// ── Q-127: Admin Metrics ─────────────────────────────────────────────────
describe("Q-127: Ops — adminMetrics", () => {
  let calcBeltDistribution: typeof import("../lib/adminMetrics").calcBeltDistribution;
  let calcProRate: typeof import("../lib/adminMetrics").calcProRate;
  let countActiveUsers: typeof import("../lib/adminMetrics").countActiveUsers;
  let calcAvgSessionsPerUser: typeof import("../lib/adminMetrics").calcAvgSessionsPerUser;

  beforeAll(async () => {
    const mod = await import("../lib/adminMetrics");
    calcBeltDistribution = mod.calcBeltDistribution;
    calcProRate = mod.calcProRate;
    countActiveUsers = mod.countActiveUsers;
    calcAvgSessionsPerUser = mod.calcAvgSessionsPerUser;
  });

  it("calcBeltDistribution counts correctly", () => {
    const dist = calcBeltDistribution([
      { belt: "white" }, { belt: "white" }, { belt: "blue" },
      { belt: "purple" }, { belt: "brown" }, { belt: "black" },
    ]);
    expect(dist.white).toBe(2);
    expect(dist.blue).toBe(1);
    expect(dist.purple).toBe(1);
    expect(dist.brown).toBe(1);
    expect(dist.black).toBe(1);
  });

  it("calcBeltDistribution defaults unknown to white", () => {
    const dist = calcBeltDistribution([{ belt: "unknown" }, { belt: "" }]);
    expect(dist.white).toBe(2);
  });

  it("calcProRate returns correct percentage", () => {
    expect(calcProRate(100, 15)).toBe(15);
    expect(calcProRate(0, 0)).toBe(0);
    expect(calcProRate(3, 1)).toBeCloseTo(33.3, 0);
  });

  it("countActiveUsers counts unique users within period", () => {
    const today = new Date().toISOString().split("T")[0];
    const logs = [
      { user_id: "a", date: today },
      { user_id: "a", date: today },
      { user_id: "b", date: today },
      { user_id: "c", date: "2020-01-01" }, // old, should be excluded
    ];
    expect(countActiveUsers(logs, 7)).toBe(2); // a and b
  });

  it("calcAvgSessionsPerUser returns 0 when no users", () => {
    expect(calcAvgSessionsPerUser(0, 0)).toBe(0);
  });

  it("calcAvgSessionsPerUser calculates correctly", () => {
    expect(calcAvgSessionsPerUser(30, 10)).toBe(3);
    expect(calcAvgSessionsPerUser(7, 3)).toBeCloseTo(2.3, 0);
  });

  it("admin/metrics route exists", () => {
    expect(fs.existsSync(path.resolve(ROOT, "app/api/admin/metrics/route.ts"))).toBe(true);
  });

  it("admin/metrics has rate limiting and admin check", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "app/api/admin/metrics/route.ts"), "utf-8");
    expect(source).toContain("createRateLimiter");
    expect(source).toContain("isAdminEmail");
    expect(source).toContain("Forbidden");
  });

  it("barrel export includes adminMetrics", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("calcBeltDistribution");
    expect(barrel).toContain("calcProRate");
    expect(barrel).toContain("PlatformMetrics");
  });
});

// ── Q-128: CSRF Protection ───────────────────────────────────────────────
describe("Q-128: Security — CSRF protection", () => {
  let generateCsrfToken: typeof import("../lib/csrf").generateCsrfToken;
  let validateCsrf: typeof import("../lib/csrf").validateCsrf;
  let CSRF_COOKIE_NAME: typeof import("../lib/csrf").CSRF_COOKIE_NAME;
  let CSRF_HEADER_NAME: typeof import("../lib/csrf").CSRF_HEADER_NAME;

  beforeAll(async () => {
    const mod = await import("../lib/csrf");
    generateCsrfToken = mod.generateCsrfToken;
    validateCsrf = mod.validateCsrf;
    CSRF_COOKIE_NAME = mod.CSRF_COOKIE_NAME;
    CSRF_HEADER_NAME = mod.CSRF_HEADER_NAME;
  });

  it("generateCsrfToken returns 64-char hex string", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generateCsrfToken returns unique tokens", () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(10);
  });

  it("CSRF_COOKIE_NAME is defined", () => {
    expect(CSRF_COOKIE_NAME).toBe("bjj-csrf-token");
  });

  it("CSRF_HEADER_NAME is defined", () => {
    expect(CSRF_HEADER_NAME).toBe("x-csrf-token");
  });

  it("validateCsrf allows GET requests without token", () => {
    const req = new Request("https://example.com/api/test", { method: "GET" });
    expect(validateCsrf(req)).toBe(true);
  });

  it("validateCsrf rejects POST without token", () => {
    const req = new Request("https://example.com/api/test", { method: "POST" });
    expect(validateCsrf(req)).toBe(false);
  });

  it("validateCsrf accepts POST with matching cookie and header", () => {
    const token = generateCsrfToken();
    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: token,
      },
    });
    expect(validateCsrf(req)).toBe(true);
  });

  it("validateCsrf rejects POST with mismatched tokens", () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token1}`,
        [CSRF_HEADER_NAME]: token2,
      },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it("validateCsrf rejects POST with only cookie, no header", () => {
    const token = generateCsrfToken();
    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it("barrel export includes csrf", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("generateCsrfToken");
    expect(barrel).toContain("validateCsrf");
    expect(barrel).toContain("CSRF_COOKIE_NAME");
  });
});

// ── Q-129: Performance Monitoring ────────────────────────────────────────
describe("Q-129: Performance — perfMonitor", () => {
  let measureAsync: typeof import("../lib/perfMonitor").measureAsync;
  let getMemorySnapshot: typeof import("../lib/perfMonitor").getMemorySnapshot;
  let CacheHitTracker: typeof import("../lib/perfMonitor").CacheHitTracker;
  let PERF_BUDGETS: typeof import("../lib/perfMonitor").PERF_BUDGETS;

  beforeAll(async () => {
    const mod = await import("../lib/perfMonitor");
    measureAsync = mod.measureAsync;
    getMemorySnapshot = mod.getMemorySnapshot;
    CacheHitTracker = mod.CacheHitTracker;
    PERF_BUDGETS = mod.PERF_BUDGETS;
  });

  it("PERF_BUDGETS has all categories", () => {
    expect(PERF_BUDGETS.PAGE_RENDER_MS).toBe(2000);
    expect(PERF_BUDGETS.API_RESPONSE_MS).toBe(1000);
    expect(PERF_BUDGETS.DB_QUERY_MS).toBe(500);
    expect(PERF_BUDGETS.IMAGE_OPT_MS).toBe(3000);
  });

  it("measureAsync returns result and measurement", async () => {
    const { result, measurement } = await measureAsync("test_op", "API_RESPONSE_MS", async () => {
      return 42;
    });
    expect(result).toBe(42);
    expect(measurement.name).toBe("test_op");
    expect(measurement.duration_ms).toBeGreaterThanOrEqual(0);
    expect(measurement.budget_ms).toBe(1000);
    expect(measurement.within_budget).toBe(true);
  });

  it("getMemorySnapshot returns valid structure", () => {
    const snap = getMemorySnapshot();
    expect(snap.rss_mb).toBeGreaterThan(0);
    expect(snap.heap_used_mb).toBeGreaterThan(0);
    expect(snap.heap_total_mb).toBeGreaterThan(0);
    expect(typeof snap.external_mb).toBe("number");
  });

  it("CacheHitTracker tracks hits and misses", () => {
    const tracker = new CacheHitTracker("test");
    tracker.hit();
    tracker.hit();
    tracker.miss();
    expect(tracker.total).toBe(3);
    expect(tracker.hitRate).toBeCloseTo(66.7, 0);
  });

  it("CacheHitTracker snapshot returns correct structure", () => {
    const tracker = new CacheHitTracker("test-cache");
    tracker.hit();
    const snap = tracker.snapshot();
    expect(snap.name).toBe("test-cache");
    expect(snap.hits).toBe(1);
    expect(snap.misses).toBe(0);
    expect(snap.hit_rate_percent).toBe(100);
  });

  it("CacheHitTracker reset clears counters", () => {
    const tracker = new CacheHitTracker("test");
    tracker.hit();
    tracker.miss();
    tracker.reset();
    expect(tracker.total).toBe(0);
    expect(tracker.hitRate).toBe(0);
  });

  it("CacheHitTracker empty = 0% hit rate", () => {
    const tracker = new CacheHitTracker("empty");
    expect(tracker.hitRate).toBe(0);
  });

  it("barrel export includes perfMonitor", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("measureAsync");
    expect(barrel).toContain("getMemorySnapshot");
    expect(barrel).toContain("CacheHitTracker");
    expect(barrel).toContain("PERF_BUDGETS");
  });
});
