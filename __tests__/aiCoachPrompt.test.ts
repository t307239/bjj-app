/**
 * Unit tests: AI Coach prompt construction + rate-limit contract (Q-55)
 *
 * The AI Coach route (app/api/ai-coach/generate/route.ts) builds
 * locale-aware prompts from CoachStats. These tests pin the invariants
 * that drive response quality:
 *   - Belt label includes stripe count
 *   - Locale instruction is embedded when non-empty
 *   - Weekly average is formatted to 1 decimal
 *   - Totals from the stats block are reflected verbatim in the prompt
 *
 * Run:  npx vitest run __tests__/aiCoachPrompt.test.ts
 */

import { describe, it, expect } from "vitest";

// ── Helpers mirroring ai-coach/generate/route.ts ─────────────────────────────

type CoachStats = {
  belt: string;
  stripes: number;
  locale: string;
  totalSessions: number;
  weeklyAvg: number;
  giSessions: number;
  nogiSessions: number;
  drillingSessions: number;
  competitionSessions: number;
  recoverySessions: number;
  openMatSessions: number;
  streakDays: number;
};

const LOCALE_INSTRUCTIONS: Record<string, string> = {
  ja: "Respond in Japanese.",
  pt: "Respond in Brazilian Portuguese.",
  en: "",
};

function beltLabel(belt: string, stripes: number): string {
  if (stripes <= 0) return `${belt} belt`;
  const plural = stripes > 1 ? "s" : "";
  return `${belt} belt (${stripes} stripe${plural})`;
}

function buildGeneralPrompt(stats: CoachStats): string {
  const label = beltLabel(stats.belt, stats.stripes);
  const loc = LOCALE_INSTRUCTIONS[stats.locale] ?? "";
  const header = `You are a concise, encouraging BJJ coach. Analyze this student's training data and give them personalized coaching.${loc ? ` ${loc}` : ""}`;
  return `${header}

Student: ${label}
Last 30 days of training:
- Total sessions: ${stats.totalSessions}
- Weekly average: ${stats.weeklyAvg.toFixed(1)} sessions/week
- Gi sessions: ${stats.giSessions}
- No-Gi sessions: ${stats.nogiSessions}
- Drilling sessions: ${stats.drillingSessions}
- Competition sessions: ${stats.competitionSessions}
- Recovery/open mat: ${stats.recoverySessions + stats.openMatSessions}
- Current streak: ${stats.streakDays} days`;
}

/** Rate limiter: max 10 AI requests per IP per hour. */
function makeAIRateLimiter(max = 10, windowMs = 60 * 60 * 1000) {
  const map = new Map<string, { count: number; resetAt: number }>();
  return (ip: string, now = Date.now()): boolean => {
    const e = map.get(ip);
    if (!e || now > e.resetAt) {
      map.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    e.count++;
    return e.count <= max;
  };
}

const baseStats: CoachStats = {
  belt: "blue",
  stripes: 2,
  locale: "en",
  totalSessions: 16,
  weeklyAvg: 4.0,
  giSessions: 10,
  nogiSessions: 4,
  drillingSessions: 2,
  competitionSessions: 0,
  recoverySessions: 1,
  openMatSessions: 1,
  streakDays: 7,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("beltLabel", () => {
  it("renders belt with no stripes when stripes=0", () => {
    expect(beltLabel("white", 0)).toBe("white belt");
  });

  it("renders singular 'stripe' for exactly 1", () => {
    expect(beltLabel("blue", 1)).toBe("blue belt (1 stripe)");
  });

  it("renders plural 'stripes' for 2+", () => {
    expect(beltLabel("purple", 3)).toBe("purple belt (3 stripes)");
  });

  it("treats negative stripes as 0 (defensive)", () => {
    expect(beltLabel("brown", -1)).toBe("brown belt");
  });
});

describe("buildGeneralPrompt", () => {
  it("includes belt label with stripes", () => {
    const p = buildGeneralPrompt(baseStats);
    expect(p).toContain("Student: blue belt (2 stripes)");
  });

  it("omits extra locale instruction for en locale", () => {
    const p = buildGeneralPrompt({ ...baseStats, locale: "en" });
    // en has empty instruction; header should not gain trailing " "
    expect(p).toContain("personalized coaching.\n\nStudent:");
  });

  it("embeds Japanese locale instruction when locale=ja", () => {
    const p = buildGeneralPrompt({ ...baseStats, locale: "ja" });
    expect(p).toContain("Respond in Japanese.");
  });

  it("embeds Portuguese locale instruction when locale=pt", () => {
    const p = buildGeneralPrompt({ ...baseStats, locale: "pt" });
    expect(p).toContain("Respond in Brazilian Portuguese.");
  });

  it("silently ignores unknown locales (fall back to English only)", () => {
    const p = buildGeneralPrompt({ ...baseStats, locale: "xx" });
    expect(p).not.toContain("undefined");
    expect(p).not.toContain("Respond in");
  });

  it("reflects every stat in the prompt body verbatim", () => {
    const p = buildGeneralPrompt(baseStats);
    expect(p).toContain("Total sessions: 16");
    expect(p).toContain("Weekly average: 4.0 sessions/week");
    expect(p).toContain("Gi sessions: 10");
    expect(p).toContain("No-Gi sessions: 4");
    expect(p).toContain("Drilling sessions: 2");
    expect(p).toContain("Competition sessions: 0");
    expect(p).toContain("Recovery/open mat: 2"); // 1 + 1
    expect(p).toContain("Current streak: 7 days");
  });

  it("formats weekly average to exactly 1 decimal place", () => {
    const p = buildGeneralPrompt({ ...baseStats, weeklyAvg: 3 });
    expect(p).toContain("Weekly average: 3.0 sessions/week");
    const p2 = buildGeneralPrompt({ ...baseStats, weeklyAvg: 2.666 });
    expect(p2).toContain("Weekly average: 2.7 sessions/week");
  });

  it("does not leak undefined into the prompt when stats are zero", () => {
    const zeroStats: CoachStats = { ...baseStats, totalSessions: 0, weeklyAvg: 0, streakDays: 0 };
    const p = buildGeneralPrompt(zeroStats);
    expect(p).not.toContain("undefined");
    expect(p).not.toContain("NaN");
  });
});

describe("AI rate limiter (cost-containment)", () => {
  it("allows up to 3 requests within the window for the test config", () => {
    const check = makeAIRateLimiter(3, 60_000);
    expect(check("1.1.1.1")).toBe(true);
    expect(check("1.1.1.1")).toBe(true);
    expect(check("1.1.1.1")).toBe(true);
    expect(check("1.1.1.1")).toBe(false); // 4th blocked
  });

  it("isolates counters per IP (no cross-user leakage)", () => {
    const check = makeAIRateLimiter(2, 60_000);
    check("a"); check("a");
    expect(check("a")).toBe(false);
    expect(check("b")).toBe(true);
  });

  it("resets after the window to avoid permanent lockout", () => {
    const check = makeAIRateLimiter(1, 1000);
    expect(check("x", 0)).toBe(true);
    expect(check("x", 500)).toBe(false);
    expect(check("x", 1500)).toBe(true);
  });
});
