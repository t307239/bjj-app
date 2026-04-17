/**
 * lib/pricingOptimizer.ts — Pricing optimization & analysis
 *
 * Q-171: Conversion pillar 93→94 — Price sensitivity analysis,
 * tier comparison, discount impact modeling, and pricing
 * recommendations.
 *
 * @example
 *   import { analyzePriceSensitivity, modelDiscount } from "@/lib/pricingOptimizer";
 *
 *   const sensitivity = analyzePriceSensitivity(conversionData);
 *   const discount = modelDiscount({ originalPrice: 999, discountPercent: 20, ... });
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface PricePoint {
  /** Price in cents */
  price: number;
  /** Number of conversions at this price */
  conversions: number;
  /** Number of visitors who saw this price */
  visitors: number;
}

export interface PriceSensitivity {
  /** Price elasticity estimate (-1 = unit elastic) */
  elasticity: number;
  /** Optimal price point for maximum revenue (cents) */
  optimalPrice: number;
  /** Expected revenue at optimal price (cents) */
  optimalRevenue: number;
  /** Current revenue (cents) */
  currentRevenue: number;
  /** Revenue uplift potential (%) */
  upliftPercent: number;
  /** Confidence level */
  confidence: "high" | "medium" | "low";
}

export interface TierComparison {
  /** Tier name */
  tier: string;
  /** Monthly price in cents */
  monthlyPrice: number;
  /** Feature count */
  featureCount: number;
  /** Value score (features per dollar) */
  valueScore: number;
  /** Recommended positioning */
  positioning: "entry" | "popular" | "premium";
}

export interface DiscountModel {
  /** Original price in cents */
  originalPrice: number;
  /** Discount percentage (0-100) */
  discountPercent: number;
  /** Discounted price in cents */
  discountedPrice: number;
  /** Break-even conversion increase needed (%) */
  breakEvenIncrease: number;
  /** Estimated revenue impact at various conversion lifts */
  revenueScenarios: { conversionLift: number; revenueChange: number }[];
  /** Recommendation */
  recommendation: "recommended" | "neutral" | "not_recommended";
  /** Reasoning */
  reasoning: string;
}

export interface PricingRecommendation {
  /** Recommendation type */
  type: "price_increase" | "price_decrease" | "add_tier" | "remove_tier" | "discount" | "annual_push";
  /** Confidence */
  confidence: "high" | "medium" | "low";
  /** Description */
  description: string;
  /** Estimated impact on MRR (cents, can be negative) */
  estimatedMRRImpact: number;
}

// ── Constants ──────────────────────────────────────────────────────────

/** Standard SaaS pricing psychology anchors */
export const PRICING_PSYCHOLOGY = {
  /** Annual discount sweet spot */
  annualDiscountRange: { min: 15, max: 33 },
  /** Charm pricing (prices ending in 9) increases conversion */
  charmPricingEnabled: true,
  /** Price anchoring: show higher price first */
  anchorHighFirst: true,
  /** Three-tier pricing maximizes middle tier selection */
  threeTetiersOptimal: true,
  /** Free trial length sweet spot (days) */
  trialDays: { min: 7, max: 14 },
} as const;

/** BJJ App current pricing structure */
export const CURRENT_PRICING = {
  free: { monthly: 0, annual: 0, features: 5 },
  pro_monthly: { monthly: 999, annual: 0, features: 15 },
  pro_annual: { monthly: 667, annual: 7999, features: 15 },
} as const;

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Analyze price sensitivity from conversion data at different price points.
 *
 * @param pricePoints - Array of price/conversion data
 * @param currentPrice - Current price in cents
 * @returns Price sensitivity analysis
 */
