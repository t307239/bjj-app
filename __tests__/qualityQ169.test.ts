/**
 * Tests for Q-169: billingAnalyzer (Cost 93→94)
 */
import { describe, it, expect } from "vitest";

describe("Q-169: billingAnalyzer", () => {
  it("TIER_PRICES and BILLING_THRESHOLDS", async () => {
    const m = await import("@/lib/billingAnalyzer");

    expect(m.TIER_PRICES.free.monthly).toBe(0);
    expect(m.TIER_PRICES.pro_monthly.monthly).toBe(999);
    expect(m.TIER_PRICES.pro_annual.monthly).toBe(667);
    expect(m.BILLING_THRESHOLDS.highChurnRate).toBe(5);
  });

  it("toMonthlyCents", async () => {
    const m = await import("@/lib/billingAnalyzer");

    expect(m.toMonthlyCents({ userId: "u1", tier: "free", pricePerInterval: 0, interval: "month", startDate: "2026-01-01", status: "active" })).toBe(0);
    expect(m.toMonthlyCents({ userId: "u1", tier: "pro_monthly", pricePerInterval: 999, interval: "month", startDate: "2026-01-01", status: "active" })).toBe(999);
    expect(m.toMonthlyCents({ userId: "u1", tier: "pro_annual", pricePerInterval: 7999, interval: "year", startDate: "2026-01-01", status: "active" })).toBe(667);
  });

  it("calculateMRR: basic", async () => {
    const m = await import("@/lib/billingAnalyzer");

    const subs = [
      { userId: "u1", tier: "pro_monthly" as const, pricePerInterval: 999, interval: "month" as const, startDate: "2026-01-01", status: "active" as const },
      { userId: "u2", tier: "pro_annual" as const, pricePerInterval: 7999, interval: "year" as const, startDate: "2026-01-01", status: "active" as const },
      { userId: "u3", tier: "free" as const, pricePerInterval: 0, interval: "month" as const, startDate: "2026-01-01", status: "active" as const },
    ];

    const mrr = m.calculateMRR(subs);
    expect(mrr.total).toBe(999 + 667);
    expect(mrr.subscriberCount).toBe(2);
    expect(mrr.arr).toBe(mrr.total * 12);
    expect(mrr.arpu).toBe(Math.round(mrr.total / 2));
  });

  it("calculateMRR: with period tracking", async () => {
    const m = await import("@/lib/billingAnalyzer");

    const subs = [
      { userId: "u1", tier: "pro_monthly" as const, pricePerInterval: 999, interval: "month" as const, startDate: "2026-04-01", status: "active" as const },
      { userId: "u2", tier: "pro_monthly" as const, pricePerInterval: 999, interval: "month" as const, startDate: "2026-03-01", status: "canceled" as const, cancelDate: "2026-04-10" },
    ];

    const mrr = m.calculateMRR(subs, "2026-04-01");
    expect(mrr.newMRR).toBe(999);
    expect(mrr.churnedMRR).toBe(999);
  });

  it("calculateMRR: empty", async () => {
    const m = await import("@/lib/billingAnalyzer");
    const mrr = m.calculateMRR([]);
    expect(mrr.total).toBe(0);
    expect(mrr.subscriberCount).toBe(0);
    expect(mrr.arpu).toBe(0);
  });

  it("calculateRevenue", async () => {
    const m = await import("@/lib/billingAnalyzer");

    const subs = [
      { userId: "u1", tier: "pro_monthly" as const, pricePerInterval: 999, interval: "month" as const, startDate: "2026-01-01", status: "active" as const },
    ];

    const rev = m.calculateRevenue(subs, 100);
    expect(rev.grossRevenue).toBeGreaterThan(0);
    expect(rev.conversionRate).toBe(1);
    expect(rev.avgLTV).toBeGreaterThan(0);
  });

  it("calculateChurnRate", async () => {
    const m = await import("@/lib/billingAnalyzer");

    const subs = [
      { userId: "u1", tier: "pro_monthly" as const, pricePerInterval: 999, interval: "month" as const, startDate: "2026-01-01", status: "active" as const },
      { userId: "u2", tier: "pro_monthly" as const, pricePerInterval: 999, interval: "month" as const, startDate: "2026-01-01", status: "canceled" as const, cancelDate: "2026-04-10" },
    ];

    const rate = m.calculateChurnRate(subs, "2026-04-01");
    expect(rate).toBe(50);

    // No subs
    expect(m.calculateChurnRate([], "2026-04-01")).toBe(0);
  });

  it("analyzeBillingHealth: healthy", async () => {
    const m = await import("@/lib/billingAnalyzer");

    const subs = [
      { userId: "u1", tier: "pro_monthly" as const, pricePerInterval: 999, interval: "month" as const, startDate: "2026-01-01", status: "active" as const },
      { userId: "u2", tier: "pro_annual" as const, pricePerInterval: 7999, interval: "year" as const, startDate: "2026-01-01", status: "active" as const },
    ];

    const health = m.analyzeBillingHealth(subs, 10);
    expect(health.status).toBe("healthy");
    expect(health.mrr.total).toBeGreaterThan(0);
    expect(health.revenue.conversionRate).toBe(20);
  });

  it("analyzeBillingHealth: with issues", async () => {
    const m = await import("@/lib/billingAnalyzer");

    const subs = [
      { userId: "u1", tier: "pro_monthly" as const, pricePerInterval: 999, interval: "month" as const, startDate: "2026-01-01", status: "past_due" as const },
      { userId: "u2", tier: "pro_monthly" as const, pricePerInterval: 999, interval: "month" as const, startDate: "2026-01-01", status: "trialing" as const },
    ];

    const health = m.analyzeBillingHealth(subs, 100);
    expect(health.issues.length).toBeGreaterThan(0);
    expect(health.issues.some((i) => i.type === "trial_expiring")).toBe(true);
  });

  it("formatBillingHealth", async () => {
    const m = await import("@/lib/billingAnalyzer");
    const health = m.analyzeBillingHealth([], 0);
    const formatted = m.formatBillingHealth(health);
    expect(formatted).toContain("Billing Health");
    expect(formatted).toContain("MRR");
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("calculateMRR");
    expect(idx).toContain("analyzeBillingHealth");
    expect(idx).toContain("TIER_PRICES");
  });
});
