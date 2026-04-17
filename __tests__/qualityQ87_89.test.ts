/**
 * qualityQ87_89 — tests for Q-87 through Q-89 quality improvements
 *
 * Tests:
 * - Privacy policy Data Retention table, Children's Privacy expansion, Security Incident section
 * - Notification preferences API route existence
 * - Notification preferences i18n keys
 * - Reengagement cron respects notification_preferences
 * - Weekly-goal cron respects notification_preferences
 * - Milestone messages in reengagement cron
 * - PushNotificationSection per-channel toggles
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const APP_DIR = path.resolve(__dirname, "../app");
const COMPONENTS_DIR = path.resolve(__dirname, "../components");
const MESSAGES_DIR = path.resolve(__dirname, "../messages");

// ── Q-87: Privacy Policy Legal improvements ──────────────────────────────────
describe("Q-87: Privacy Policy improvements", () => {
  const source = fs.readFileSync(
    path.join(APP_DIR, "privacy/page.tsx"),
    "utf-8"
  );

  it("has Data Retention table with per-category periods", () => {
    expect(source).toContain("<table");
    expect(source).toContain("Training logs");
    expect(source).toContain("Payment records");
    expect(source).toContain("Push notification tokens");
    expect(source).toContain("Analytics");
  });

  it("has expanded Children's Privacy with COPPA and GDPR age thresholds", () => {
    expect(source).toContain("under 13");
    expect(source).toContain("under 16");
    expect(source).toContain("COPPA");
    expect(source).toContain("GDPR");
    expect(source).toContain("48 hours");
  });

  it("has Security Incident Notification section", () => {
    expect(source).toContain("security-incident");
    expect(source).toContain("Security Incident Notification");
    expect(source).toContain("72 hours");
    expect(source).toContain("GDPR Article 33");
  });

  it("has at least 13 sections in TOC", () => {
    const tocMatches = source.match(/{ id: "/g);
    expect(tocMatches).not.toBeNull();
    expect(tocMatches!.length).toBeGreaterThanOrEqual(13);
  });
});

// ── Q-88: Notification preferences API ────────────────────────────────────────
describe("Q-88: Notification preferences API", () => {
  it("preferences API route exists", () => {
    const routePath = path.join(APP_DIR, "api/push/preferences/route.ts");
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("preferences route has GET and PATCH handlers", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "api/push/preferences/route.ts"),
      "utf-8"
    );
    expect(source).toContain("export async function GET");
    expect(source).toContain("export async function PATCH");
  });

  it("preferences route validates with zod", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "api/push/preferences/route.ts"),
      "utf-8"
    );
    expect(source).toContain("z.object");
    expect(source).toContain("reengagement");
    expect(source).toContain("weekly_goal");
    expect(source).toContain("milestone");
  });

  it("preferences route has rate limiting", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "api/push/preferences/route.ts"),
      "utf-8"
    );
    expect(source).toContain("createRateLimiter");
  });
});

// ── Q-88: Cron jobs respect notification_preferences ─────────────────────────
describe("Q-88: Cron notification_preferences", () => {
  it("reengagement cron selects notification_preferences", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "api/cron/reengagement/route.ts"),
      "utf-8"
    );
    expect(source).toContain("notification_preferences");
    expect(source).toContain("reengagement === false");
  });

  it("weekly-goal cron filters by notification_preferences", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "api/cron/weekly-goal/route.ts"),
      "utf-8"
    );
    expect(source).toContain("notification_preferences");
    expect(source).toContain("weekly_goal !== false");
  });

  it("reengagement cron has milestone celebration", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "api/cron/reengagement/route.ts"),
      "utf-8"
    );
    expect(source).toContain("MILESTONES");
    expect(source).toContain("MILESTONE_MESSAGES");
    expect(source).toContain("50セッション達成");
    expect(source).toContain("100セッション達成");
    expect(source).toContain("milestoneSent");
  });
});

// ── Q-88: PushNotificationSection per-channel toggles ────────────────────────
describe("Q-88: PushNotificationSection", () => {
  const source = fs.readFileSync(
    path.join(COMPONENTS_DIR, "PushNotificationSection.tsx"),
    "utf-8"
  );

  it("has per-channel toggle structure", () => {
    expect(source).toContain("pushPrefReengagement");
    expect(source).toContain("pushPrefWeeklyGoal");
    expect(source).toContain("pushPrefMilestone");
  });

  it("fetches preferences from API", () => {
    expect(source).toContain("/api/push/preferences");
    expect(source).toContain("PATCH");
  });

  it("has preference title section", () => {
    expect(source).toContain("pushPrefTitle");
  });
});

// ── Q-88: Notification preferences i18n ──────────────────────────────────────
describe("Q-88: Notification preferences i18n", () => {
  for (const lang of ["en", "ja", "pt"]) {
    it(`${lang}.json has notification preference keys`, () => {
      const data = JSON.parse(
        fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), "utf-8")
      );
      expect(data.profile.pushPrefTitle).toBeDefined();
      expect(data.profile.pushPrefReengagement).toBeDefined();
      expect(data.profile.pushPrefWeeklyGoal).toBeDefined();
      expect(data.profile.pushPrefMilestone).toBeDefined();
    });
  }
});
