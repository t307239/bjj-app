/**
 * reengagement — unit tests for cron/reengagement logic
 *
 * Tests the re-engagement notification selection logic:
 * - Message rotation by day-of-year
 * - Inactive user filtering (3+ days)
 * - Days-since-training calculation
 */
import { describe, it, expect } from "vitest";

// ── Re-implement the rotation + filtering logic from route.ts ────────────────

const MESSAGES = [
  { title: "🥋 マットが呼んでいます", body: "最後の練習から{days}日。今日少しだけでもロールしませんか？" },
  { title: "💪 練習再開しよう", body: "{days}日ぶりのセッション、最高の気分になれますよ" },
  { title: "🔥 ストリークを取り戻そう", body: "練習を記録して、成長の軌跡を途切れさせないで" },
  { title: "🤙 Oss! 練習の時間です", body: "短いドリルでもOK。マットに立つことが大事" },
  { title: "📈 継続は力なり", body: "{days}日空いちゃったけど、今日から再スタート！" },
];

const INACTIVE_DAYS_THRESHOLD = 3;

function pickMessage(now: Date) {
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return MESSAGES[dayOfYear % MESSAGES.length];
}

function isInactive(lastTrained: string | null, now: Date): boolean {
  if (!lastTrained) return true;
  const lastDate = new Date(lastTrained);
  const thresholdMs = INACTIVE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000;
  return now.getTime() - lastDate.getTime() >= thresholdMs;
}

function calcDaysSince(lastTrained: string | null, now: Date): number {
  if (!lastTrained) return 7;
  return Math.floor((now.getTime() - new Date(lastTrained).getTime()) / 86400000);
}

function formatBody(template: string, days: number): string {
  return template.replace("{days}", String(days));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("reengagement message rotation", () => {
  it("returns a valid message object", () => {
    const msg = pickMessage(new Date("2026-01-15T12:00:00Z"));
    expect(msg).toHaveProperty("title");
    expect(msg).toHaveProperty("body");
  });

  it("rotates messages across consecutive days", () => {
    const msgs = Array.from({ length: 7 }, (_, i) => {
      const d = new Date("2026-01-01T12:00:00Z");
      d.setDate(d.getDate() + i);
      return pickMessage(d).title;
    });
    // Should have at least 2 different messages across 7 days
    const unique = new Set(msgs);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it("cycles through all 5 messages", () => {
    const titles = new Set<string>();
    for (let i = 0; i < 365; i++) {
      const d = new Date("2026-01-01T12:00:00Z");
      d.setDate(d.getDate() + i);
      titles.add(pickMessage(d).title);
    }
    expect(titles.size).toBe(5);
  });

  it("replaces {days} placeholder", () => {
    const body = formatBody("最後の練習から{days}日。", 5);
    expect(body).toBe("最後の練習から5日。");
  });

  it("handles body without placeholder", () => {
    const body = formatBody("練習を記録して、成長の軌跡を途切れさせないで", 3);
    expect(body).toBe("練習を記録して、成長の軌跡を途切れさせないで");
  });
});

describe("inactive user detection", () => {
  const now = new Date("2026-04-16T12:00:00Z");

  it("marks null last_trained as inactive", () => {
    expect(isInactive(null, now)).toBe(true);
  });

  it("marks 3 days ago as inactive", () => {
    expect(isInactive("2026-04-13", now)).toBe(true);
  });

  it("marks 5 days ago as inactive", () => {
    expect(isInactive("2026-04-11", now)).toBe(true);
  });

  it("marks today as active", () => {
    expect(isInactive("2026-04-16", now)).toBe(false);
  });

  it("marks yesterday as active", () => {
    expect(isInactive("2026-04-15", now)).toBe(false);
  });

  it("marks 2 days ago as active (threshold is 3)", () => {
    expect(isInactive("2026-04-14", now)).toBe(false);
  });
});

describe("days since training calculation", () => {
  const now = new Date("2026-04-16T12:00:00Z");

  it("returns 7 for null (never trained)", () => {
    expect(calcDaysSince(null, now)).toBe(7);
  });

  it("returns correct days for recent training", () => {
    expect(calcDaysSince("2026-04-13", now)).toBe(3);
  });

  it("returns 0 for same-day training", () => {
    expect(calcDaysSince("2026-04-16", now)).toBe(0);
  });

  it("handles long gaps", () => {
    expect(calcDaysSince("2026-03-16", now)).toBe(31);
  });
});
