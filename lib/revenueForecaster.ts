/**
 * Q-184: Revenue Forecaster (Cost 94→95)
 *
 * MRR/ARR forecasting, cohort-based revenue projection, churn impact modeling,
 * and pricing sensitivity analysis for SaaS-grade cost management.
 */

// ── Types & Constants ──────────────────────────────────────

export interface RevenueSnapshot {
  month: string; // YYYY-MM
  mrr: number;
  newMRR: number;
  expansionMRR: number;
  churnedMRR: number;
  totalCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
}

export interface ForecastParams {
  currentMRR: number;
  monthlyGrowthRate: number;   // e.g. 0.05 = 5%
  monthlyChurnRate: number;    // e.g. 0.03 = 3%
  expansionRate: number;       // e.g. 0.02 = 2%
  avgRevenuePerUser: number;
  currentCustomers: number;
  months: number;
}

export interface ForecastResult {
  months: ForecastMonth[];
  endMRR: number;
  endARR: number;
  totalRevenue: number;
  avgGrowthRate: number;
  netRevenueRetention: number;
  summary: string;
}

export interface ForecastMonth {
  month: number;
  mrr: number;
  arr: number;
  customers: number;
  newRevenue: number;
  churnedRevenue: number;
  expansionRevenue: number;
  cumulativeRevenue: number;
}

export interface PricingSensitivity {
  pricePoint: number;
  expectedConversion: number;
  projectedMRR: number;
  projectedCustomers: number;
  elasticity: number;
}

export const BENCHMARK_SAAS = {
  goodChurnRate: 0.05,      // < 5% monthly
  greatChurnRate: 0.02,     // < 2% monthly
  goodNRR: 1.0,             // 100%+
  greatNRR: 1.2,            // 120%+
  goodGrowthRate: 0.1,      // 10%+ MoM
} as const;

// ── Forecasting ────────────────────────────────────────────

/**
 * Generate monthly revenue forecast
 */
export function forecastRevenue(params: ForecastParams): ForecastResult {
  const months: ForecastMonth[] = [];
  let mrr = params.currentMRR;
  let customers = params.currentCustomers;
  let cumulativeRevenue = 0;

  for (let i = 1; i <= params.months; i++) {
    const newRevenue = mrr * params.monthlyGrowthRate;
    const churnedRevenue = mrr * params.monthlyChurnRate;
    const expansionRevenue = mrr * params.expansionRate;

    mrr = mrr + newRevenue - churnedRevenue + expansionRevenue;
    mrr = Math.max(0, mrr);

    const newCustomers = Math.round(newRevenue / Math.max(1, params.avgRevenuePerUser));
    const churnedCustomers = Math.round(churnedRevenue / Math.max(1, params.avgRevenuePerUser));
    customers = Math.max(0, customers + newCustomers - churnedCustomers);

    cumulativeRevenue += mrr;

    months.push({
      month: i,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      customers,
      newRevenue: Math.round(newRevenue * 100) / 100,
      churnedRevenue: Math.round(churnedRevenue * 100) / 100,
      expansionRevenue: Math.round(expansionRevenue * 100) / 100,
      cumulativeRevenue: Math.round(cumulativeRevenue * 100) / 100,
    });
  }

  const endMRR = months.length > 0 ? months[months.length - 1].mrr : params.currentMRR;
  const endARR = endMRR * 12;
  const avgGrowthRate =
    params.months > 0
      ? Math.pow(endMRR / Math.max(1, params.currentMRR), 1 / params.months) - 1
      : 0;
  const netRevenueRetention =
    params.monthlyChurnRate > 0
      ? (1 - params.monthlyChurnRate + params.expansionRate)
      : 1;

  return {
    months,
    endMRR: Math.round(endMRR * 100) / 100,
    endARR: Math.round(endARR * 100) / 100,
    totalRevenue: Math.round(cumulativeRevenue * 100) / 100,
    avgGrowthRate: Math.round(avgGrowthRate * 10000) / 10000,
    netRevenueRetention: Math.round(netRevenueRetention * 10000) / 10000,
    summary: `Forecast: MRR $${params.currentMRR} → $${Math.round(endMRR)} over ${params.months}mo (NRR: ${Math.round(netRevenueRetention * 100)}%)`,
  };
}

