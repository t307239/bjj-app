/**
 * qualityQ90_92 — tests for Q-90 through Q-92 quality improvements
 *
 * Tests:
 * - Q-90: suppressHydrationWarning on html/body for browser extension compat
 * - Q-91: Weekly email cron route existence + structure + opt-out logic
 * - Q-91: Push preferences API accepts weekly_email in zod schema
 * - Q-91: PushNotificationSection includes weekly_email toggle
 * - Q-92: ProGate money-back guarantee + benefit highlight
 * - Q-92: PricingSection money-back guarantee + benefit highlight
 * - Q-92: Conversion i18n keys exist in all 3 languages
 * - Whitelist insert pattern (no spread into .insert/.update)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const APP_DIR = path.resolve(__dirname, "../app");
const COMPONENTS_DIR = path.resolve(__dirname, "../components");
const MESSAGES_DIR = path.resolve(__dirname, "../messages");
const HOOKS_DIR = path.resolve(__dirname, "../hooks");

// ── Q-90: Performance — suppressHydrationWarning ────────────────────────────

describe("Q-90: suppressHydrationWarning", () => {
  const layout = fs.readFileSync(path.join(APP_DIR, "layout.tsx"), "utf-8");

  it("html element has suppressHydrationWarning", () => {
    expect(layout).toMatch(/html[^>]*suppressHydrationWarning/);
  });

  it("body element has suppressHydrationWarning", () => {
    expect(layout).toMatch(/body[^>]*suppressHydrationWarning/);
  });
});

// ── Q-91: Weekly Email Cron ─────────────────────────────────────────────────

describe("Q-91: Weekly email cron", () => {
  const cronDir = path.join(APP_DIR, "api/cron/weekly-email");

  it("route.ts exists", () => {
    expect(fs.existsSync(path.join(cronDir, "route.ts"))).toBe(true);
  });

  const source = fs.readFileSync(path.join(cronDir, "route.ts"), "utf-8");

  it("verifies CRON_SECRET", () => {
    expect(source).toContain("CRON_SECRET");
    // z169: verifyCronSecret → verifyCronAuth (lib/cronAuth.ts) に refactor 済
    expect(source).toContain("verifyCronAuth");
  });

  it("checks RESEND_API_KEY", () => {
    expect(source).toContain("RESEND_API_KEY");
  });

  it("respects weekly_email opt-out preference", () => {
    expect(source).toContain("weekly_email");
    expect(source).toContain("optedOut");
  });

  it("calculates streak from training dates", () => {
    expect(source).toContain("streak");
    expect(source).toContain("sortedDates");
  });

  it("sends via Resend API directly (no SDK dependency)", () => {
    expect(source).toContain("https://api.resend.com/emails");
    expect(source).not.toContain("import { Resend }");
  });

  it("has bilingual email template (ja/en)", () => {
    expect(source).toContain("isJa");
    expect(source).toContain("今週のトレーニングサマリー");
    expect(source).toContain("Weekly Training Summary");
  });

  it("uses service role client for cross-user data", () => {
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("createServiceClient");
  });

  it("is registered in vercel.json cron", () => {
    const vercel = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../vercel.json"), "utf-8")
    );
    const cronPaths = vercel.crons.map((c: { path: string }) => c.path);
    expect(cronPaths).toContain("/api/cron/weekly-email");
  });
});

// ── Q-91: Push preferences API supports weekly_email ────────────────────────

describe("Q-91: Push preferences API weekly_email", () => {
  const prefRoute = fs.readFileSync(
    path.join(APP_DIR, "api/push/preferences/route.ts"),
    "utf-8"
  );

  it("zod schema includes weekly_email", () => {
    expect(prefRoute).toContain("weekly_email: z.boolean().optional()");
  });

  it("defaults include weekly_email: true", () => {
    expect(prefRoute).toContain("weekly_email: true");
  });
});

// ── Q-91: PushNotificationSection weekly_email toggle ───────────────────────

describe("Q-91: PushNotificationSection weekly_email", () => {
  const source = fs.readFileSync(
    path.join(COMPONENTS_DIR, "PushNotificationSection.tsx"),
    "utf-8"
  );

  it("includes weekly_email in NotifPrefs type", () => {
    expect(source).toContain("weekly_email: boolean");
  });

  it("has weekly_email channel in channels array", () => {
    expect(source).toContain('"weekly_email"');
    expect(source).toContain("pushPrefWeeklyEmail");
  });

  it("default prefs include weekly_email: true", () => {
    expect(source).toContain("weekly_email: true");
  });
});

// ── Q-92: ProGate conversion improvements ───────────────────────────────────

describe("Q-92: ProGate conversion", () => {
  const source = fs.readFileSync(
    path.join(COMPONENTS_DIR, "ProGate.tsx"),
    "utf-8"
  );

  it("displays money-back guarantee", () => {
    expect(source).toContain('t("pro.moneyBack")');
  });

  it("displays benefit highlight", () => {
    expect(source).toContain('t("pro.benefitHighlight")');
  });

  it("displays social proof", () => {
    expect(source).toContain('t("pro.socialProof")');
  });
});

// ── Q-92: PricingSection conversion improvements ────────────────────────────

describe("Q-92: PricingSection conversion", () => {
  const source = fs.readFileSync(
    path.join(COMPONENTS_DIR, "PricingSection.tsx"),
    "utf-8"
  );

  it("displays money-back guarantee", () => {
    expect(source).toContain('t("pricing.moneyBack")');
  });

  it("displays benefit highlight", () => {
    expect(source).toContain('t("pricing.benefitHighlight")');
  });

  it("has no low-contrast text-gray-400 classes", () => {
    expect(source).not.toContain("text-gray-400");
    expect(source).not.toContain("text-gray-500");
  });
});

// ── Q-92: Conversion i18n keys ──────────────────────────────────────────────

describe("Q-92: Conversion i18n keys", () => {
  const langs = ["ja", "en", "pt"] as const;
  const keys = [
    "pro.moneyBack",
    "pro.benefitHighlight",
    "pro.trialCta",
    "pricing.moneyBack",
    "pricing.benefitHighlight",
  ];

  for (const lang of langs) {
    const messages = JSON.parse(
      fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), "utf-8")
    );

    for (const dotKey of keys) {
      const [section, key] = dotKey.split(".");
      it(`${lang}.json has ${dotKey}`, () => {
        expect(messages[section]).toBeDefined();
        expect(messages[section][key]).toBeDefined();
        expect(messages[section][key].length).toBeGreaterThan(0);
      });
    }
  }
});

// ── Whitelist insert pattern — no spread into DB ────────────────────────────

describe("Whitelist insert pattern (no spread into DB)", () => {
  it("useTrainingLog uses explicit insertPayload (no spread into .insert)", () => {
    const source = fs.readFileSync(
      path.join(HOOKS_DIR, "useTrainingLog.ts"),
      "utf-8"
    );
    expect(source).toContain("insertPayload");
    // Ensure no ...form or ...editForm spread into .insert()
    const insertCalls = source.match(/\.insert\([^)]+\)/g) || [];
    for (const call of insertCalls) {
      expect(call).not.toMatch(/\.\.\./);
    }
  });

  it("useTrainingLog uses explicit updatePayload (no spread into .update)", () => {
    const source = fs.readFileSync(
      path.join(HOOKS_DIR, "useTrainingLog.ts"),
      "utf-8"
    );
    expect(source).toContain("updatePayload");
    const updateCalls = source.match(/\.update\([^)]+\)/g) || [];
    for (const call of updateCalls) {
      expect(call).not.toMatch(/\.\.\./);
    }
  });

  it("TechniqueLog uses explicit insertPayload (no spread)", () => {
    const source = fs.readFileSync(
      path.join(COMPONENTS_DIR, "TechniqueLog.tsx"),
      "utf-8"
    );
    expect(source).toContain("insertPayload");
    const insertCalls = source.match(/\.insert\([^)]+\)/g) || [];
    for (const call of insertCalls) {
      expect(call).not.toMatch(/\.\.\./);
    }
  });

  it("detect_hidden_bugs.py has SPREAD_INTO_DB rule", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../scripts/detect_hidden_bugs.py"),
      "utf-8"
    );
    expect(source).toContain("SPREAD_INTO_DB");
    expect(source).toContain("check_spread_into_db");
  });
});

// ── Weekly email i18n keys ──────────────────────────────────────────────────

describe("Weekly email i18n keys", () => {
  const langs = ["ja", "en", "pt"] as const;

  for (const lang of langs) {
    const messages = JSON.parse(
      fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), "utf-8")
    );

    it(`${lang}.json has pushPrefWeeklyEmail`, () => {
      expect(messages.profile?.pushPrefWeeklyEmail).toBeDefined();
      expect(messages.profile.pushPrefWeeklyEmail.length).toBeGreaterThan(0);
    });
  }
});
