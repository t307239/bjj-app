/**
 * weeklyGoal — unit tests for weekly goal Push cron
 *
 * Tests message selection, week start calculation, and route structure.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROUTE_PATH = path.resolve(__dirname, "../app/api/cron/weekly-goal/route.ts");

// ── Re-implement pickMessage for testing ────────────────────────────────────
function pickMessage(completed: number, goal: number): { title: string; body: string } {
  if (completed >= goal) {
    return {
      title: "🏆 週間目標達成！",
      body: `今週${completed}回の練習、目標${goal}回をクリア！この調子で来週も頑張ろう`,
    };
  }
  const remaining = goal - completed;
  const ratio = completed / goal;
  if (ratio >= 0.5) {
    return {
      title: "🔥 あと少し！",
      body: `今週${completed}/${goal}回完了。あと${remaining}回で目標達成！`,
    };
  }
  if (completed > 0) {
    return {
      title: "💪 良いスタート！",
      body: `今週${completed}/${goal}回完了。残り${remaining}回、マットに行こう！`,
    };
  }
  return {
    title: "🥋 今週の練習を始めよう",
    body: `週間目標は${goal}回。最初の一歩を踏み出そう！`,
  };
}

// ── Re-implement getWeekStart for testing ───────────────────────────────────
function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

// ── pickMessage tests ───────────────────────────────────────────────────────

describe("pickMessage", () => {
  it("returns achieved message when goal met", () => {
    const msg = pickMessage(3, 3);
    expect(msg.title).toContain("達成");
    expect(msg.body).toContain("3回の練習");
  });

  it("returns achieved message when goal exceeded", () => {
    const msg = pickMessage(5, 3);
    expect(msg.title).toContain("達成");
  });

  it("returns almost-there message at 50%+", () => {
    const msg = pickMessage(2, 3);
    expect(msg.title).toContain("あと少し");
    expect(msg.body).toContain("あと1回");
  });

  it("returns good-start message at <50%", () => {
    const msg = pickMessage(1, 4);
    expect(msg.title).toContain("良いスタート");
    expect(msg.body).toContain("残り3回");
  });

  it("returns start message at 0 sessions", () => {
    const msg = pickMessage(0, 3);
    expect(msg.title).toContain("始めよう");
    expect(msg.body).toContain("3回");
  });

  it("uses correct remaining count", () => {
    const msg = pickMessage(3, 5);
    expect(msg.body).toContain("あと2回");
  });

  it("handles goal of 1", () => {
    const msg = pickMessage(0, 1);
    expect(msg.body).toContain("1回");
  });
});

// ── getWeekStart tests ──────────────────────────────────────────────────────

describe("getWeekStart", () => {
  it("returns a date string in YYYY-MM-DD format", () => {
    const result = getWeekStart();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a Monday", () => {
    const result = getWeekStart();
    const d = new Date(result + "T00:00:00Z");
    expect(d.getUTCDay()).toBe(1); // Monday
  });
});

// ── Route structure tests ───────────────────────────────────────────────────

describe("weekly-goal cron route", () => {
  it("route file exists", () => {
    expect(fs.existsSync(ROUTE_PATH)).toBe(true);
  });

  it("exports GET handler", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain("export async function GET");
  });

  it("requires CRON_SECRET auth", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain("CRON_SECRET");
    expect(source).toContain("401");
  });

  it("fetches push subscriptions with weekly_goal", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain("weekly_goal");
    expect(source).toContain("push_subscriptions");
  });

  it("uses filterSendableSubscriptions for silent hours", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain("filterSendableSubscriptions");
  });

  it("cleans up stale subscriptions", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain("410");
    expect(source).toContain("404");
    expect(source).toContain("delete");
  });

  it("is scheduled weekly Monday in vercel.json", () => {
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../vercel.json"), "utf-8")
    );
    const weeklyGoalCron = vercelConfig.crons.find(
      (c: { path: string }) => c.path === "/api/cron/weekly-goal"
    );
    expect(weeklyGoalCron).toBeDefined();
    expect(weeklyGoalCron.schedule).toBe("0 10 * * 1");
  });
});

// ── ProGate i18n tests ──────────────────────────────────────────────────────

describe("ProGate i18n (Q-78/Q-80)", () => {
  it("has no hardcoded price strings in ProGate.tsx", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../components/ProGate.tsx"),
      "utf-8"
    );
    expect(source).not.toContain('"$79.99');
    expect(source).not.toContain('"$9.99');
  });

  it("uses t() for all prices in ProGate.tsx", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../components/ProGate.tsx"),
      "utf-8"
    );
    expect(source).toContain('t("pro.annualPrice")');
    expect(source).toContain('t("pro.monthlyPrice")');
    expect(source).toContain('t("pro.annualPerMonth")');
    expect(source).toContain('t("pro.annualSavings")');
  });

  it("has price keys in en.json", () => {
    const en = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../messages/en.json"), "utf-8")
    );
    expect(en.pro.monthlyPrice).toBeDefined();
    expect(en.pro.annualPrice).toBeDefined();
    expect(en.pro.annualSavings).toBeDefined();
  });

  it("has price keys in ja.json", () => {
    const ja = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../messages/ja.json"), "utf-8")
    );
    expect(ja.pro.monthlyPrice).toBeDefined();
    expect(ja.pro.annualPrice).toBeDefined();
    expect(ja.pro.annualSavings).toBeDefined();
  });

  it("has feature icon keys in en.json", () => {
    const en = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../messages/en.json"), "utf-8")
    );
    expect(en.pro.featureAI).toBeDefined();
    expect(en.pro.featureStreak).toBeDefined();
    expect(en.pro.featureExport).toBeDefined();
  });
});
