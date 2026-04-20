/**
 * Q-229: Paywall Optimizer — conversion funnel analysis & timing
 *
 * Analyses user journeys to determine optimal paywall display timing,
 * placement, and messaging. Provides A/B test framework for
 * paywall configurations.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaywallTrigger =
  | "session_count"
  | "feature_gate"
  | "time_based"
  | "usage_limit"
  | "social_proof";

export type PaywallVariant = "A" | "B" | "C" | "D";

export interface PaywallConfig {
  variant: PaywallVariant;
  trigger: PaywallTrigger;
  /** Sessions before showing paywall */
  sessionThreshold: number;
  /** Feature that triggers the paywall */
  gatedFeature?: string;
  /** CTA text */
  ctaText: string;
  /** Whether to show social proof */
  showSocialProof: boolean;
  /** Discount percentage (0 = no discount) */
  discountPercent: number;
}

export interface PaywallEvent {
  userId: string;
  variant: PaywallVariant;
  action: "shown" | "dismissed" | "clicked" | "converted";
  timestamp: string;
  /** Page where the paywall was shown */
  page: string;
  /** Session number at time of event */
  sessionNumber: number;
}

export interface VariantMetrics {
  variant: PaywallVariant;
  shown: number;
  dismissed: number;
  clicked: number;
  converted: number;
  /** Click-through rate */
  ctr: number;
  /** Conversion rate (converted / shown) */
  conversionRate: number;
  /** Average sessions before conversion */
  avgSessionsToConvert: number;
  /** Revenue attributed */
  revenue: number;
}

export interface PaywallReport {
  variants: VariantMetrics[];
  /** Winning variant (highest conversion rate with statistical significance) */
  winner: PaywallVariant | null;
  /** Statistical significance reached */
  significanceReached: boolean;
  /** Overall conversion rate */
  overallConversionRate: number;
  /** Total revenue */
  totalRevenue: number;
  /** Recommendation */
  recommendation: string;
  timestamp: string;
}

export interface UserJourney {
  userId: string;
  totalSessions: number;
  paywallsShown: number;
  converted: boolean;
  convertedAtSession?: number;
  daysSinceFirstVisit: number;
  featuresUsed: string[];
}

// ---------------------------------------------------------------------------
// Optimal timing analysis
// ---------------------------------------------------------------------------

/**
 * Analyse user journeys to find the optimal session count for paywall display.
 */
