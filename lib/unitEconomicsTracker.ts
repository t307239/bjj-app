/**
 * unitEconomicsTracker.ts
 * Per-tier unit economics tracking for BJJ App.
 * Computes revenue, costs, margins, projections, and break-even analysis.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Subscription tier identifier */
export type UserTier = 'free' | 'pro_monthly' | 'pro_annual';

/** Cost component identifier */
export type CostComponent =
  | 'compute'
  | 'storage'
  | 'bandwidth'
  | 'ai_api'
  | 'push_notifications'
  | 'email'
  | 'stripe_fees';

/** Itemized cost breakdown for a tier */
export interface TierCost {
  readonly tier: UserTier;
  readonly breakdown: Record<CostComponent, number>;
  readonly totalMonthly: number;
}

/** Margin analysis for a single tier */
export interface TierMargin {
  readonly tier: UserTier;
  readonly revenue: number;
  readonly cost: number;
  readonly grossMargin: number;
  readonly grossMarginPercent: number;
  readonly contributionMargin: number;
}

/** Blended metrics across all tiers */
export interface BlendedMetrics {
  readonly arpu: number;
  readonly blendedMarginPercent: number;
  readonly estimatedLtv: number;
  readonly cacRatio: number;
  readonly totalMonthlyRevenue: number;
  readonly totalMonthlyCost: number;
}

/** Monthly projection */
export interface Projection {
  readonly month: number;
  readonly users: Record<UserTier, number>;
  readonly revenue: number;
  readonly cost: number;
  readonly profit: number;
  readonly cumulativeProfit: number;
}

/** Break-even analysis */
export interface BreakEvenAnalysis {
  readonly fixedCosts: number;
  readonly contributionPerUser: number;
  readonly usersToBreakEven: number;
  readonly monthsToBreakEven: number | null;
  readonly byTier: Array<{ tier: UserTier; usersNeeded: number }>;
}

/** Alert for declining margins */
export interface ErosionAlert {
  readonly tier: UserTier;
  readonly metric: string;
  readonly previousValue: number;
  readonly currentValue: number;
  readonly changePercent: number;
  readonly severity: 'warning' | 'critical';
}

/** Per-tier economics input */
export interface TierEconomics {
  readonly tier: UserTier;
  readonly userCount: number;
  readonly avgUsage: Record<CostComponent, number>;
}

