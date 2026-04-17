/**
 * lib/billingAnalyzer.ts — Billing & revenue analytics
 *
 * Q-169: Cost pillar 93→94 — MRR/ARR calculation, revenue per tier,
 * churn revenue impact, cost-per-feature breakdown, billing health.
 *
 * Pure utility — operates on subscription/payment arrays.
 *
 * @example
 *   import { calculateMRR, analyzeBillingHealth } from "@/lib/billingAnalyzer";
 *
 *   const mrr = calculateMRR(subscriptions);
 *   // → { total: 4990, byTier: { pro_monthly: 2997, pro_annual: 1993 }, ... }
 */

// ── Types ───────────────────────────────────────────────────────────────

export type BillingTier = "free" | "pro_monthly" | "pro_annual";
export type BillingInterval = "month" | "year";

export interface Subscription {
  userId: string;
  tier: BillingTier;
  pricePerInterval: number; // in cents
  interval: BillingInterval;
  startDate: string;
  cancelDate?: string;
  status: "active" | "canceled" | "past_due" | "trialing";
}

export interface MRRBreakdown {
  /** Total MRR in cents */
  total: number;
  /** MRR by tier */
  byTier: Record<BillingTier, number>;
  /** New MRR this period */
  newMRR: number;
  /** Churned MRR this period */
  churnedMRR: number;
  /** Net MRR change */
  netChange: number;
  /** ARR (MRR × 12) */
  arr: number;
  /** Subscriber count */
  subscriberCount: number;
  /** ARPU (average revenue per user, cents) */
  arpu: number;
}

export interface RevenueMetrics {
  /** Gross revenue (all time, cents) */
  grossRevenue: number;
  /** Revenue by tier */
  byTier: Record<BillingTier, number>;
  /** Average lifetime value (cents) */
  avgLTV: number;
  /** Revenue per paying user per month (cents) */
  revenuePerPayingUser: number;
  /** Free-to-paid conversion rate (0-100) */
  conversionRate: number;
}

export interface BillingHealth {
  /** Health status */
  status: "healthy" | "warning" | "critical";
  /** MRR breakdown */
  mrr: MRRBreakdown;
  /** Revenue metrics */
  revenue: RevenueMetrics;
  /** Issues found */
  issues: BillingIssue[];
  /** Recommendations */
  recommendations: string[];
}

export interface BillingIssue {
  type: "high_churn" | "low_arpu" | "past_due" | "trial_expiring" | "concentration_risk";
  severity: "low" | "medium" | "high";
  description: string;
}

// ── Constants ──────────────────────────────────────────────────────────

/** Pricing tiers in cents */
export const TIER_PRICES: Record<BillingTier, { monthly: number; label: string }> = {
  free: { monthly: 0, label: "Free" },
  pro_monthly: { monthly: 999, label: "Pro Monthly" },
  pro_annual: { monthly: 667, label: "Pro Annual" }, // $6.67/mo ($80/yr)
};

/** Health thresholds */
export const BILLING_THRESHOLDS = {
  /** Monthly churn rate above this is concerning */
  highChurnRate: 5, // 5%
  /** ARPU below this (cents) is low */
  lowARPU: 500, // $5
  /** Past-due subscriptions above this % is concerning */
  highPastDueRate: 3, // 3%
  /** Single tier revenue concentration above this % is risky */
  concentrationRisk: 80, // 80%
} as const;

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Convert any subscription price to monthly equivalent (cents).
 */
export function toMonthlyCents(sub: Subscription): number {
  if (sub.tier === "free") return 0;
  if (sub.interval === "year") {
    return Math.round(sub.pricePerInterval / 12);
  }
  return sub.pricePerInterval;
}

/**
 * Calculate Monthly Recurring Revenue breakdown.
 *
 * @param subscriptions - All subscriptions
 * @param periodStart - Start of current period (ISO string)
 * @returns MRR breakdown
 */