export function findOptimalTiming(
  journeys: UserJourney[]
): {
  optimalSessionCount: number;
  conversionsBySession: Array<{ session: number; rate: number; count: number }>;
  recommendation: string;
} {
  // Group conversions by session number
  const sessionBuckets = new Map<number, { converted: number; total: number }>();

  for (const j of journeys) {
    if (j.converted && j.convertedAtSession !== undefined) {
      const bucket = sessionBuckets.get(j.convertedAtSession) ?? { converted: 0, total: 0 };
      bucket.converted++;
      bucket.total++;
      sessionBuckets.set(j.convertedAtSession, bucket);
    }
  }

  // Also count non-converted users by their total session count
  for (const j of journeys) {
    if (!j.converted) {
      const session = Math.min(j.totalSessions, 20); // Cap at 20
      const bucket = sessionBuckets.get(session) ?? { converted: 0, total: 0 };
      bucket.total++;
      sessionBuckets.set(session, bucket);
    }
  }

  const conversionsBySession = [...sessionBuckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([session, data]) => ({
      session,
      rate: data.total > 0 ? data.converted / data.total : 0,
      count: data.total,
    }));

  // Find optimal: highest conversion rate with meaningful sample size
  let bestSession = 3; // Default
  let bestRate = 0;

  for (const entry of conversionsBySession) {
    if (entry.count >= 5 && entry.rate > bestRate) {
      bestRate = entry.rate;
      bestSession = entry.session;
    }
  }

  const recommendation =
    bestRate > 0.1
      ? `Show paywall at session ${bestSession} (${(bestRate * 100).toFixed(1)}% conversion rate)`
      : "Insufficient data — start with session 3 default";

  return {
    optimalSessionCount: bestSession,
    conversionsBySession,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// A/B test analysis
// ---------------------------------------------------------------------------

/**
 * Calculate metrics for each paywall variant.
 */
export function analyseVariants(
  events: PaywallEvent[],
  pricePerConversion: number
): VariantMetrics[] {
  const variantMap = new Map<
    PaywallVariant,
    { shown: number; dismissed: number; clicked: number; converted: number; sessionSums: number }
  >();

  for (const e of events) {
    if (!variantMap.has(e.variant)) {
      variantMap.set(e.variant, {
        shown: 0, dismissed: 0, clicked: 0, converted: 0, sessionSums: 0,
      });
    }
    const v = variantMap.get(e.variant)!;

    switch (e.action) {
      case "shown": v.shown++; break;
      case "dismissed": v.dismissed++; break;
      case "clicked": v.clicked++; break;
      case "converted":
        v.converted++;
        v.sessionSums += e.sessionNumber;
        break;
    }
  }

  return [...variantMap.entries()].map(([variant, data]) => ({
    variant,
    shown: data.shown,
    dismissed: data.dismissed,
    clicked: data.clicked,
    converted: data.converted,
    ctr: data.shown > 0 ? data.clicked / data.shown : 0,
    conversionRate: data.shown > 0 ? data.converted / data.shown : 0,
    avgSessionsToConvert:
      data.converted > 0 ? Math.round(data.sessionSums / data.converted) : 0,
    revenue: data.converted * pricePerConversion,
  }));
}

/**
 * Build a full paywall A/B test report.
 */
export function buildPaywallReport(
  events: PaywallEvent[],
  pricePerConversion: number
): PaywallReport {
  const variants = analyseVariants(events, pricePerConversion);

  // Sort by conversion rate
  const sorted = [...variants].sort(
    (a, b) => b.conversionRate - a.conversionRate
  );
  const top = sorted[0];

  // Simple significance check (need at least 100 samples per variant)
  const minSamples = 100;
  const significanceReached = variants.every((v) => v.shown >= minSamples);

  const winner = significanceReached && top && top.conversionRate > 0
    ? top.variant
    : null;

  const overallShown = variants.reduce((s, v) => s + v.shown, 0);
  const overallConverted = variants.reduce((s, v) => s + v.converted, 0);
  const totalRevenue = variants.reduce((s, v) => s + v.revenue, 0);

  let recommendation: string;
  if (winner) {
    recommendation = `Variant ${winner} wins with ${(top.conversionRate * 100).toFixed(1)}% conversion. Roll out to 100%.`;
  } else if (!significanceReached) {
    recommendation = `Need more data. Minimum ${minSamples} impressions per variant required.`;
  } else {
    recommendation = "No clear winner yet. Continue testing.";
  }

  return {
    variants,
    winner,
    significanceReached,
    overallConversionRate:
      overallShown > 0 ? overallConverted / overallShown : 0,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    recommendation,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format paywall report as human-readable string.
 */
export function formatPaywallReport(report: PaywallReport): string {
  const lines: string[] = [
    `Paywall A/B Test Report`,
    `Overall conversion: ${(report.overallConversionRate * 100).toFixed(1)}%`,
    `Total revenue: $${report.totalRevenue}`,
    `Winner: ${report.winner ?? "TBD"}`,
    `Significance: ${report.significanceReached ? "YES" : "NO"}`,
    "",
    "Variants:",
  ];

  for (const v of report.variants) {
    lines.push(
      `  ${v.variant}: ${v.shown} shown, ${(v.conversionRate * 100).toFixed(1)}% conv, $${v.revenue} rev`
    );
  }

  lines.push("", `Recommendation: ${report.recommendation}`);

  return lines.join("\n");
}