/** Full unit economics report */
export interface UnitEconomicsReport {
  readonly generatedAt: string;
  readonly tiers: TierMargin[];
  readonly blended: BlendedMetrics;
  readonly projections: Projection[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Monthly price per tier (USD) */
export const TIER_PRICES: Record<UserTier, number> = {
  free: 0,
  pro_monthly: 9.99,
  pro_annual: 5.99, // monthly equivalent of $71.88/year
};

/** Base cost per unit of each component (USD/user/month) */
export const COST_PER_UNIT: Record<CostComponent, number> = {
  compute: 0.0012,
  storage: 0.0008,
  bandwidth: 0.0005,
  ai_api: 0.0150,
  push_notifications: 0.0003,
  email: 0.0010,
  stripe_fees: 0.0000, // calculated as % of revenue
};

/** Stripe fee structure */
const STRIPE_RATE = 0.029;
const STRIPE_FIXED = 0.30;

/** Average customer lifespan in months (for LTV) */
const AVG_LIFESPAN_MONTHS = 18;

/** Assumed customer acquisition cost */
const DEFAULT_CAC = 8.0;

/** All cost components */
export const COST_COMPONENTS: CostComponent[] = [
  'compute', 'storage', 'bandwidth', 'ai_api', 'push_notifications', 'email', 'stripe_fees',
];

/** All tiers */
export const TIERS: UserTier[] = ['free', 'pro_monthly', 'pro_annual'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate monthly revenue for a given tier and user count.
 */
export function calculateTierRevenue(tier: UserTier, count: number): number {
  return TIER_PRICES[tier] * count;
}

/**
 * Calculate itemized cost breakdown for a tier given average usage.
 */
export function calculateTierCost(
  tier: UserTier,
  avgUsage: Record<CostComponent, number>,
): TierCost {
  const breakdown = {} as Record<CostComponent, number>;
  let total = 0;
  for (const component of COST_COMPONENTS) {
    if (component === 'stripe_fees') {
      const revenue = TIER_PRICES[tier];
      breakdown[component] = revenue > 0 ? revenue * STRIPE_RATE + STRIPE_FIXED : 0;
    } else {
      breakdown[component] = (avgUsage[component] ?? 0) * COST_PER_UNIT[component];
    }
    total += breakdown[component];
  }
  return { tier, breakdown, totalMonthly: total };
}

/**
 * Calculate gross and contribution margins for a tier.
 */
export function calculateTierMargin(
  tier: UserTier,
  avgUsage: Record<CostComponent, number>,
): TierMargin {
  const revenue = TIER_PRICES[tier];
  const cost = calculateTierCost(tier, avgUsage).totalMonthly;
  const grossMargin = revenue - cost;
  return {
    tier,
    revenue,
    cost,
    grossMargin,
    grossMarginPercent: revenue > 0 ? (grossMargin / revenue) * 100 : -100,
    contributionMargin: grossMargin,
  };
}

/**
 * Calculate blended metrics across all tiers.
 */
export function calculateBlendedMetrics(
  tiers: TierEconomics[],
  cac?: number,
): BlendedMetrics {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalUsers = 0;

  for (const t of tiers) {
    totalRevenue += calculateTierRevenue(t.tier, t.userCount);
    totalCost += calculateTierCost(t.tier, t.avgUsage).totalMonthly * t.userCount;
    totalUsers += t.userCount;
  }

  const arpu = totalUsers > 0 ? totalRevenue / totalUsers : 0;
  const blendedMarginPercent = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
  const estimatedLtv = arpu * AVG_LIFESPAN_MONTHS;
  const effectiveCac = cac ?? DEFAULT_CAC;
  const cacRatio = effectiveCac > 0 ? estimatedLtv / effectiveCac : 0;

  return {
    arpu,
    blendedMarginPercent,
    estimatedLtv,
    cacRatio,
    totalMonthlyRevenue: totalRevenue,
    totalMonthlyCost: totalCost,
  };
}

/**
 * Project revenue, cost, and profit over N months with a growth rate.
 */
export function projectScaling(
  currentTiers: TierEconomics[],
  growthRate: number,
  months: number,
): Projection[] {
  const projections: Projection[] = [];
  let cumulativeProfit = 0;

  for (let m = 1; m <= months; m++) {
    const factor = Math.pow(1 + growthRate, m);
    const users = {} as Record<UserTier, number>;
    let revenue = 0;
    let cost = 0;

    for (const t of currentTiers) {
      const projected = Math.round(t.userCount * factor);
      users[t.tier] = projected;
      revenue += calculateTierRevenue(t.tier, projected);
      cost += calculateTierCost(t.tier, t.avgUsage).totalMonthly * projected;
    }

    // Fill missing tiers with 0
    for (const tier of TIERS) {
      if (!(tier in users)) users[tier] = 0;
    }

    const profit = revenue - cost;
    cumulativeProfit += profit;
    projections.push({ month: m, users, revenue, cost, profit, cumulativeProfit });
  }
  return projections;
}

/**
 * Find the number of users needed to break even given fixed costs.
 */
export function findBreakEvenPoint(
  fixedCosts: number,
  tiers: TierEconomics[],
): BreakEvenAnalysis {
  let totalContribution = 0;
  let totalUsers = 0;
  const byTier: Array<{ tier: UserTier; usersNeeded: number }> = [];

  for (const t of tiers) {
    const margin = calculateTierMargin(t.tier, t.avgUsage);
    totalContribution += margin.contributionMargin * t.userCount;
    totalUsers += t.userCount;

    if (margin.contributionMargin > 0) {
      byTier.push({ tier: t.tier, usersNeeded: Math.ceil(fixedCosts / margin.contributionMargin) });
    } else {
      byTier.push({ tier: t.tier, usersNeeded: Infinity });
    }
  }

  const contributionPerUser = totalUsers > 0 ? totalContribution / totalUsers : 0;
  const usersToBreakEven = contributionPerUser > 0 ? Math.ceil(fixedCosts / contributionPerUser) : Infinity;
  const monthlyProfit = totalContribution - fixedCosts;
  const monthsToBreakEven = monthlyProfit > 0 ? Math.ceil(fixedCosts / monthlyProfit) : null;

  return { fixedCosts, contributionPerUser, usersToBreakEven, monthsToBreakEven, byTier };
}

/**
 * Detect declining margins by comparing two snapshots of tier economics.
 */
export function detectMarginErosion(
  history: Array<{ period: string; tiers: TierEconomics[] }>,
): ErosionAlert[] {
  if (history.length < 2) return [];
  const alerts: ErosionAlert[] = [];
  const prev = history[history.length - 2];
  const curr = history[history.length - 1];

  for (const ct of curr.tiers) {
    const pt = prev.tiers.find((t) => t.tier === ct.tier);
    if (!pt) continue;
    const prevMargin = calculateTierMargin(pt.tier, pt.avgUsage);
    const currMargin = calculateTierMargin(ct.tier, ct.avgUsage);

    if (prevMargin.grossMarginPercent > 0 && currMargin.grossMarginPercent < prevMargin.grossMarginPercent) {
      const change = ((currMargin.grossMarginPercent - prevMargin.grossMarginPercent) / prevMargin.grossMarginPercent) * 100;
      alerts.push({
        tier: ct.tier,
        metric: 'gross_margin_percent',
        previousValue: prevMargin.grossMarginPercent,
        currentValue: currMargin.grossMarginPercent,
        changePercent: change,
        severity: change < -20 ? 'critical' : 'warning',
      });
    }
  }
  return alerts;
}

/**
 * Build a comprehensive unit economics report.
 */
export function buildUnitEconomicsReport(tiers: TierEconomics[]): UnitEconomicsReport {
  const tierMargins = tiers.map((t) => calculateTierMargin(t.tier, t.avgUsage));
  const blended = calculateBlendedMetrics(tiers);
  const projections = projectScaling(tiers, 0.10, 12);

  return {
    generatedAt: new Date().toISOString(),
    tiers: tierMargins,
    blended,
    projections,
  };
}

/**
 * Format a unit economics report as a human-readable string.
 */
export function formatUnitEconomicsReport(report: UnitEconomicsReport): string {
  const lines: string[] = [
    '=== Unit Economics Report ===',
    `Generated: ${report.generatedAt}`,
    '',
    '--- Tier Margins ---',
  ];
  for (const t of report.tiers) {
    lines.push(`  ${t.tier}: revenue $${t.revenue.toFixed(2)} | cost $${t.cost.toFixed(2)} | margin ${t.grossMarginPercent.toFixed(1)}%`);
  }
  lines.push(
    '',
    '--- Blended Metrics ---',
    `  ARPU: $${report.blended.arpu.toFixed(2)}`,
    `  Blended margin: ${report.blended.blendedMarginPercent.toFixed(1)}%`,
    `  Est. LTV: $${report.blended.estimatedLtv.toFixed(2)}`,
    `  LTV/CAC ratio: ${report.blended.cacRatio.toFixed(1)}x`,
    `  Monthly revenue: $${report.blended.totalMonthlyRevenue.toFixed(2)}`,
    `  Monthly cost: $${report.blended.totalMonthlyCost.toFixed(2)}`,
    '',
    '--- 12-Month Projection ---',
  );
  for (const p of report.projections) {
    lines.push(`  M${p.month}: revenue $${p.revenue.toFixed(0)} | profit $${p.profit.toFixed(0)} | cumulative $${p.cumulativeProfit.toFixed(0)}`);
  }
  return lines.join('\n');
}
