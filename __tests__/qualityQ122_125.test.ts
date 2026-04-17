/**
 * qualityQ122_125 — tests for Q-122 through Q-125 quality improvements
 *
 * Tests:
 * - Q-122: Engagement scoring (engagementScoring.ts)
 * - Q-123: CI enhancements (cache, PR size label workflow)
 * - Q-124: Alert router + uptime monitors (alertRouter.ts)
 * - Q-125: OfflineBanner reconnected enhancement
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.resolve(ROOT, "lib");
const WORKFLOWS_DIR = path.resolve(ROOT, ".github/workflows");

// ── Q-122: Engagement Scoring ─────────────────────────────────────────────
describe("Q-122: Retention — engagementScoring", () => {
  let calculateEngagement: typeof import("../lib/engagementScoring").calculateEngagement;
  let batchEngagementScores: typeof import("../lib/engagementScoring").batchEngagementScores;

  beforeAll(async () => {
    const mod = await import("../lib/engagementScoring");
    calculateEngagement = mod.calculateEngagement;
    batchEngagementScores = mod.batchEngagementScores;
  });

  const baseInput = {
    sessions30d: 0,
    currentStreak: 0,
    longestStreak: 0,
    daysSinceLastSession: 30,
    techniquesCount: 0,
    competitionsCount: 0,
    hasWeeklyGoal: false,
    hasPushEnabled: false,
    tracksWeight: false,
    profileComplete: false,
  };

  it("zero activity = churning tier", () => {
    const result = calculateEngagement(baseInput);
    expect(result.tier).toBe("churning");
    expect(result.score).toBeLessThan(15);
  });

  it("highly active user = champion tier", () => {
    const result = calculateEngagement({
      sessions30d: 15,
      currentStreak: 10,
      longestStreak: 30,
      daysSinceLastSession: 0,
      techniquesCount: 15,
      competitionsCount: 3,
      hasWeeklyGoal: true,
      hasPushEnabled: true,
      tracksWeight: true,
      profileComplete: true,
    });
    expect(result.tier).toBe("champion");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("moderate user = casual or engaged", () => {
    const result = calculateEngagement({
      ...baseInput,
      sessions30d: 6,
      currentStreak: 2,
      longestStreak: 7,
      daysSinceLastSession: 1,
      techniquesCount: 3,
    });
    expect(["casual", "engaged"]).toContain(result.tier);
    expect(result.score).toBeGreaterThan(30);
  });

  it("returns all 5 dimensions", () => {
    const result = calculateEngagement(baseInput);
    expect(result.dimensions).toHaveProperty("frequency");
    expect(result.dimensions).toHaveProperty("consistency");
    expect(result.dimensions).toHaveProperty("recency");
    expect(result.dimensions).toHaveProperty("breadth");
    expect(result.dimensions).toHaveProperty("investment");
  });

  it("score is between 0 and 100", () => {
    const result = calculateEngagement(baseInput);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("suggestedAction is non-empty string", () => {
    const result = calculateEngagement(baseInput);
    expect(result.suggestedAction).toBeTruthy();
    expect(typeof result.suggestedAction).toBe("string");
  });

  it("batchEngagementScores sorts by score descending", () => {
    const users = [
      { id: "low", ...baseInput },
      { id: "high", ...baseInput, sessions30d: 15, daysSinceLastSession: 0, currentStreak: 10, longestStreak: 30 },
    ];
    const sorted = batchEngagementScores(users);
    expect(sorted[0].id).toBe("high");
    expect(sorted[1].id).toBe("low");
    expect(sorted[0].engagement.score).toBeGreaterThan(sorted[1].engagement.score);
  });

  it("frequency maxes out at 12 sessions", () => {
    const r1 = calculateEngagement({ ...baseInput, sessions30d: 12, daysSinceLastSession: 0 });
    const r2 = calculateEngagement({ ...baseInput, sessions30d: 20, daysSinceLastSession: 0 });
    expect(r1.dimensions.frequency).toBe(100);
    expect(r2.dimensions.frequency).toBe(100);
  });

  it("recency: 0 days = 100, 30 days = 0", () => {
    const r0 = calculateEngagement({ ...baseInput, daysSinceLastSession: 0 });
    const r30 = calculateEngagement({ ...baseInput, daysSinceLastSession: 30 });
    expect(r0.dimensions.recency).toBe(100);
    expect(r30.dimensions.recency).toBe(0);
  });

  it("investment: all toggles on = 100", () => {
    const result = calculateEngagement({
      ...baseInput,
      hasWeeklyGoal: true,
      hasPushEnabled: true,
      profileComplete: true,
    });
    expect(result.dimensions.investment).toBe(100);
  });

  it("barrel export includes engagement scoring", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("calculateEngagement");
    expect(barrel).toContain("batchEngagementScores");
  });
});

// ── Q-123: CI Enhancements ────────────────────────────────────────────────
describe("Q-123: Infra — CI enhancements", () => {
  it("ci.yml has Next.js build cache", () => {
    const source = fs.readFileSync(path.join(WORKFLOWS_DIR, "ci.yml"), "utf-8");
    expect(source).toContain("actions/cache@v4");
    expect(source).toContain(".next/cache");
    expect(source).toContain("nextjs-");
  });

  it("pr-size-label.yml exists", () => {
    expect(fs.existsSync(path.join(WORKFLOWS_DIR, "pr-size-label.yml"))).toBe(true);
  });

  it("pr-size-label.yml has size thresholds", () => {
    const source = fs.readFileSync(path.join(WORKFLOWS_DIR, "pr-size-label.yml"), "utf-8");
    expect(source).toContain("size/XS");
    expect(source).toContain("size/S");
    expect(source).toContain("size/M");
    expect(source).toContain("size/L");
    expect(source).toContain("size/XL");
  });

  it("pr-size-label.yml uses actions/github-script", () => {
    const source = fs.readFileSync(path.join(WORKFLOWS_DIR, "pr-size-label.yml"), "utf-8");
    expect(source).toContain("actions/github-script@v7");
    expect(source).toContain("addLabels");
  });
});

// ── Q-124: Alert Router ───────────────────────────────────────────────────
describe("Q-124: Obs — alertRouter", () => {
  let routeAlert: typeof import("../lib/alertRouter").routeAlert;
  let UPTIME_MONITORS: typeof import("../lib/alertRouter").UPTIME_MONITORS;

  beforeAll(async () => {
    const mod = await import("../lib/alertRouter");
    routeAlert = mod.routeAlert;
    UPTIME_MONITORS = mod.UPTIME_MONITORS;
  });

  it("UPTIME_MONITORS has HEALTH endpoint", () => {
    expect(UPTIME_MONITORS.HEALTH.url).toContain("bjj-app.net/api/health");
    expect(UPTIME_MONITORS.HEALTH.interval_seconds).toBe(60);
    expect(UPTIME_MONITORS.HEALTH.expected_status).toBe(200);
  });

  it("UPTIME_MONITORS has LANDING, LOGIN, WIKI", () => {
    expect(UPTIME_MONITORS.LANDING.url).toContain("bjj-app.net");
    expect(UPTIME_MONITORS.LOGIN.url).toContain("/login");
    expect(UPTIME_MONITORS.WIKI.url).toContain("wiki.bjj-app.net");
  });

  it("routeAlert logs info alert", async () => {
    const result = await routeAlert({
      severity: "info",
      category: "uptime",
      title: "Test info",
      message: "Test message",
    });
    expect(result.logged).toBe(true);
    expect(result.sentryReported).toBe(false);
    expect(result.telegramSent).toBe(false);
  });

  it("routeAlert flags warning for Sentry", async () => {
    const result = await routeAlert({
      severity: "warning",
      category: "latency",
      title: "Slow API",
      message: "P95 > 2s",
    });
    expect(result.logged).toBe(true);
    expect(result.sentryReported).toBe(true);
  });

  it("routeAlert flags critical for Telegram (no token = not sent)", async () => {
    const result = await routeAlert({
      severity: "critical",
      category: "uptime",
      title: "Service down",
      message: "Health check failed",
    });
    expect(result.logged).toBe(true);
    expect(result.sentryReported).toBe(true);
    // No TELEGRAM_BOT_TOKEN in test env
    expect(result.telegramSent).toBe(false);
  });

  it("alertRouter.ts exports convenience functions", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "alertRouter.ts"), "utf-8");
    expect(source).toContain("export async function alertCritical");
    expect(source).toContain("export async function alertWarning");
  });

  it("barrel export includes alert router", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("routeAlert");
    expect(barrel).toContain("alertCritical");
    expect(barrel).toContain("UPTIME_MONITORS");
  });
});

// ── Q-125: UX — OfflineBanner Enhancement ─────────────────────────────────
describe("Q-125: UX — OfflineBanner reconnected", () => {
  it("OfflineBanner.tsx has reconnected logic", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "components/OfflineBanner.tsx"), "utf-8");
    expect(source).toContain("showReconnected");
    expect(source).toContain("wasOfflineRef");
    expect(source).toContain("offline.reconnected");
  });

  it("OfflineBanner.tsx has aria-live assertive", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "components/OfflineBanner.tsx"), "utf-8");
    expect(source).toContain('aria-live="assertive"');
  });

  it("OfflineBanner auto-dismisses reconnected after timeout", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "components/OfflineBanner.tsx"), "utf-8");
    expect(source).toContain("setTimeout");
    expect(source).toContain("clearTimeout");
    expect(source).toContain("3000");
  });

  it("ja.json has offline.reconnected key", () => {
    const ja = JSON.parse(fs.readFileSync(path.resolve(ROOT, "messages/ja.json"), "utf-8"));
    expect(ja.offline.reconnected).toBeTruthy();
    expect(ja.offline.reconnected).toContain("復旧");
  });

  it("en.json has offline.reconnected key", () => {
    const en = JSON.parse(fs.readFileSync(path.resolve(ROOT, "messages/en.json"), "utf-8"));
    expect(en.offline.reconnected).toBeTruthy();
    expect(en.offline.reconnected).toContain("restored");
  });

  it("pt.json has offline section with both keys", () => {
    const pt = JSON.parse(fs.readFileSync(path.resolve(ROOT, "messages/pt.json"), "utf-8"));
    expect(pt.offline).toBeDefined();
    expect(pt.offline.banner).toBeTruthy();
    expect(pt.offline.reconnected).toBeTruthy();
  });
});
