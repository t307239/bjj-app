/**
 * lib/costEstimator.ts — Monthly cost estimation based on usage
 *
 * Q-135: Cost pillar — estimates monthly infrastructure costs
 * based on current usage patterns (MAU, DB rows, API calls, storage).
 * Helps anticipate tier upgrades and cost anomalies.
 *
 * Pricing data based on Vercel Hobby/Pro and Supabase Free/Pro plans
 * as of 2026-04. Update PRICING constants when plans change.
 *
 * @example
 *   import { estimateMonthlyCost, detectCostAnomaly } from "@/lib/costEstimator";
 *   const estimate = estimateMonthlyCost({ mau: 500, dbSizeGb: 2, ... });
 *   const anomaly = detectCostAnomaly(estimate, previousEstimate);
 */

// ── Pricing Constants (update when provider plans change) ────────────────

export const PRICING = {
  /** Vercel pricing */
  vercel: {
    /** Hobby: free, Pro: $20/mo */
    proBaseMonthlyCents: 2000,
    /** Bandwidth: $40/100GB on Pro */
    bandwidthPerGbCents: 40,
    /** Serverless function invocations: $0.60/1M on Pro */
    invocationsPerMillionCents: 60,
    /** Included bandwidth on Pro (GB) */
    includedBandwidthGb: 1000,
    /** Included invocations on Pro */
    includedInvocations: 1_000_000,
  },

  /** Supabase pricing */
  supabase: {
    /** Free: $0, Pro: $25/mo */
    proBaseMonthlyCents: 2500,
    /** Storage: $0.021/GB/mo on Pro (above 8GB included) */
    storagePerGbCents: 2.1,
    /** Included storage on Pro (GB) */
    includedStorageGb: 8,
    /** Database size: $0.125/GB/mo on Pro (above 8GB included) */
    dbSizePerGbCents: 12.5,
    /** Included database size on Pro (GB) */
    includedDbSizeGb: 8,
  },

  /** Stripe fees (per transaction) */
  stripe: {
    /** 3.6% per transaction */
    ratePercent: 3.6,
    /** Fixed fee per transaction (cents, JPY) */
    fixedFeeCents: 40,
  },

  /** Resend email pricing */
  resend: {
    /** Free: 100 emails/day, Pro: $20/mo for 50K */
    freeEmailsPerDay: 100,
    proBaseMonthlyCents: 2000,
    proIncludedEmails: 50_000,
  },
} as const;

// ── Types ────────────────────────────────────────────────────────────────

export interface UsageMetrics {
  /** Monthly active users */
  mau: number;
  /** Database size in GB */
  dbSizeGb: number;
  /** File storage used in GB */
  storageGb: number;
  /** Monthly API invocations */
  apiInvocations: number;
  /** Monthly bandwidth in GB */
  bandwidthGb: number;
  /** Monthly email sends */
  emailsSent: number;
  /** Number of Pro subscribers */
  proSubscribers: number;
  /** Average revenue per Pro user (cents/month) */
  avgRevenueCentsPerPro: number;
}

export interface CostBreakdown {
  vercelCents: number;
  supabaseCents: number;
  stripeFeesCents: number;
  resendCents: number;
  totalCents: number;
  totalUsd: number;
}

export interface CostEstimate {
  usage: UsageMetrics;
  costs: CostBreakdown;
  revenue: {
    monthlyRevenueCents: number;
    monthlyRevenueUsd: number;
  };
  margins: {
    profitCents: number;
    profitUsd: number;
    marginPercent: number;
  };
  tier: "free" | "hobby" | "growth" | "scale";
  warnings: string[];
  estimatedAt: string;
}

export interface CostAnomaly {
  detected: boolean;
  metric: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  severity: "info" | "warning" | "critical";
}

// ── Cost Estimation ──────────────────────────────────────────────────────

/**
 * Estimate monthly infrastructure cost based on usage metrics.
 */
