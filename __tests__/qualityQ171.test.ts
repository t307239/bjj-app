/**
 * Tests for Q-171: pricingOptimizer (Conversion 93→94)
 */
import { describe, it, expect } from "vitest";

describe("Q-171: pricingOptimizer", () => {
  it("PRICING_PSYCHOLOGY and CURRENT_PRICING", async () => {
    const m = await import("@/lib/pricingOptimizer");

    expect(m.PRICING_PSYCHOLOGY.annualDiscountRange.min).toBe(15);
    expect(m.PRICING_PSYCHOLOGY.annualDiscountRange.max).toBe(33);
    expect(m.CURRENT_PRICING.pro_monthly.monthly).toBe(999);
    expect(m.CURRENT_PRICING.pro_annual.annual).toBe(7999);
  });

  it("analyzePriceSensitivity: insufficient data", async () => {
    const m = await import("@/lib/pricingOptimizer");

    const result = m.analyzePriceSensitivity([{ price: 999, conversions: 10, visitors: 100 }], 999);
    expect(result.confidence).toBe("low");
    expect(result.elasticity).toBe(0);
  });

  it("analyzePriceSensitivity: multiple price points", async () => {
    const m = await import("@/lib/pricingOptimizer");

    const points = [
      { price: 499, conversions: 50, visitors: 200 },
      { price: 999, conversions: 30, visitors: 200 },
      { price: 1499, conversions: 10, visitors: 200 },
    ];

    const result = m.analyzePriceSensitivity(points, 999);
    expect(result.elasticity).toBeLessThan(0); // negative = demand falls with price
    expect(result.optimalRevenue).toBeGreaterThan(0);
    expect(result.confidence).toBe("medium");
  });

  it("compareTiers", async () => {
    const m = await import("@/lib/pricingOptimizer");

    const tiers = [
      { name: "Free", monthlyPrice: 0, features: ["log", "chart"] },
      { name: "Pro", monthlyPrice: 999, features: ["log", "chart", "export", "ai", "push"] },
      { name: "Team", monthlyPrice: 2999, features: ["log", "chart", "export", "ai", "push", "admin", "api", "sso"] },
    ];

    const comparison = m.compareTiers(tiers);
    expect(comparison.length).toBe(3);
    expect(comparison[0].positioning).toBe("entry");
    expect(comparison[1].positioning).toBe("popular");
    expect(comparison[2].positioning).toBe("premium");
    expect(comparison[0].valueScore).toBe(999); // Free = max value
  });

  it("modelDiscount: small discount", async () => {
    const m = await import("@/lib/pricingOptimizer");

    const result = m.modelDiscount({
      originalPrice: 999,
      discountPercent: 10,
      currentConversions: 100,
      currentVisitors: 1000,
    });

    expect(result.discountedPrice).toBe(899);
    expect(result.breakEvenIncrease).toBeGreaterThan(0);
    expect(result.recommendation).toBe("recommended");
    expect(result.revenueScenarios.length).toBe(5);
  });

  it("modelDiscount: deep discount", async () => {
    const m = await import("@/lib/pricingOptimizer");

    const result = m.modelDiscount({
      originalPrice: 999,
      discountPercent: 50,
      currentConversions: 100,
      currentVisitors: 1000,
    });

    expect(result.discountedPrice).toBe(500);
    expect(result.recommendation).toBe("not_recommended");
    expect(result.breakEvenIncrease).toBeGreaterThan(50);
  });

  it("calculateAnnualSavings", async () => {
    const m = await import("@/lib/pricingOptimizer");

    const savings = m.calculateAnnualSavings(999, 7999);
    expect(savings.savingsAmount).toBe(999 * 12 - 7999);
    expect(savings.savingsPercent).toBeGreaterThan(0);
    expect(savings.monthlyEquivalent).toBe(667);
  });

  it("applyCharmPricing", async () => {
    const m = await import("@/lib/pricingOptimizer");

    expect(m.applyCharmPricing(1000)).toBe(999);
    expect(m.applyCharmPricing(2000)).toBe(1999);
    expect(m.applyCharmPricing(50)).toBe(50); // Don't charm sub-$1
  });

  it("generateRecommendations: low conversion", async () => {
    const m = await import("@/lib/pricingOptimizer");

    const recs = m.generateRecommendations({
      monthlyPrice: 999,
      annualPrice: 7999,
      conversionRate: 1,
      churnRate: 3,
      competitorAvgPrice: 999,
    });

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some((r) => r.type === "price_decrease")).toBe(true);
  });

  it("generateRecommendations: high churn", async () => {
    const m = await import("@/lib/pricingOptimizer");

    const recs = m.generateRecommendations({
      monthlyPrice: 999,
      annualPrice: 7999,
      conversionRate: 5,
      churnRate: 12,
      competitorAvgPrice: 999,
    });

    expect(recs.some((r) => r.type === "add_tier")).toBe(true);
  });

  it("generateRecommendations: underpriced", async () => {
    const m = await import("@/lib/pricingOptimizer");

    const recs = m.generateRecommendations({
      monthlyPrice: 499,
      annualPrice: 3999,
      conversionRate: 8,
      churnRate: 3,
      competitorAvgPrice: 1999,
    });

    expect(recs.some((r) => r.type === "price_increase")).toBe(true);
  });

  it("formatPricingAnalysis", async () => {
    const m = await import("@/lib/pricingOptimizer");

    const sensitivity = m.analyzePriceSensitivity([
      { price: 999, conversions: 20, visitors: 100 },
      { price: 1499, conversions: 10, visitors: 100 },
    ], 999);
    const recs = m.generateRecommendations({
      monthlyPrice: 999, annualPrice: 7999, conversionRate: 5, churnRate: 3, competitorAvgPrice: 999,
    });

    const formatted = m.formatPricingAnalysis(sensitivity, recs);
    expect(formatted).toContain("Pricing Analysis");
    expect(formatted).toContain("Elasticity");
    expect(formatted).toContain("Recommendations");
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("analyzePriceSensitivity");
    expect(idx).toContain("modelDiscount");
    expect(idx).toContain("PRICING_PSYCHOLOGY");
  });
});