/**
 * Calculate Net Revenue Retention from snapshots
 */
export function calculateNRR(
  startMRR: number,
  expansionMRR: number,
  churnedMRR: number
): number {
  if (startMRR === 0) return 0;
  return (startMRR + expansionMRR - churnedMRR) / startMRR;
}

/**
 * Calculate MRR growth rate between two periods
 */
export function calculateGrowthRate(
  previousMRR: number,
  currentMRR: number
): number {
  if (previousMRR === 0) return currentMRR > 0 ? 1 : 0;
  return (currentMRR - previousMRR) / previousMRR;
}

/**
 * Analyze pricing sensitivity
 */
export function analyzePricingSensitivity(
  basePricePoint: number,
  baseConversion: number,
  priceElasticity: number,
  totalLeads: number,
  pricePoints: number[]
): PricingSensitivity[] {
  return pricePoints.map((price) => {
    const priceChange = (price - basePricePoint) / basePricePoint;
    const conversionChange = priceChange * priceElasticity;
    const expectedConversion = Math.max(
      0,
      Math.min(1, baseConversion * (1 + conversionChange))
    );
    const projectedCustomers = Math.round(totalLeads * expectedConversion);
    const projectedMRR = projectedCustomers * price;

    return {
      pricePoint: price,
      expectedConversion: Math.round(expectedConversion * 10000) / 10000,
      projectedMRR: Math.round(projectedMRR * 100) / 100,
      projectedCustomers,
      elasticity: priceElasticity,
    };
  });
}

/**
 * Evaluate revenue health against SaaS benchmarks
 */
export function evaluateRevenueHealth(
  monthlyChurnRate: number,
  nrr: number,
  growthRate: number
): { metric: string; value: number; benchmark: string; status: "good" | "warning" | "critical" }[] {
  return [
    {
      metric: "Monthly Churn Rate",
      value: monthlyChurnRate,
      benchmark: `< ${BENCHMARK_SAAS.goodChurnRate * 100}%`,
      status:
        monthlyChurnRate <= BENCHMARK_SAAS.greatChurnRate
          ? "good"
          : monthlyChurnRate <= BENCHMARK_SAAS.goodChurnRate
          ? "warning"
          : "critical",
    },
    {
      metric: "Net Revenue Retention",
      value: nrr,
      benchmark: `> ${BENCHMARK_SAAS.goodNRR * 100}%`,
      status:
        nrr >= BENCHMARK_SAAS.greatNRR
          ? "good"
          : nrr >= BENCHMARK_SAAS.goodNRR
          ? "warning"
          : "critical",
    },
    {
      metric: "MoM Growth Rate",
      value: growthRate,
      benchmark: `> ${BENCHMARK_SAAS.goodGrowthRate * 100}%`,
      status: growthRate >= BENCHMARK_SAAS.goodGrowthRate ? "good" : growthRate >= 0 ? "warning" : "critical",
    },
  ];
}

/**
 * Format forecast result as readable string
 */
export function formatForecast(result: ForecastResult): string {
  const lines = [
    `# Revenue Forecast`,
    result.summary,
    `Total Revenue: $${result.totalRevenue}`,
    `NRR: ${Math.round(result.netRevenueRetention * 100)}%`,
    ``,
    `| Month | MRR | Customers | New | Churned |`,
    `|-------|-----|-----------|-----|---------|`,
  ];
  for (const m of result.months) {
    lines.push(
      `| ${m.month} | $${m.mrr} | ${m.customers} | +$${m.newRevenue} | -$${m.churnedRevenue} |`
    );
  }
  return lines.join("\n");
}