export function estimateMonthlyCost(usage: UsageMetrics): CostEstimate {
  const warnings: string[] = [];

  // Vercel costs
  let vercelCents = 0;
  if (usage.mau > 100 || usage.apiInvocations > 100_000) {
    vercelCents = PRICING.vercel.proBaseMonthlyCents;
    const extraBandwidth = Math.max(0, usage.bandwidthGb - PRICING.vercel.includedBandwidthGb);
    vercelCents += extraBandwidth * PRICING.vercel.bandwidthPerGbCents;
    const extraInvocations = Math.max(0, usage.apiInvocations - PRICING.vercel.includedInvocations);
    vercelCents += (extraInvocations / 1_000_000) * PRICING.vercel.invocationsPerMillionCents;
  }

  // Supabase costs
  let supabaseCents = 0;
  if (usage.mau > 50 || usage.dbSizeGb > 0.5) {
    supabaseCents = PRICING.supabase.proBaseMonthlyCents;
    const extraDb = Math.max(0, usage.dbSizeGb - PRICING.supabase.includedDbSizeGb);
    supabaseCents += extraDb * PRICING.supabase.dbSizePerGbCents;
    const extraStorage = Math.max(0, usage.storageGb - PRICING.supabase.includedStorageGb);
    supabaseCents += extraStorage * PRICING.supabase.storagePerGbCents;
  }

  // Stripe fees (on Pro revenue)
  const monthlyRevenueCents = usage.proSubscribers * usage.avgRevenueCentsPerPro;
  const stripeFeesCents = usage.proSubscribers > 0
    ? Math.round(monthlyRevenueCents * (PRICING.stripe.ratePercent / 100))
      + (usage.proSubscribers * PRICING.stripe.fixedFeeCents)
    : 0;

  // Resend costs
  const dailyEmails = usage.emailsSent / 30;
  let resendCents = 0;
  if (dailyEmails > PRICING.resend.freeEmailsPerDay) {
    resendCents = PRICING.resend.proBaseMonthlyCents;
  }

  // Warnings
  if (usage.dbSizeGb > 6) warnings.push("DB size approaching Supabase Pro limit (8GB included)");
  if (usage.mau > 10_000) warnings.push("MAU above 10K — review Vercel Pro plan limits");
  if (usage.bandwidthGb > 800) warnings.push("Bandwidth approaching Vercel Pro included limit (1TB)");
  if (monthlyRevenueCents > 0 && stripeFeesCents / monthlyRevenueCents > 0.05) {
    warnings.push("Stripe fees exceed 5% of revenue — consider annual billing");
  }

  const totalCents = vercelCents + supabaseCents + stripeFeesCents + resendCents;
  const profitCents = monthlyRevenueCents - totalCents;

  // Tier classification
  let tier: CostEstimate["tier"] = "free";
  if (usage.mau > 1_000) tier = "scale";
  else if (usage.mau > 100) tier = "growth";
  else if (usage.mau > 10) tier = "hobby";

  return {
    usage,
    costs: {
      vercelCents,
      supabaseCents,
      stripeFeesCents,
      resendCents,
      totalCents,
      totalUsd: totalCents / 100,
    },
    revenue: {
      monthlyRevenueCents,
      monthlyRevenueUsd: monthlyRevenueCents / 100,
    },
    margins: {
      profitCents,
      profitUsd: profitCents / 100,
      marginPercent: monthlyRevenueCents > 0
        ? Math.round((profitCents / monthlyRevenueCents) * 100)
        : 0,
    },
    tier,
    warnings,
    estimatedAt: new Date().toISOString(),
  };
}

// ── Cost Anomaly Detection ───────────────────────────────────────────────

/**
 * Detect cost anomalies by comparing two estimates.
 * Returns anomalies for any cost component that changed significantly.
 */
export function detectCostAnomalies(
  current: CostEstimate,
  previous: CostEstimate,
  thresholdPercent = 25,
): CostAnomaly[] {
  const anomalies: CostAnomaly[] = [];

  const pairs: Array<{ metric: string; curr: number; prev: number }> = [
    { metric: "vercel", curr: current.costs.vercelCents, prev: previous.costs.vercelCents },
    { metric: "supabase", curr: current.costs.supabaseCents, prev: previous.costs.supabaseCents },
    { metric: "stripe_fees", curr: current.costs.stripeFeesCents, prev: previous.costs.stripeFeesCents },
    { metric: "total", curr: current.costs.totalCents, prev: previous.costs.totalCents },
    { metric: "mau", curr: current.usage.mau, prev: previous.usage.mau },
    { metric: "db_size", curr: current.usage.dbSizeGb, prev: previous.usage.dbSizeGb },
  ];

  for (const { metric, curr, prev } of pairs) {
    if (prev === 0) continue;
    const changePercent = Math.round(((curr - prev) / prev) * 100);
    if (Math.abs(changePercent) >= thresholdPercent) {
      let severity: CostAnomaly["severity"] = "info";
      if (Math.abs(changePercent) >= 100) severity = "critical";
      else if (Math.abs(changePercent) >= 50) severity = "warning";

      anomalies.push({
        detected: true,
        metric,
        previousValue: prev,
        currentValue: curr,
        changePercent,
        severity,
      });
    }
  }

  return anomalies;
}

/**
 * Format cost estimate as a human-readable summary.
 */
export function formatCostSummary(estimate: CostEstimate): string {
  const lines = [
    `💰 Monthly Cost Estimate (${estimate.tier} tier)`,
    `   Vercel:   $${(estimate.costs.vercelCents / 100).toFixed(2)}`,
    `   Supabase: $${(estimate.costs.supabaseCents / 100).toFixed(2)}`,
    `   Stripe:   $${(estimate.costs.stripeFeesCents / 100).toFixed(2)}`,
    `   Resend:   $${(estimate.costs.resendCents / 100).toFixed(2)}`,
    `   ─────────────────`,
    `   Total:    $${estimate.costs.totalUsd.toFixed(2)}/mo`,
    `   Revenue:  $${estimate.revenue.monthlyRevenueUsd.toFixed(2)}/mo`,
    `   Margin:   ${estimate.margins.marginPercent}%`,
  ];

  if (estimate.warnings.length > 0) {
    lines.push("", "   ⚠ Warnings:");
    for (const w of estimate.warnings) {
      lines.push(`     - ${w}`);
    }
  }

  return lines.join("\n");
}
