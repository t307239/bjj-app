/**
 * qualityQ118_121 — tests for Q-118 through Q-121 quality improvements
 *
 * Tests:
 * - Q-118: Data validation utilities (dataValidation.ts)
 * - Q-119: Admin activity API endpoint
 * - Q-120: Image audit script
 * - Q-121: Unused export detection script
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.resolve(ROOT, "lib");
const SCRIPTS_DIR = path.resolve(ROOT, "scripts");

// ── Q-118: Data Validation ────────────────────────────────────────────────
describe("Q-118: Data — dataValidation", () => {
  let validateTrainingLog: typeof import("../lib/dataValidation").validateTrainingLog;
  let validateBelt: typeof import("../lib/dataValidation").validateBelt;
  let validateStripe: typeof import("../lib/dataValidation").validateStripe;
  let validateWeight: typeof import("../lib/dataValidation").validateWeight;
  let sanitizeText: typeof import("../lib/dataValidation").sanitizeText;
  let VALID_BELTS: typeof import("../lib/dataValidation").VALID_BELTS;
  let LIMITS: typeof import("../lib/dataValidation").LIMITS;

  beforeAll(async () => {
    const mod = await import("../lib/dataValidation");
    validateTrainingLog = mod.validateTrainingLog;
    validateBelt = mod.validateBelt;
    validateStripe = mod.validateStripe;
    validateWeight = mod.validateWeight;
    sanitizeText = mod.sanitizeText;
    VALID_BELTS = mod.VALID_BELTS;
    LIMITS = mod.LIMITS;
  });

  // validateTrainingLog
  it("valid training log returns no errors", () => {
    const errors = validateTrainingLog({ date: "2026-04-17", duration_min: 90, notes: "Good session" });
    expect(errors).toHaveLength(0);
  });

  it("rejects invalid date format", () => {
    const errors = validateTrainingLog({ date: "04-17-2026" });
    expect(errors).toContain("Invalid date format (expected YYYY-MM-DD)");
  });

  it("rejects far future dates", () => {
    const errors = validateTrainingLog({ date: "2030-01-01" });
    expect(errors.some((e) => e.includes("future"))).toBe(true);
  });

  it("rejects negative duration", () => {
    const errors = validateTrainingLog({ duration_min: -5 });
    expect(errors).toContain("Duration must be positive");
  });

  it("rejects excessive duration", () => {
    const errors = validateTrainingLog({ duration_min: 999 });
    expect(errors.some((e) => e.includes("maximum"))).toBe(true);
  });

  it("rejects overly long notes", () => {
    const errors = validateTrainingLog({ notes: "x".repeat(6000) });
    expect(errors.some((e) => e.includes("Notes"))).toBe(true);
  });

  it("allows empty object (all optional)", () => {
    const errors = validateTrainingLog({});
    expect(errors).toHaveLength(0);
  });

  // validateBelt
  it("accepts valid belts", () => {
    for (const belt of VALID_BELTS) {
      expect(validateBelt(belt)).toBe(true);
    }
  });

  it("rejects invalid belt", () => {
    expect(validateBelt("red")).toBe(false);
    expect(validateBelt("")).toBe(false);
  });

  // validateStripe
  it("valid stripe returns null", () => {
    expect(validateStripe(3, "blue")).toBeNull();
  });

  it("negative stripe returns error", () => {
    expect(validateStripe(-1, "white")).toBeTruthy();
  });

  it("excessive stripe returns error", () => {
    expect(validateStripe(5, "purple")).toBeTruthy();
  });

  // validateWeight
  it("valid weight returns null", () => {
    expect(validateWeight(75)).toBeNull();
  });

  it("too light returns error", () => {
    expect(validateWeight(10)).toBeTruthy();
  });

  it("too heavy returns error", () => {
    expect(validateWeight(400)).toBeTruthy();
  });

  // sanitizeText
  it("trims and collapses whitespace", () => {
    expect(sanitizeText("  hello   world  ")).toBe("hello world");
  });

  it("respects maxLength", () => {
    expect(sanitizeText("abcdefghij", 5)).toBe("abcde");
  });

  // barrel export
  it("dataValidation is in barrel export", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("validateTrainingLog");
    expect(barrel).toContain("validateBelt");
    expect(barrel).toContain("validateStripe");
    expect(barrel).toContain("validateWeight");
    expect(barrel).toContain("sanitizeText");
    expect(barrel).toContain("VALID_BELTS");
    expect(barrel).toContain("LIMITS");
  });

  // LIMITS constants are reasonable
  it("LIMITS constants are reasonable", () => {
    expect(LIMITS.MAX_DURATION_MIN).toBe(480);
    expect(LIMITS.MAX_STRIPE).toBe(4);
    expect(LIMITS.MAX_WEIGHT_KG).toBe(300);
    expect(LIMITS.MIN_WEIGHT_KG).toBe(20);
    expect(LIMITS.MAX_NOTES_LENGTH).toBe(5000);
  });
});

// ── Q-119: Admin Activity API ─────────────────────────────────────────────
describe("Q-119: Ops — Admin activity endpoint", () => {
  it("admin activity route.ts exists", () => {
    expect(fs.existsSync(path.join(ROOT, "app/api/admin/activity/route.ts"))).toBe(true);
  });

  it("activity route has rate limiting", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/admin/activity/route.ts"), "utf-8");
    expect(source).toContain("createRateLimiter");
    expect(source).toContain("adminLimiter");
  });

  it("activity route checks admin email", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/admin/activity/route.ts"), "utf-8");
    expect(source).toContain("isAdminEmail");
    expect(source).toContain("Forbidden");
  });

  it("activity route returns daily_stats and recent_entries", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/admin/activity/route.ts"), "utf-8");
    expect(source).toContain("daily_stats");
    expect(source).toContain("recent_entries");
    expect(source).toContain("period_days");
  });

  it("activity route masks email addresses", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/admin/activity/route.ts"), "utf-8");
    expect(source).toContain("user_email_masked");
    expect(source).toContain('masked');
  });

  it("activity route supports days and limit params", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/admin/activity/route.ts"), "utf-8");
    expect(source).toContain("days");
    expect(source).toContain("limit");
    expect(source).toContain("Math.min(90");
    expect(source).toContain("Math.min(200");
  });
});

// ── Q-120: Image Audit Script ─────────────────────────────────────────────
describe("Q-120: Cost — image-audit.mjs", () => {
  it("image-audit.mjs script exists", () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, "image-audit.mjs"))).toBe(true);
  });

  it("image-audit.mjs checks for large images", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "image-audit.mjs"), "utf-8");
    expect(source).toContain("LARGE_IMAGE");
    expect(source).toContain("MAX_KB");
  });

  it("image-audit.mjs detects raw <img> tags", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "image-audit.mjs"), "utf-8");
    expect(source).toContain("RAW_IMG_TAG");
    expect(source).toContain("next/image");
  });

  it("image-audit.mjs detects unused images", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "image-audit.mjs"), "utf-8");
    expect(source).toContain("UNUSED_IMAGE");
  });

  it("image-audit.mjs has --json and --fix-hint flags", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "image-audit.mjs"), "utf-8");
    expect(source).toContain("--json");
    expect(source).toContain("--fix-hint");
    expect(source).toContain("--max-kb");
  });

  it("package.json has check:images script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts["check:images"]).toBeDefined();
    expect(pkg.scripts["check:images"]).toContain("image-audit.mjs");
  });
});

// ── Q-121: Unused Export Detection ────────────────────────────────────────
describe("Q-121: DX — check-unused-exports.mjs", () => {
  it("check-unused-exports.mjs script exists", () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, "check-unused-exports.mjs"))).toBe(true);
  });

  it("check-unused-exports.mjs scans lib/ exports", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "check-unused-exports.mjs"), "utf-8");
    expect(source).toContain("extractExports");
    expect(source).toContain("export\\s+");
  });

  it("check-unused-exports.mjs checks consumer files", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "check-unused-exports.mjs"), "utf-8");
    expect(source).toContain("consumerDirs");
    expect(source).toContain("allConsumerContent");
  });

  it("check-unused-exports.mjs skips known files", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "check-unused-exports.mjs"), "utf-8");
    expect(source).toContain("SKIP_FILES");
    expect(source).toContain("index.ts");
    expect(source).toContain("database.types.ts");
  });

  it("check-unused-exports.mjs has --json and --fix-hint flags", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "check-unused-exports.mjs"), "utf-8");
    expect(source).toContain("--json");
    expect(source).toContain("--fix-hint");
  });

  it("check-unused-exports.mjs reports utilization %", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "check-unused-exports.mjs"), "utf-8");
    expect(source).toContain("utilization");
  });

  it("package.json has check:exports script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts["check:exports"]).toBeDefined();
    expect(pkg.scripts["check:exports"]).toContain("check-unused-exports.mjs");
  });
});