export function analyzePriceSensitivity(
  pricePoints: PricePoint[],
  currentPrice: number
): PriceSensitivity {
  if (pricePoints.length < 2) {
    return {
      elasticity: 0,
      optimalPrice: currentPrice,
      optimalRevenue: 0,
      currentRevenue: 0,
      upliftPercent: 0,
      confidence: "low",
    };
  }

  // Calculate conversion rates and revenue at each point
  const analyzed = pricePoints.map((pp) => ({
    price: pp.price,
    conversionRate: pp.visitors > 0 ? pp.conversions / pp.visitors : 0,
    revenue: pp.price * pp.conversions,
  }));

  // Find optimal price (max revenue)
  let bestRevenue = 0;
  let bestPrice = currentPrice;
  for (const a of analyzed) {
    if (a.revenue > bestRevenue) {
      bestRevenue = a.revenue;
      bestPrice = a.price;
    }
  }

  // Calculate current revenue
  const currentData = analyzed.find((a) => a.price === currentPrice);
  const currentRevenue = currentData ? currentData.revenue : 0;

  // Estimate price elasticity (% change in demand / % change in price)
  let elasticity = 0;
  if (analyzed.length >= 2) {
    const sorted = [...analyzed].sort((a, b) => a.price - b.price);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first.price !== last.price && first.conversionRate !== 0) {
      const pctDemandChange = (last.conversionRate - first.conversionRate) / first.conversionRate;
      const pctPriceChange = (last.price - first.price) / first.price;
      elasticity = pctPriceChange !== 0
        ? Math.round((pctDemandChange / pctPriceChange) * 100) / 100
        : 0;
    }
  }

  const upliftPercent = currentRevenue > 0
    ? Math.round(((bestRevenue - currentRevenue) / currentRevenue) * 100 * 10) / 10
    : 0;

  const confidence: "high" | "medium" | "low" =
    pricePoints.length >= 5 && pricePoints.every((p) => p.visitors >= 100) ? "high" :
    pricePoints.length >= 3 ? "medium" : "low";

  return {
    elasticity,
    optimalPrice: bestPrice,
    optimalRevenue: bestRevenue,
    currentRevenue,
    upliftPercent,
    confidence,
  };
}

/**
 * Compare pricing tiers for value positioning.
 *
 * @param tiers - Array of tier data
 * @returns Tier comparisons with value scores
 */
export function compareTiers(
  tiers: { name: string; monthlyPrice: number; features: string[] }[]
): TierComparison[] {
  const sorted = [...tiers].sort((a, b) => a.monthlyPrice - b.monthlyPrice);

  return sorted.map((tier, idx) => {
    const valueScore = tier.monthlyPrice > 0
      ? Math.round((tier.features.length / (tier.monthlyPrice / 100)) * 100) / 100
      : Infinity;

    const positioning: "entry" | "popular" | "premium" =
      idx === 0 ? "entry" :
      idx === sorted.length - 1 ? "premium" :
      "popular";

    return {
      tier: tier.name,
      monthlyPrice: tier.monthlyPrice,
      featureCount: tier.features.length,
      valueScore: valueScore === Infinity ? 999 : valueScore,
      positioning,
    };
  });
}

/**
 * Model the impact of applying a discount.
 *
 * @param params - Discount parameters
 * @returns Discount impact model
 */
export function modelDiscount(params: {
  originalPrice: number;
  discountPercent: number;
  currentConversions: number;
  currentVisitors: number;
}): DiscountModel {
  const { originalPrice, discountPercent, currentConversions, currentVisitors } = params;
  const discountedPrice = Math.round(originalPrice * (1 - discountPercent / 100));
  const currentRate = currentVisitors > 0 ? currentConversions / currentVisitors : 0;
  const currentRevenue = originalPrice * currentConversions;

  // Break-even: how much must conversions increase to maintain same revenue?
  const breakEvenConversions = discountedPrice > 0
    ? Math.ceil(currentRevenue / discountedPrice)
    : Infinity;
  const breakEvenIncrease = currentConversions > 0
    ? Math.round(((breakEvenConversions - currentConversions) / currentConversions) * 100 * 10) / 10
    : 0;

  // Revenue scenarios at various conversion lifts
  const revenueScenarios = [10, 20, 30, 50, 100].map((lift) => {
    const newConversions = Math.round(currentConversions * (1 + lift / 100));
    const newRevenue = discountedPrice * newConversions;
    return {
      conversionLift: lift,
      revenueChange: Math.round(((newRevenue - currentRevenue) / currentRevenue) * 100 * 10) / 10,
    };
  });

  // Recommendation logic
  let recommendation: "recommended" | "neutral" | "not_recommended";
  let reasoning: string;

  if (discountPercent <= 10 && breakEvenIncrease < 15) {
    recommendation = "recommended";
    reasoning = `Small discount (${discountPercent}%) needs only ${breakEvenIncrease}% conversion lift to break even`;
  } else if (discountPercent <= 25 && breakEvenIncrease < 40) {
    recommendation = "neutral";
    reasoning = `Moderate discount requires ${breakEvenIncrease}% conversion lift — run A/B test first`;
  } else {
    recommendation = "not_recommended";
    reasoning = `Deep discount (${discountPercent}%) requires ${breakEvenIncrease}% conversion lift — high risk`;
  }

  return {
    originalPrice,
    discountPercent,
    discountedPrice,
    breakEvenIncrease,
    revenueScenarios,
    recommendation,
    reasoning,
  };
}

/**
 * Calculate annual vs monthly savings for display.
 */