export function calculateMRR(
  subscriptions: Subscription[],
  periodStart?: string
): MRRBreakdown {
  const byTier: Record<BillingTier, number> = { free: 0, pro_monthly: 0, pro_annual: 0 };
  let total = 0;
  let newMRR = 0;
  let churnedMRR = 0;
  let subscriberCount = 0;

  const periodMs = periodStart ? new Date(periodStart).getTime() : 0;

  for (const sub of subscriptions) {
    const monthly = toMonthlyCents(sub);

    if (sub.status === "active" || sub.status === "trialing") {
      byTier[sub.tier] += monthly;
      total += monthly;
      if (monthly > 0) subscriberCount++;

      // New this period
      if (periodStart && new Date(sub.startDate).getTime() >= periodMs) {
        newMRR += monthly;
      }
    }

    // Churned this period
    if (sub.status === "canceled" && sub.cancelDate && periodStart) {
      if (new Date(sub.cancelDate).getTime() >= periodMs) {
        churnedMRR += monthly;
      }
    }
  }

  return {
    total,
    byTier,
    newMRR,
    churnedMRR,
    netChange: newMRR - churnedMRR,
    arr: total * 12,
    subscriberCount,
    arpu: subscriberCount > 0 ? Math.round(total / subscriberCount) : 0,
  };
}

/**
 * Calculate revenue metrics from subscription history.
 *
 * @param subscriptions - All subscriptions (including canceled)
 * @param totalUsers - Total registered users (free + paid)
 * @returns Revenue metrics
 */
export function calculateRevenue(
  subscriptions: Subscription[],
  totalUsers: number
): RevenueMetrics {
  const byTier: Record<BillingTier, number> = { free: 0, pro_monthly: 0, pro_annual: 0 };
  let grossRevenue = 0;
  let payingUsers = 0;
  let totalMonths = 0;

  for (const sub of subscriptions) {
    if (sub.tier === "free") continue;

    const monthly = toMonthlyCents(sub);
    const start = new Date(sub.startDate).getTime();
    const end = sub.cancelDate
      ? new Date(sub.cancelDate).getTime()
      : Date.now() + 9 * 60 * 60 * 1000; // JST now

    const months = Math.max(1, Math.ceil((end - start) / (30 * 24 * 60 * 60 * 1000)));
    const revenue = monthly * months;

    byTier[sub.tier] += revenue;
    grossRevenue += revenue;
    payingUsers++;
    totalMonths += months;
  }

  const avgLTV = payingUsers > 0 ? Math.round(grossRevenue / payingUsers) : 0;
  const revenuePerPayingUser = payingUsers > 0 && totalMonths > 0
    ? Math.round(grossRevenue / totalMonths)
    : 0;
  const conversionRate = totalUsers > 0
    ? Math.round((payingUsers / totalUsers) * 100 * 10) / 10
    : 0;

  return {
    grossRevenue,
    byTier,
    avgLTV,
    revenuePerPayingUser,
    conversionRate,
  };
}

/**
 * Calculate monthly churn rate.
 *
 * @param subscriptions - All subscriptions
 * @param periodStart - Start of measurement period
 * @returns Churn rate as percentage (0-100)
 */
export function calculateChurnRate(
  subscriptions: Subscription[],
  periodStart: string
): number {
  const periodMs = new Date(periodStart).getTime();
  const activeAtStart = subscriptions.filter((s) => {
    const startMs = new Date(s.startDate).getTime();
    return startMs < periodMs && (s.status === "active" || s.status === "trialing" ||
      (s.status === "canceled" && s.cancelDate && new Date(s.cancelDate).getTime() >= periodMs));
  }).length;

  if (activeAtStart === 0) return 0;

  const churnedInPeriod = subscriptions.filter((s) =>
    s.status === "canceled" && s.cancelDate &&
    new Date(s.cancelDate).getTime() >= periodMs
  ).length;

  return Math.round((churnedInPeriod / activeAtStart) * 100 * 10) / 10;
}

/**
 * Analyze overall billing health.
 *
 * @param subscriptions - All subscriptions
 * @param totalUsers - Total registered users
 * @param periodStart - Current period start (ISO string)
 * @returns Billing health assessment
 */
