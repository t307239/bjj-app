/**
 * cloudCostAnalyzer.ts — Cloud cost anomaly detection and optimization recommendations
 *
 * Pure-function utility for analyzing cloud service costs, detecting anomalies
 * using z-score analysis, calculating cost trends, suggesting optimizations,
 * and forecasting monthly expenses from partial data.
 *
 * @module Q-201
 * @since Q-201
 */

/* ---------- Types ---------- */

export type CloudService =
  | "compute"
  | "storage"
  | "database"
  | "cdn"
  | "api"
  | "email"
  | "push";

export interface CostEntry {
  readonly service: CloudService;
  readonly date: string;
  readonly amount: number;
  readonly currency: string;
  readonly description?: string;
}

export interface CostAnomaly {
  readonly service: CloudService;
  readonly date: string;
  readonly amount: number;
  readonly baseline: number;
  readonly deviation: number;
  readonly zScore: number;
  readonly type: "spike" | "drop";
  readonly severity: "critical" | "high" | "medium";
}

export interface CostTrend {
  readonly direction: "increasing" | "decreasing" | "stable";
  readonly ratePerDay: number;
  readonly ratePerMonth: number;
  readonly percentChange: number;
  readonly period: string;
}

export interface CostOptimization {
  readonly service: CloudService;
  readonly recommendation: string;
  readonly estimatedSavingsPercent: number;
  readonly estimatedSavingsAmount: number;
  readonly effort: "low" | "medium" | "high";
  readonly priority: "critical" | "high" | "medium" | "low";
}

export interface CostReport {
  readonly score: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly totalCost: number;
  readonly costByService: Record<string, number>;
  readonly anomalies: readonly CostAnomaly[];
  readonly trend: CostTrend;
  readonly optimizations: readonly CostOptimization[];
  readonly forecast: { readonly projected: number; readonly daysInMonth: number; readonly daysElapsed: number };
  readonly recommendations: readonly string[];
}

/* ---------- Constants ---------- */

/** Expected monthly cost baselines per service in USD */
export const COST_BASELINES: Record<CloudService, number> = {
  compute: 25,
  storage: 5,
  database: 25,
  cdn: 10,
  api: 5,
  email: 3,
  push: 2,
} as const;

/** Anomaly detection threshold — ratio above baseline */
export const ANOMALY_THRESHOLD = 1.5;

/** Optimization rules per service */
export const OPTIMIZATION_RULES: Record<
  CloudService,
  readonly { readonly condition: string; readonly recommendation: string; readonly savingsPercent: number; readonly effort: "low" | "medium" | "high" }[]
> = {
  compute: [
    { condition: "over_baseline", recommendation: "Review and right-size compute instances", savingsPercent: 20, effort: "medium" },
    { condition: "high_usage", recommendation: "Consider reserved instances for predictable workloads", savingsPercent: 30, effort: "low" },
  ],
  storage: [
    { condition: "over_baseline", recommendation: "Implement lifecycle policies for old data", savingsPercent: 25, effort: "low" },
    { condition: "high_usage", recommendation: "Move infrequently accessed data to cold storage", savingsPercent: 40, effort: "medium" },
  ],
  database: [
    { condition: "over_baseline", recommendation: "Optimize queries and add proper indexes", savingsPercent: 15, effort: "high" },
    { condition: "high_usage", recommendation: "Consider read replicas or connection pooling", savingsPercent: 20, effort: "medium" },
  ],
  cdn: [
    { condition: "over_baseline", recommendation: "Review cache-control headers to improve hit rate", savingsPercent: 30, effort: "low" },
    { condition: "high_usage", recommendation: "Compress assets and optimize image delivery", savingsPercent: 25, effort: "low" },
  ],
  api: [
    { condition: "over_baseline", recommendation: "Implement caching for frequent API calls", savingsPercent: 35, effort: "medium" },
    { condition: "high_usage", recommendation: "Batch API requests where possible", savingsPercent: 20, effort: "medium" },
  ],
  email: [
    { condition: "over_baseline", recommendation: "Review email send volume and reduce unnecessary notifications", savingsPercent: 30, effort: "low" },
  ],
  push: [
    { condition: "over_baseline", recommendation: "Consolidate push notifications to reduce volume", savingsPercent: 20, effort: "low" },
  ],
} as const;

/* ---------- Functions ---------- */

/**
 * Calculate mean and standard deviation of an array of numbers.
 */
