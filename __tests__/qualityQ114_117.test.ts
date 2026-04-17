/**
 * qualityQ114_117 — tests for Q-114 through Q-117 quality improvements
 *
 * Tests:
 * - Q-114: Bundle size monitoring script
 * - Q-115: Streak utilities (grace period + comeback detection)
 * - Q-116: Error budget / SLO constants + request ID
 * - Q-117: Dependabot auto-merge + deploy notify workflows
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.resolve(ROOT, "lib");
const SCRIPTS_DIR = path.resolve(ROOT, "scripts");
const WORKFLOWS_DIR = path.resolve(ROOT, ".github/workflows");

// ── Q-114: Bundle size monitoring ──────────────────────────────────────────
describe("Q-114: Cost — bundle-size-check.mjs", () => {
  it("bundle-size-check.mjs script exists", () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, "bundle-size-check.mjs"))).toBe(true);
  });

  it("bundle-size-check.mjs reads build-manifest.json", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "bundle-size-check.mjs"), "utf-8");
    expect(source).toContain("build-manifest.json");
    expect(source).toContain("DEFAULT_MAX_PAGE_KB");
  });

  it("bundle-size-check.mjs has --max-page and --json flags", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "bundle-size-check.mjs"), "utf-8");
    expect(source).toContain("--max-page");
    expect(source).toContain("--json");
    expect(source).toContain("overBudget");
  });

  it("package.json has check:bundle script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts["check:bundle"]).toBeDefined();
    expect(pkg.scripts["check:bundle"]).toContain("bundle-size-check.mjs");
  });
});

// ── Q-115: Streak utilities ────────────────────────────────────────────────
describe("Q-115: Retention — streakUtils", () => {
  // Dynamic import for ESM compatibility
  let calcStreak: typeof import("../lib/streakUtils").calcStreak;
  let calcStreakWithGrace: typeof import("../lib/streakUtils").calcStreakWithGrace;
  let detectComeback: typeof import("../lib/streakUtils").detectComeback;
  let classifyEngagement: typeof import("../lib/streakUtils").classifyEngagement;

  beforeAll(async () => {
    const mod = await import("../lib/streakUtils");
    calcStreak = mod.calcStreak;
    calcStreakWithGrace = mod.calcStreakWithGrace;
    detectComeback = mod.detectComeback;
    classifyEngagement = mod.classifyEngagement;
  });

  it("calcStreak: 3 consecutive days = streak 3", () => {
    const dates = ["2026-04-17", "2026-04-16", "2026-04-15"];
    expect(calcStreak(dates, "2026-04-17")).toBe(3);
  });

  it("calcStreak: gap breaks streak", () => {
    const dates = ["2026-04-17", "2026-04-15"]; // 16th missing
    expect(calcStreak(dates, "2026-04-17")).toBe(1);
  });

  it("calcStreak: empty logs = 0", () => {
    expect(calcStreak([], "2026-04-17")).toBe(0);
  });

  it("calcStreakWithGrace: 1-day gap preserved with grace", () => {
    const dates = ["2026-04-17", "2026-04-15", "2026-04-14"]; // 16th missing
    expect(calcStreakWithGrace(dates, "2026-04-17", 1)).toBe(3);
  });

  it("calcStreakWithGrace: 2-day gap breaks with grace=1", () => {
    const dates = ["2026-04-17", "2026-04-14"]; // 15th and 16th missing
    expect(calcStreakWithGrace(dates, "2026-04-17", 1)).toBe(1);
  });

  it("detectComeback: null when not trained today", () => {
    const dates = ["2026-04-10"];
    expect(detectComeback(dates, "2026-04-17")).toBeNull();
  });

  it("detectComeback: returns daysAway for 7+ day break", () => {
    const dates = ["2026-04-17", "2026-04-08"]; // 9 days away
    const result = detectComeback(dates, "2026-04-17");
    expect(result).not.toBeNull();
    expect(result!.daysAway).toBe(9);
  });

  it("detectComeback: null for short break (<7 days)", () => {
    const dates = ["2026-04-17", "2026-04-14"]; // 3 days away
    expect(detectComeback(dates, "2026-04-17")).toBeNull();
  });

  it("classifyEngagement: 0 = inactive", () => {
    expect(classifyEngagement(0)).toBe("inactive");
  });

  it("classifyEngagement: 3 = casual", () => {
    expect(classifyEngagement(3)).toBe("casual");
  });

  it("classifyEngagement: 8 = regular", () => {
    expect(classifyEngagement(8)).toBe("regular");
  });

  it("classifyEngagement: 15 = dedicated", () => {
    expect(classifyEngagement(15)).toBe("dedicated");
  });

  it("classifyEngagement: 25 = elite", () => {
    expect(classifyEngagement(25)).toBe("elite");
  });

  it("streakUtils is in barrel export", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("calcStreak");
    expect(barrel).toContain("calcStreakWithGrace");
    expect(barrel).toContain("detectComeback");
    expect(barrel).toContain("classifyEngagement");
  });
});

// ── Q-116: Error budget / SLO ──────────────────────────────────────────────
describe("Q-116: Obs — errorBudget", () => {
  it("errorBudget.ts exports SLO constants", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "errorBudget.ts"), "utf-8");
    expect(source).toContain("export const SLO");
    expect(source).toContain("AVAILABILITY_TARGET");
    expect(source).toContain("API_LATENCY_P95_MS");
    expect(source).toContain("DB_LATENCY");
  });

  it("errorBudget.ts exports ALERT_THRESHOLDS", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "errorBudget.ts"), "utf-8");
    expect(source).toContain("export const ALERT_THRESHOLDS");
    expect(source).toContain("HEALTH_CHECK_FAILURES");
    expect(source).toContain("ERROR_RATE_5MIN");
    expect(source).toContain("DB_LATENCY_CRITICAL_MS");
  });

  it("errorBudget.ts exports generateRequestId", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "errorBudget.ts"), "utf-8");
    expect(source).toContain("export function generateRequestId");
    expect(source).toContain("REQUEST_ID_HEADER");
  });

  it("SLO values are reasonable", async () => {
    const { SLO } = await import("../lib/errorBudget");
    expect(SLO.AVAILABILITY_TARGET).toBeGreaterThanOrEqual(0.99);
    expect(SLO.AVAILABILITY_TARGET).toBeLessThanOrEqual(1);
    expect(SLO.API_LATENCY_P95_MS).toBeLessThanOrEqual(5000);
    expect(SLO.DB_LATENCY.FAST).toBeLessThan(SLO.DB_LATENCY.NORMAL);
    expect(SLO.DB_LATENCY.NORMAL).toBeLessThan(SLO.DB_LATENCY.SLOW);
  });

  it("generateRequestId returns unique IDs", async () => {
    const { generateRequestId } = await import("../lib/errorBudget");
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it("errorBudget is in barrel export", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("SLO");
    expect(barrel).toContain("ALERT_THRESHOLDS");
    expect(barrel).toContain("generateRequestId");
  });
});

// ── Q-117: Infra — Dependabot auto-merge + deploy notify ───────────────────
describe("Q-117: Infra — CI workflows", () => {
  it("dependabot-auto-merge.yml exists", () => {
    expect(fs.existsSync(path.join(WORKFLOWS_DIR, "dependabot-auto-merge.yml"))).toBe(true);
  });

  it("dependabot-auto-merge.yml targets patch and minor", () => {
    const source = fs.readFileSync(path.join(WORKFLOWS_DIR, "dependabot-auto-merge.yml"), "utf-8");
    expect(source).toContain("semver-patch");
    expect(source).toContain("semver-minor");
    expect(source).toContain("dependabot[bot]");
    expect(source).toContain("gh pr merge --auto --squash");
  });

  it("deploy-notify.yml exists", () => {
    expect(fs.existsSync(path.join(WORKFLOWS_DIR, "deploy-notify.yml"))).toBe(true);
  });

  it("deploy-notify.yml sends Telegram notification", () => {
    const source = fs.readFileSync(path.join(WORKFLOWS_DIR, "deploy-notify.yml"), "utf-8");
    expect(source).toContain("TELEGRAM_BOT_TOKEN");
    expect(source).toContain("TELEGRAM_CHAT_ID");
    expect(source).toContain("BJJ App deployed");
  });

  it("deploy-notify.yml triggers on CI success", () => {
    const source = fs.readFileSync(path.join(WORKFLOWS_DIR, "deploy-notify.yml"), "utf-8");
    expect(source).toContain("workflow_run");
    expect(source).toContain("completed");
    expect(source).toContain("success");
  });
});