export function analyzeBillingHealth(
  subscriptions: Subscription[],
  totalUsers: number,
  periodStart?: string
): BillingHealth {
  const mrr = calculateMRR(subscriptions, periodStart);
  const revenue = calculateRevenue(subscriptions, totalUsers);
  const issues: BillingIssue[] = [];
  const recommendations: string[] = [];

  // Check churn rate
  if (periodStart) {
    const churnRate = calculateChurnRate(subscriptions, periodStart);
    if (churnRate > BILLING_THRESHOLDS.highChurnRate) {
      issues.push({
        type: "high_churn",
        severity: churnRate > 10 ? "high" : "medium",
        description: `Monthly churn rate ${churnRate}% exceeds ${BILLING_THRESHOLDS.highChurnRate}% threshold`,
      });
      recommendations.push("Investigate churn reasons; consider exit surveys and win-back campaigns");
    }
  }

  // Check ARPU
  if (mrr.arpu > 0 && mrr.arpu < BILLING_THRESHOLDS.lowARPU) {
    issues.push({
      type: "low_arpu",
      severity: "medium",
      description: `ARPU $${(mrr.arpu / 100).toFixed(2)} is below $${(BILLING_THRESHOLDS.lowARPU / 100).toFixed(2)} target`,
    });
    recommendations.push("Consider value-add features or premium tier to increase ARPU");
  }

  // Check past-due
  const pastDueCount = subscriptions.filter((s) => s.status === "past_due").length;
  const pastDueRate = mrr.subscriberCount > 0
    ? (pastDueCount / mrr.subscriberCount) * 100
    : 0;
  if (pastDueRate > BILLING_THRESHOLDS.highPastDueRate) {
    issues.push({
      type: "past_due",
      severity: "high",
      description: `${pastDueRate.toFixed(1)}% of subscriptions are past due`,
    });
    recommendations.push("Implement dunning emails and payment retry logic");
  }

  // Check trial expiring
  const trialCount = subscriptions.filter((s) => s.status === "trialing").length;
  if (trialCount > 0) {
    issues.push({
      type: "trial_expiring",
      severity: "low",
      description: `${trialCount} trials active — ensure trial-to-paid conversion flow is optimized`,
    });
  }

  // Check concentration risk
  if (mrr.total > 0) {
    const maxTierRevenue = Math.max(...Object.values(mrr.byTier));
    const concentration = (maxTierRevenue / mrr.total) * 100;
    if (concentration > BILLING_THRESHOLDS.concentrationRisk) {
      issues.push({
        type: "concentration_risk",
        severity: "medium",
        description: `${concentration.toFixed(0)}% of MRR from single tier — diversification needed`,
      });
      recommendations.push("Promote alternative billing tiers to reduce revenue concentration");
    }
  }

  // Determine status
  const highIssues = issues.filter((i) => i.severity === "high").length;
  const status: "healthy" | "warning" | "critical" =
    highIssues > 0 ? "critical" :
    issues.length > 2 ? "warning" :
    "healthy";

  if (issues.length === 0) {
    recommendations.push("Billing metrics look healthy — continue monitoring");
  }

  return { status, mrr, revenue, issues, recommendations };
}

/**
 * Format billing health as a human-readable string.
 */
export function formatBillingHealth(health: BillingHealth): string {
  const lines: string[] = [
    `=== Billing Health: ${health.status.toUpperCase()} ===`,
    "",
    `MRR: $${(health.mrr.total / 100).toFixed(2)}`,
    `ARR: $${(health.mrr.arr / 100).toFixed(2)}`,
    `Subscribers: ${health.mrr.subscriberCount}`,
    `ARPU: $${(health.mrr.arpu / 100).toFixed(2)}`,
    `New MRR: +$${(health.mrr.newMRR / 100).toFixed(2)}`,
    `Churned MRR: -$${(health.mrr.churnedMRR / 100).toFixed(2)}`,
    `Net Change: $${(health.mrr.netChange / 100).toFixed(2)}`,
    "",
    `Conversion Rate: ${health.revenue.conversionRate}%`,
    `Avg LTV: $${(health.revenue.avgLTV / 100).toFixed(2)}`,
  ];

  if (health.issues.length > 0) {
    lines.push("", "Issues:");
    for (const issue of health.issues) {
      lines.push(`  [${issue.severity}] ${issue.description}`);
    }
  }

  if (health.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const rec of health.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }

  return lines.join("\n");
}
