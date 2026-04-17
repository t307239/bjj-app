/**
 * qualityQ106_109 — tests for Q-106 through Q-109 quality improvements
 *
 * Tests:
 * - Q-106: Build-time env validation script + CI integration
 * - Q-107: Static page Cache-Control headers in next.config.ts
 * - Q-108: withApiTracking wrapper + health endpoint enhancements
 * - Q-109: Keyboard shortcuts hook + help overlay + i18n
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.resolve(ROOT, "lib");
const COMPONENTS_DIR = path.resolve(ROOT, "components");
const SCRIPTS_DIR = path.resolve(ROOT, "scripts");
const MESSAGES_DIR = path.resolve(ROOT, "messages");

// ── Q-106: Build-time env validation ────────────────────────────────────────
describe("Q-106: Infra — env validation", () => {
  it("check-env.mjs script exists", () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, "check-env.mjs"))).toBe(true);
  });

  it("check-env.mjs checks NEXT_PUBLIC_SUPABASE_URL", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "check-env.mjs"), "utf-8");
    expect(source).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("check-env.mjs has --strict mode for runtime secrets", () => {
    const source = fs.readFileSync(path.join(SCRIPTS_DIR, "check-env.mjs"), "utf-8");
    expect(source).toContain("--strict");
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("STRIPE_SECRET_KEY");
  });

  it("package.json has check:env script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts["check:env"]).toBeDefined();
    expect(pkg.scripts["check:env"]).toContain("check-env.mjs");
  });

  it("CI workflow includes env validation step", () => {
    const ci = fs.readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf-8");
    expect(ci).toContain("Validate env vars");
    expect(ci).toContain("check-env.mjs");
  });
});

// ── Q-107: Static page Cache-Control headers ────────────────────────────────
describe("Q-107: Cost — Cache-Control headers", () => {
  it("next.config.ts has Cache-Control for static pages", () => {
    const source = fs.readFileSync(path.join(ROOT, "next.config.ts"), "utf-8");
    expect(source).toContain("s-maxage=3600");
    expect(source).toContain("stale-while-revalidate");
  });

  it("next.config.ts targets privacy/terms/help/legal paths", () => {
    const source = fs.readFileSync(path.join(ROOT, "next.config.ts"), "utf-8");
    expect(source).toContain("privacy");
    expect(source).toContain("terms");
    expect(source).toContain("help");
    expect(source).toContain("legal");
  });
});

// ── Q-108: withApiTracking + health enhancements ────────────────────────────
describe("Q-108: Observability — API tracking", () => {
  it("withApiTracking.ts exists and exports the function", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "withApiTracking.ts"), "utf-8");
    expect(source).toContain("export function withApiTracking");
    expect(source).toContain("SLOW_THRESHOLD_MS");
    expect(source).toContain("Server-Timing");
  });

  it("withApiTracking logs slow requests via logger.warn", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "withApiTracking.ts"), "utf-8");
    expect(source).toContain("logger.warn");
    expect(source).toContain(".slow");
    expect(source).toContain("durationMs");
  });

  it("withApiTracking is in barrel export", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("withApiTracking");
  });

  it("health endpoint has dbStatus classification", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/health/route.ts"), "utf-8");
    expect(source).toContain("dbStatus");
    expect(source).toContain('"fast"');
    expect(source).toContain('"normal"');
    expect(source).toContain('"slow"');
  });

  it("health endpoint has Server-Timing header", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/health/route.ts"), "utf-8");
    expect(source).toContain("Server-Timing");
  });
});

// ── Q-109: Keyboard shortcuts ───────────────────────────────────────────────
describe("Q-109: UX — Keyboard shortcuts", () => {
  it("useKeyboardShortcuts hook exists", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "useKeyboardShortcuts.ts"), "utf-8");
    expect(source).toContain("export function useKeyboardShortcuts");
    expect(source).toContain("SHORTCUTS");
  });

  it("shortcuts include navigation keys", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "useKeyboardShortcuts.ts"), "utf-8");
    expect(source).toContain("/dashboard");
    expect(source).toContain("/records");
    expect(source).toContain("/techniques");
    expect(source).toContain("/profile");
  });

  it("shortcuts ignore input-focused state", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "useKeyboardShortcuts.ts"), "utf-8");
    expect(source).toContain("isInputFocused");
    expect(source).toContain("textarea");
  });

  it("KeyboardShortcutHelp component exists with dialog role", () => {
    const source = fs.readFileSync(path.join(COMPONENTS_DIR, "KeyboardShortcutHelp.tsx"), "utf-8");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("aria-modal");
    expect(source).toContain("Escape");
  });

  it("KeyboardShortcutProvider is wired into layout", () => {
    const layout = fs.readFileSync(path.join(ROOT, "app/layout.tsx"), "utf-8");
    expect(layout).toContain("KeyboardShortcutProvider");
  });
});

// ── Q-109: Keyboard shortcuts i18n ──────────────────────────────────────────
describe("Q-109: Keyboard shortcuts i18n", () => {
  for (const lang of ["en", "ja", "pt"]) {
    it(`${lang}.json has shortcuts keys`, () => {
      const data = JSON.parse(
        fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), "utf-8")
      );
      expect(data.shortcuts).toBeDefined();
      expect(data.shortcuts.title).toBeDefined();
      expect(data.shortcuts.help).toBeDefined();
      expect(data.shortcuts.home).toBeDefined();
      expect(data.shortcuts.records).toBeDefined();
      expect(data.shortcuts.techniques).toBeDefined();
      expect(data.shortcuts.profile).toBeDefined();
    });
  }
});
