/**
 * qualityQ110_113 — tests for Q-110 through Q-113 quality improvements
 *
 * Tests:
 * - Q-110: Admin panel Stripe details + CSV export mode
 * - Q-111: Backup verification script (verify-backup.mjs)
 * - Q-112: JSDoc headers + barrel export verification script
 * - Q-113: Post-deploy smoke test script + CI integration
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.resolve(ROOT, "lib");
const SCRIPTS_DIR = path.resolve(ROOT, "scripts");

// ── Q-110: Admin Stripe details + CSV export ──────────────────────────────────
describe("Q-110: Ops — Admin Stripe + CSV", () => {
  it("AdminPanel type includes stripe field", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/admin/AdminPanel.tsx"), "utf-8");
    expect(source).toContain("stripe: number");
  });

  it("AdminPanel shows Stripe badge in expanded view", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/admin/AdminPanel.tsx"), "utf-8");
    expect(source).toContain("Stripe (belt)");
    expect(source).toContain("Subscription");
  });

  it("AdminPanel has CSV export button", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/admin/AdminPanel.tsx"), "utf-8");
    expect(source).toContain("Export CSV");
    expect(source).toContain("handleExportCsv");
    expect(source).toContain('format: "csv"');
  });

  it("Admin API route supports CSV format param", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/admin/users/route.ts"), "utf-8");
    expect(source).toContain('format === "csv"');
    expect(source).toContain("text/csv");
    expect(source).toContain("Content-Disposition");
  });

  it("Admin API includes stripe in response", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/admin/users/route.ts"), "utf-8");
    expect(source).toContain("stripe: (profile?.stripe");
  });

  it("AdminPanel shows Pro/Free subscription status", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/admin/AdminPanel.tsx"), "utf-8");
    expect(source).toContain('"Pro"');
    expect(source).toContain('"Free"');
    expect(source).toContain("text-yellow-400");
  });
});

// ── Q-111: Backup verification script ──────────────────────────────────────────
describe("Q-111: Data — verify-backup.mjs", () => {
  it("verify-backup.mjs script exists", () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, "verify-backup.mjs"))).toBe(true);
  });

  it("verify-backup.mjs checks SUPABASE_ACCESS_TOKEN", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "verify-backup.mjs"), "utf-8");
    expect(source).toContain("SUPABASE_ACCESS_TOKEN");
    expect(source).toContain("SUPABASE_PROJECT_REF");
  });

  it("verify-backup.mjs has --max-age-hours flag", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "verify-backup.mjs"), "utf-8");
    expect(source).toContain("--max-age-hours");
    expect(source).toContain("DEFAULT_MAX_AGE_HOURS");
  });

  it("verify-backup.mjs has --json output mode", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "verify-backup.mjs"), "utf-8");
    expect(source).toContain("--json");
    expect(source).toContain("JSON.stringify");
  });

  it("verify-backup.mjs classifies as ok or stale", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "verify-backup.mjs"), "utf-8");
    expect(source).toContain('"ok"');
    expect(source).toContain('"stale"');
    expect(source).toContain("ageHours");
  });

  it("package.json has check:backup script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts["check:backup"]).toBeDefined();
    expect(pkg.scripts["check:backup"]).toContain("verify-backup.mjs");
  });
});

// ── Q-112: DX — JSDoc + barrel verification ────────────────────────────────────
describe("Q-112: DX — JSDoc + barrel check", () => {
  it("trainingTypes.ts has JSDoc header", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "trainingTypes.ts"), "utf-8");
    expect(source).toContain("/**");
    expect(source).toContain("Training session type definitions");
  });

  it("trainingLogHelpers.ts has JSDoc header", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "trainingLogHelpers.ts"), "utf-8");
    expect(source).toContain("/**");
    expect(source).toContain("Shared types and pure helpers");
  });

  it("check-barrel.mjs script exists", () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, "check-barrel.mjs"))).toBe(true);
  });

  it("check-barrel.mjs checks lib/index.ts", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "check-barrel.mjs"), "utf-8");
    expect(source).toContain("index.ts");
    expect(source).toContain("EXCLUDED");
    expect(source).toContain("--list");
  });

  it("all top lib/ exports have JSDoc", () => {
    const topFiles = [
      "formatDate.ts",
      "analytics.ts",
      "logicalDate.ts",
      "timezone.ts",
      "fetchWithRetry.ts",
      "validation.ts",
      "breadcrumb.ts",
      "haptics.ts",
      "logger.ts",
      "rateLimit.ts",
      "withApiTracking.ts",
      "trainingTypes.ts",
      "trainingLogHelpers.ts",
    ];
    for (const file of topFiles) {
      const source = fs.readFileSync(path.join(LIB_DIR, file), "utf-8");
      expect(source.startsWith("/**")).toBe(true);
    }
  });
});

// ── Q-113: Infra — smoke-test.mjs ─────────────────────────────────────────────
describe("Q-113: Infra — smoke-test.mjs", () => {
  it("smoke-test.mjs script exists", () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, "smoke-test.mjs"))).toBe(true);
  });

  it("smoke-test.mjs checks /api/health", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "smoke-test.mjs"), "utf-8");
    expect(source).toContain("/api/health");
    expect(source).toContain("Health endpoint");
  });

  it("smoke-test.mjs checks key pages", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "smoke-test.mjs"), "utf-8");
    expect(source).toContain("/login");
    expect(source).toContain("/privacy");
    expect(source).toContain("/terms");
    expect(source).toContain("/help");
  });

  it("smoke-test.mjs has --base-url flag", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "smoke-test.mjs"), "utf-8");
    expect(source).toContain("--base-url");
    expect(source).toContain("DEFAULT_BASE_URL");
  });

  it("smoke-test.mjs has --json output mode", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "smoke-test.mjs"), "utf-8");
    expect(source).toContain("--json");
    expect(source).toContain("JSON.stringify");
  });

  it("smoke-test.mjs validates health body", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "smoke-test.mjs"), "utf-8");
    expect(source).toContain("checkBody");
    expect(source).toContain("dbLatencyMs");
    expect(source).toContain('"ok"');
  });

  it("package.json has check:smoke script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts["check:smoke"]).toBeDefined();
    expect(pkg.scripts["check:smoke"]).toContain("smoke-test.mjs");
  });

  it("CI workflow includes smoke test job", () => {
    const ci = fs.readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf-8");
    expect(ci).toContain("smoke-test");
    expect(ci).toContain("Post-deploy Smoke Test");
  });
});