function calcStats(values: readonly number[]): { readonly mean: number; readonly stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Detect cost anomalies using z-score analysis against baselines.
 */
export function detectCostAnomalies(
  entries: readonly CostEntry[],
  baselines: Record<string, number> = COST_BASELINES
): readonly CostAnomaly[] {
  const anomalies: CostAnomaly[] = [];

  // Group entries by service
  const byService = new Map<CloudService, CostEntry[]>();
  for (const entry of entries) {
    const list = byService.get(entry.service) ?? [];
    list.push(entry);
    byService.set(entry.service, list);
  }

  for (const [service, serviceEntries] of byService) {
    const amounts = serviceEntries.map((e) => e.amount);
    const { mean, stdDev } = calcStats(amounts);
    const baseline = baselines[service] ?? mean;

    for (const entry of serviceEntries) {
      const zScore = stdDev > 0 ? Math.round(((entry.amount - mean) / stdDev) * 100) / 100 : 0;
      const deviation = baseline > 0 ? Math.round(((entry.amount - baseline) / baseline) * 100) / 100 : 0;

      const isSpike = entry.amount > baseline * ANOMALY_THRESHOLD;
      const isDrop = entry.amount < baseline * (1 / ANOMALY_THRESHOLD) && entry.amount >= 0;

      if (isSpike || isDrop) {
        const severity = Math.abs(zScore) > 3 ? "critical" : Math.abs(zScore) > 2 ? "high" : "medium";
        anomalies.push({
          service,
          date: entry.date,
          amount: Math.round(entry.amount * 100) / 100,
          baseline: Math.round(baseline * 100) / 100,
          deviation,
          zScore,
          type: isSpike ? "spike" : "drop",
          severity,
        });
      }
    }
  }

  return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

/**
 * Calculate cost trend over a given time window.
 */
export function calculateCostTrend(
  entries: readonly CostEntry[],
  windowDays: number = 30
): CostTrend {
  if (entries.length < 2) {
    return { direction: "stable", ratePerDay: 0, ratePerMonth: 0, percentChange: 0, period: `${windowDays} days` };
  }

  // Sort by date
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Group by date and sum daily costs
  const dailyCosts = new Map<string, number>();
  for (const entry of sorted) {
    dailyCosts.set(entry.date, (dailyCosts.get(entry.date) ?? 0) + entry.amount);
  }

  const days = [...dailyCosts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (days.length < 2) {
    return { direction: "stable", ratePerDay: 0, ratePerMonth: 0, percentChange: 0, period: `${windowDays} days` };
  }

  // Linear regression (simple slope)
  const n = days.length;
  const xMean = (n - 1) / 2;
  const yMean = days.reduce((s, d) => s + d[1], 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (days[i][1] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const ratePerDay = Math.round(slope * 100) / 100;
  const ratePerMonth = Math.round(slope * 30 * 100) / 100;

  const firstTotal = days[0][1];
  const lastTotal = days[days.length - 1][1];
  const percentChange = firstTotal > 0
    ? Math.round(((lastTotal - firstTotal) / firstTotal) * 10000) / 100
    : 0;

  let direction: "increasing" | "decreasing" | "stable";
  if (Math.abs(percentChange) < 5) {
    direction = "stable";
  } else if (percentChange > 0) {
    direction = "increasing";
  } else {
    direction = "decreasing";
  }

  return { direction, ratePerDay, ratePerMonth, percentChange, period: `${windowDays} days` };
}

/**
 * Suggest cost optimizations based on entries and usage patterns.
 */
export function suggestOptimizations(
  entries: readonly CostEntry[],
  usage?: Record<string, number>
): readonly CostOptimization[] {
  const optimizations: CostOptimization[] = [];

  // Sum cost per service
  const costByService = new Map<CloudService, number>();
  for (const entry of entries) {
    costByService.set(entry.service, (costByService.get(entry.service) ?? 0) + entry.amount);
  }

  for (const [service, totalCost] of costByService) {
    const baseline = COST_BASELINES[service] ?? 0;
    const rules = OPTIMIZATION_RULES[service] ?? [];
    const isOverBaseline = totalCost > baseline * 1.2;
    const isHighUsage = (usage?.[service] ?? 0) > 80;

    for (const rule of rules) {
      if (
        (rule.condition === "over_baseline" && isOverBaseline) ||
        (rule.condition === "high_usage" && isHighUsage)
      ) {
        const savings = Math.round(totalCost * (rule.savingsPercent / 100) * 100) / 100;
        optimizations.push({
          service,
          recommendation: rule.recommendation,
          estimatedSavingsPercent: rule.savingsPercent,
          estimatedSavingsAmount: savings,
          effort: rule.effort,
          priority: savings > 20 ? "critical" : savings > 10 ? "high" : savings > 5 ? "medium" : "low",
        });
      }
    }
  }

  return optimizations.sort((a, b) => b.estimatedSavingsAmount - a.estimatedSavingsAmount);
}

/**
 * Forecast monthly cost from partial data.
 */
export function forecastMonthlyCost(
  entries: readonly CostEntry[],
  daysInMonth: number = 30
): { readonly projected: number; readonly daysElapsed: number; readonly daysInMonth: number } {
  if (entries.length === 0) {
    return { projected: 0, daysElapsed: 0, daysInMonth };
  }

  const uniqueDays = new Set(entries.map((e) => e.date));
  const daysElapsed = uniqueDays.size;
  const totalSoFar = entries.reduce((s, e) => s + e.amount, 0);

  if (daysElapsed === 0) {
    return { projected: 0, daysElapsed: 0, daysInMonth };
  }

  const dailyAvg = totalSoFar / daysElapsed;
  const projected = Math.round(dailyAvg * daysInMonth * 100) / 100;

  return { projected, daysElapsed, daysInMonth };
}

/**
 * Build a comprehensive cost report with anomalies, optimizations, and forecast.
 */
export function buildCostReport(
  entries: readonly CostEntry[],
  baselines: Record<string, number> = COST_BASELINES
): CostReport {
  const totalCost = Math.round(entries.reduce((s, e) => s + e.amount, 0) * 100) / 100;

  const costByService: Record<string, number> = {};
  for (const entry of entries) {
    costByService[entry.service] = Math.round(((costByService[entry.service] ?? 0) + entry.amount) * 100) / 100;
  }

  const anomalies = detectCostAnomalies(entries, baselines);
  const trend = calculateCostTrend(entries);
  const optimizations = suggestOptimizations(entries);
  const forecast = forecastMonthlyCost(entries);

  let score = 100;
  const recommendations: string[] = [];

  // Deduct for anomalies
  score -= anomalies.filter((a) => a.severity === "critical").length * 15;
  score -= anomalies.filter((a) => a.severity === "high").length * 8;
  score -= anomalies.filter((a) => a.severity === "medium").length * 3;

  // Deduct for trending up
  if (trend.direction === "increasing" && trend.percentChange > 20) {
    score -= 10;
    recommendations.push(`Costs increasing ${trend.percentChange}% — investigate root cause`);
  }

  // Deduct for over-forecast
  const expectedMonthly = Object.values(baselines).reduce((s, v) => s + v, 0);
  if (forecast.projected > expectedMonthly * 1.3) {
    score -= 10;
    recommendations.push(`Projected monthly ($${forecast.projected}) exceeds budget ($${expectedMonthly}) by ${Math.round(((forecast.projected - expectedMonthly) / expectedMonthly) * 100)}%`);
  }

  if (anomalies.length > 0) {
    recommendations.push(`${anomalies.length} cost anomaly(ies) detected — review for billing errors or unexpected usage`);
  }

  if (optimizations.length > 0) {
    const totalSavings = optimizations.reduce((s, o) => s + o.estimatedSavingsAmount, 0);
    recommendations.push(`Potential savings of $${Math.round(totalSavings * 100) / 100} identified across ${optimizations.length} optimization(s)`);
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    grade: finalScore >= 90 ? "A" : finalScore >= 80 ? "B" : finalScore >= 70 ? "C" : finalScore >= 60 ? "D" : "F",
    totalCost,
    costByService,
    anomalies,
    trend,
    optimizations,
    forecast,
    recommendations,
  };
}

/**
 * Format a cost report as a human-readable string.
 */
export function formatCostReport(report: CostReport): string {
  const lines: string[] = [
    "=== Cloud Cost Analysis Report ===",
    `Score: ${report.score}/100 (${report.grade})`,
    `Total Cost: $${report.totalCost}`,
    "",
    "Cost by Service:",
  ];

  for (const [service, cost] of Object.entries(report.costByService)) {
    const baseline = COST_BASELINES[service as CloudService] ?? 0;
    const pct = baseline > 0 ? Math.round((cost / baseline) * 100) : 0;
    lines.push(`  ${service}: $${cost} (${pct}% of baseline)`);
  }

  lines.push("", `Trend: ${report.trend.direction} (${report.trend.percentChange}% over ${report.trend.period})`);
  lines.push(`Forecast: $${report.forecast.projected}/month (${report.forecast.daysElapsed}/${report.forecast.daysInMonth} days elapsed)`);

  if (report.anomalies.length > 0) {
    lines.push("", `Anomalies (${report.anomalies.length}):`);
    for (const a of report.anomalies) {
      lines.push(`  [${a.severity.toUpperCase()}] ${a.service} ${a.type}: $${a.amount} (baseline $${a.baseline}, z=${a.zScore})`);
    }
  }

  if (report.optimizations.length > 0) {
    lines.push("", `Optimizations (${report.optimizations.length}):`);
    for (const o of report.optimizations) {
      lines.push(`  [${o.priority.toUpperCase()}] ${o.service}: ${o.recommendation} (save ~$${o.estimatedSavingsAmount}, effort: ${o.effort})`);
    }
  }

  if (report.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const rec of report.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }

  return lines.join("\n");
}