export function calculateAnnualSavings(
  monthlyPrice: number,
  annualPrice: number
): { savingsPercent: number; savingsAmount: number; monthlyEquivalent: number } {
  const monthlyEquivalent = Math.round(annualPrice / 12);
  const fullMonthly = monthlyPrice * 12;
  const savingsAmount = fullMonthly - annualPrice;
  const savingsPercent = fullMonthly > 0
    ? Math.round((savingsAmount / fullMonthly) * 100)
    : 0;

  return { savingsPercent, savingsAmount, monthlyEquivalent };
}

/**
 * Apply charm pricing (end in 9 or 99).
 *
 * @param price - Price in cents
 * @returns Charm-priced amount in cents
 */
export function applyCharmPricing(price: number): number {
  if (price < 100) return price; // Don't charm sub-$1
  const dollars = Math.round(price / 100);
  return dollars * 100 - 1; // $9.99 instead of $10.00
}

/**
 * Generate pricing recommendations based on current metrics.
 *
 * @param metrics - Current pricing metrics
 * @returns Array of recommendations
 */
export function generateRecommendations(metrics: {
  monthlyPrice: number;
  annualPrice: number;
  conversionRate: number;
  churnRate: number;
  competitorAvgPrice: number;
}): PricingRecommendation[] {
  const recommendations: PricingRecommendation[] = [];

  // Check annual discount
  if (metrics.annualPrice > 0) {
    const savings = calculateAnnualSavings(metrics.monthlyPrice, metrics.annualPrice);
    if (savings.savingsPercent < PRICING_PSYCHOLOGY.annualDiscountRange.min) {
      recommendations.push({
        type: "annual_push",
        confidence: "high",
        description: `Annual discount (${savings.savingsPercent}%) is below ${PRICING_PSYCHOLOGY.annualDiscountRange.min}% sweet spot — increase to improve annual uptake`,
        estimatedMRRImpact: 0,
      });
    }
  }

  // Check conversion rate
  if (metrics.conversionRate < 3) {
    recommendations.push({
      type: "price_decrease",
      confidence: "medium",
      description: `Low conversion rate (${metrics.conversionRate}%) suggests price may be too high — consider A/B testing lower price points`,
      estimatedMRRImpact: -Math.round(metrics.monthlyPrice * 0.1),
    });
  }

  // Check churn
  if (metrics.churnRate > 8) {
    recommendations.push({
      type: "add_tier",
      confidence: "medium",
      description: `High churn (${metrics.churnRate}%) — consider adding a mid-tier plan between free and pro to reduce friction`,
      estimatedMRRImpact: Math.round(metrics.monthlyPrice * 0.5),
    });
  }

  // Competitor pricing comparison
  if (metrics.competitorAvgPrice > 0) {
    const priceRatio = metrics.monthlyPrice / metrics.competitorAvgPrice;
    if (priceRatio < 0.5) {
      recommendations.push({
        type: "price_increase",
        confidence: "medium",
        description: `Price is ${Math.round((1 - priceRatio) * 100)}% below competitor average — potential to increase without losing competitiveness`,
        estimatedMRRImpact: Math.round(metrics.monthlyPrice * 0.2),
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: "discount",
      confidence: "low",
      description: "Pricing appears well-positioned — consider seasonal promotions to test price sensitivity",
      estimatedMRRImpact: 0,
    });
  }

  return recommendations;
}

/**
 * Format pricing analysis as human-readable string.
 */
export function formatPricingAnalysis(
  sensitivity: PriceSensitivity,
  recommendations: PricingRecommendation[]
): string {
  const lines: string[] = [
    "=== Pricing Analysis ===",
    "",
    `Price Elasticity: ${sensitivity.elasticity}`,
    `Optimal Price: $${(sensitivity.optimalPrice / 100).toFixed(2)}`,
    `Current Revenue: $${(sensitivity.currentRevenue / 100).toFixed(2)}`,
    `Optimal Revenue: $${(sensitivity.optimalRevenue / 100).toFixed(2)}`,
    `Uplift Potential: ${sensitivity.upliftPercent}%`,
    `Confidence: ${sensitivity.confidence}`,
  ];

  if (recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const rec of recommendations) {
      lines.push(`  [${rec.confidence}] ${rec.type}: ${rec.description}`);
      if (rec.estimatedMRRImpact !== 0) {
        lines.push(`    MRR impact: ${rec.estimatedMRRImpact > 0 ? "+" : ""}$${(rec.estimatedMRRImpact / 100).toFixed(2)}`);
      }
    }
  }

  return lines.join("\n");
}
