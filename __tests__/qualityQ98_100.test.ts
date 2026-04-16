/**
 * qualityQ98_100 — tests for Q-98 through Q-100 quality improvements
 *
 * Tests:
 * - Q-98: useUnsavedChanges hook existence + fetchWithRetry utility
 * - Q-99: CookieConsent granular categories + DPA page
 * - Q-100: usage-alert cron endpoint
 */
import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

const APP_DIR = path.resolve(__dirname, "../app");
const COMPONENTS_DIR = path.resolve(__dirname, "../components");
const LIB_DIR = path.resolve(__dirname, "../lib");
const MESSAGES_DIR = path.resolve(__dirname, "../messages");

// ── Q-98: UX improvements ──────────────────────────────────────────────────

describe("Q-98: useUnsavedChanges hook", () => {
  it("hook file exists", () => {
    expect(fs.existsSync(path.join(LIB_DIR, "useUnsavedChanges.ts"))).toBe(true);
  });

  it("exports useUnsavedChanges function", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "useUnsavedChanges.ts"), "utf-8");
    expect(source).toContain("export function useUnsavedChanges");
  });

  it("uses beforeunload event", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "useUnsavedChanges.ts"), "utf-8");
    expect(source).toContain("beforeunload");
  });

  it("ProfileForm uses useUnsavedChanges", () => {
    const source = fs.readFileSync(path.join(COMPONENTS_DIR, "ProfileForm.tsx"), "utf-8");
    expect(source).toContain("useUnsavedChanges");
  });

  it("TrainingLogForm uses useUnsavedChanges", () => {
    const source = fs.readFileSync(path.join(COMPONENTS_DIR, "TrainingLogForm.tsx"), "utf-8");
    expect(source).toContain("useUnsavedChanges");
  });

  it("TechniqueLogForm uses useUnsavedChanges", () => {
    const source = fs.readFileSync(path.join(COMPONENTS_DIR, "TechniqueLogForm.tsx"), "utf-8");
    expect(source).toContain("useUnsavedChanges");
  });
});

describe("Q-98: fetchWithRetry utility", () => {
  it("file exists", () => {
    expect(fs.existsSync(path.join(LIB_DIR, "fetchWithRetry.ts"))).toBe(true);
  });

  it("exports fetchWithRetry function", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "fetchWithRetry.ts"), "utf-8");
    expect(source).toContain("export async function fetchWithRetry");
  });

  it("has exponential backoff logic", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "fetchWithRetry.ts"), "utf-8");
    expect(source).toContain("baseDelay * 2 ** attempt");
  });

  it("only retries on 5xx, not 4xx", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "fetchWithRetry.ts"), "utf-8");
    expect(source).toContain("res.status >= 400 && res.status < 500");
  });

  it("barrel export includes fetchWithRetry", () => {
    const source = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(source).toContain('fetchWithRetry');
  });
});

// ── Q-99: Legal improvements ───────────────────────────────────────────────

describe("Q-99: CookieConsent granular categories", () => {
  const source = fs.readFileSync(
    path.join(COMPONENTS_DIR, "CookieConsent.tsx"),
    "utf-8"
  );

  it("has essential/analytics/marketing categories", () => {
    expect(source).toContain("essential");
    expect(source).toContain("analytics");
    expect(source).toContain("marketing");
  });

  it("exports CookiePreferences type", () => {
    expect(source).toContain("export type CookiePreferences");
  });

  it("exports getCookiePreferences function", () => {
    expect(source).toContain("export function getCookiePreferences");
  });

  it("has customize button", () => {
    expect(source).toContain("cookieCustomize");
  });

  it("has save preferences button", () => {
    expect(source).toContain("cookieSavePreferences");
  });

  it("cookie i18n keys exist in all 3 languages", () => {
    const langs = ["ja", "en", "pt"] as const;
    const keys = ["cookieEssential", "cookieAnalytics", "cookieMarketing", "cookieCustomize", "cookieSavePreferences"];
    for (const lang of langs) {
      const messages = JSON.parse(
        fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), "utf-8")
      );
      for (const key of keys) {
        expect(messages.common?.[key]).toBeDefined();
        expect(messages.common[key].length).toBeGreaterThan(0);
      }
    }
  });

  it("handles legacy consent values", () => {
    // getCookiePreferences should handle "accepted"/"declined" strings
    expect(source).toContain('"accepted"');
    expect(source).toContain('"declined"');
  });
});

describe("Q-99: DPA page", () => {
  const dpaPath = path.join(APP_DIR, "legal/dpa/page.tsx");

  it("DPA page exists", () => {
    expect(fs.existsSync(dpaPath)).toBe(true);
  });

  it("has GDPR Article 28 reference", () => {
    const source = fs.readFileSync(dpaPath, "utf-8");
    expect(source).toContain("GDPR Article 28");
  });

  it("lists sub-processors", () => {
    const source = fs.readFileSync(dpaPath, "utf-8");
    expect(source).toContain("Supabase");
    expect(source).toContain("Vercel");
    expect(source).toContain("Stripe");
    expect(source).toContain("Sentry");
  });

  it("mentions data subject rights", () => {
    const source = fs.readFileSync(dpaPath, "utf-8");
    expect(source).toContain("Data Subject Rights");
  });

  it("has breach notification section", () => {
    const source = fs.readFileSync(dpaPath, "utf-8");
    expect(source).toContain("72 hours");
  });

  it("LP footer links to DPA", () => {
    const lpSource = fs.readFileSync(path.join(APP_DIR, "page.tsx"), "utf-8");
    expect(lpSource).toContain("/legal/dpa");
  });
});

// ── Q-100: Cost management ─────────────────────────────────────────────────

describe("Q-100: usage-alert cron", () => {
  const cronPath = path.join(APP_DIR, "api/cron/usage-alert/route.ts");

  it("cron endpoint exists", () => {
    expect(fs.existsSync(cronPath)).toBe(true);
  });

  it("has CRON_SECRET auth", () => {
    const source = fs.readFileSync(cronPath, "utf-8");
    expect(source).toContain("CRON_SECRET");
    expect(source).toContain("Unauthorized");
  });

  it("checks database size", () => {
    const source = fs.readFileSync(cronPath, "utf-8");
    expect(source).toContain("Database size");
    expect(source).toContain("pg_database_size");
  });

  it("checks row counts", () => {
    const source = fs.readFileSync(cronPath, "utf-8");
    expect(source).toContain("Total row count");
    expect(source).toContain("training_logs");
  });

  it("has warning thresholds", () => {
    const source = fs.readFileSync(cronPath, "utf-8");
    expect(source).toContain("DB_SIZE_WARN_MB");
    expect(source).toContain("ROW_COUNT_WARN");
  });

  it("sends Telegram alert on warning", () => {
    const source = fs.readFileSync(cronPath, "utf-8");
    expect(source).toContain("TELEGRAM_BOT_TOKEN");
    expect(source).toContain("sendMessage");
  });

  it("is registered in vercel.json crons", () => {
    const vercelJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../vercel.json"), "utf-8")
    );
    const usageCron = vercelJson.crons.find(
      (c: { path: string }) => c.path === "/api/cron/usage-alert"
    );
    expect(usageCron).toBeDefined();
    expect(usageCron.schedule).toBe("0 6 * * *");
  });
});
