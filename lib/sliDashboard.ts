/**
 * sliDashboard.ts — SLI/SLO dashboard metrics aggregation
 *
 * Pure-function utility for tracking Service Level Indicators,
 * calculating error budgets, and generating SLO compliance reports.
 *
 * @module sliDashboard
 * @since Q-175
 */

/* ---------- Constants ---------- */

/** Standard SLO definitions for the BJJ App */
export const SLO_DEFINITIONS = {
  availability: {
    target: 99.9,
    unit: "percent",
    window: "30d",
    description: "Service uptime percentage",
  },
  latency_p95: {
    target: 2000,
    unit: "ms",
    window: "30d",
    description: "95th percentile response time",
  },
  latency_p99: {
    target: 5000,
    unit: "ms",
    window: "30d",
    description: "99th percentile response time",
  },
  error_rate: {
    target: 0.1,
    unit: "percent",
    window: "30d",
    description: "Server error rate (5xx)",
  },
  throughput: {
    target: 100,
    unit: "rpm",
    window: "1h",
    description: "Minimum requests per minute during peak",
  },
} as const;

export type SLOName = keyof typeof SLO_DEFINITIONS;

/** Alert thresholds as percentages of error budget consumed */
export const ERROR_BUDGET_ALERTS = {
  warning: 50,
  critical: 80,
  exhausted: 100,
} as const;

/* ---------- Types ---------- */

export interface SLIDataPoint {
  timestamp: string;
  value: number;
  sloName: SLOName;
}

export interface ErrorBudgetStatus {
  sloName: SLOName;
  target: number;
  current: number;
  budgetTotal: number;
  budgetConsumed: number;
  budgetRemaining: number;
  consumedPercent: number;
  status: "healthy" | "warning" | "critical" | "exhausted";
  burnRate: number;
  projectedExhaustionDays: number | null;
}

export interface SLOComplianceReport {
  windowStart: string;
  windowEnd: string;
  slos: ErrorBudgetStatus[];
  overallCompliance: boolean;
  worstSLO: SLOName | null;
  summary: string;
}

/* ---------- Core Functions ---------- */

/**
 * Calculate error budget status for an SLO
 */
export function calculateErrorBudget(
  sloName: SLOName,
  currentValue: number,
  windowDays: number = 30,
  elapsedDays: number = 30,
): ErrorBudgetStatus {
  const slo = SLO_DEFINITIONS[sloName];
  const target = slo.target;

  let budgetTotal: number;
  let budgetConsumed: number;

  if (sloName === "availability") {
    // For availability: budget = 100 - target (e.g., 0.1% downtime allowed)
    budgetTotal = 100 - target;
    budgetConsumed = Math.max(0, 100 - currentValue);
  } else if (sloName === "error_rate") {
    // For error rate: budget = target (max error rate allowed)
    budgetTotal = target;
    budgetConsumed = Math.max(0, currentValue);
  } else if (sloName === "throughput") {
    // For throughput: budget is inverse (below target = consuming budget)
    budgetTotal = target;
    budgetConsumed = Math.max(0, target - currentValue);
  } else {
    // For latency: budget = target (max latency allowed)
    budgetTotal = target;
    budgetConsumed = Math.max(0, currentValue);
  }

  const budgetRemaining = Math.max(0, budgetTotal - budgetConsumed);
  const consumedPercent = budgetTotal > 0 ? Math.round((budgetConsumed / budgetTotal) * 100) : 0;

  let status: ErrorBudgetStatus["status"];
  if (consumedPercent >= ERROR_BUDGET_ALERTS.exhausted) status = "exhausted";
  else if (consumedPercent >= ERROR_BUDGET_ALERTS.critical) status = "critical";
  else if (consumedPercent >= ERROR_BUDGET_ALERTS.warning) status = "warning";
  else status = "healthy";

  // Burn rate: how fast are we consuming the budget
  const burnRate = elapsedDays > 0 ? budgetConsumed / elapsedDays : 0;

  // Projected exhaustion
  const projectedExhaustionDays =
    burnRate > 0 && budgetRemaining > 0
      ? Math.round(budgetRemaining / burnRate)
      : burnRate > 0
        ? 0
        : null;

  return {
    sloName,
    target,
    current: currentValue,
    budgetTotal,
    budgetConsumed,
    budgetRemaining,
    consumedPercent,
    status,
    burnRate,
    projectedExhaustionDays,
  };
}

/**
 * Calculate percentile from array of values
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Aggregate SLI data points into summary metrics
 */
export function aggregateSLIMetrics(
  dataPoints: SLIDataPoint[],
): Record<SLOName, { avg: number; min: number; max: number; p95: number; count: number }> {
  const grouped: Partial<Record<SLOName, number[]>> = {};

  for (const dp of dataPoints) {
    if (!grouped[dp.sloName]) grouped[dp.sloName] = [];
    grouped[dp.sloName]!.push(dp.value);
  }

  const result = {} as Record<SLOName, { avg: number; min: number; max: number; p95: number; count: number }>;

  for (const [name, values] of Object.entries(grouped)) {
    if (!values || values.length === 0) continue;
    const sum = values.reduce((a, b) => a + b, 0);
    result[name as SLOName] = {
      avg: Math.round((sum / values.length) * 100) / 100,
      min: Math.min(...values),
      max: Math.max(...values),
      p95: calculatePercentile(values, 95),
      count: values.length,
    };
  }

  return result;
}

/**
 * Generate SLO compliance report
 */
export function generateComplianceReport(
  budgets: ErrorBudgetStatus[],
  windowStart: string,
  windowEnd: string,
): SLOComplianceReport {
  const overallCompliance = budgets.every((b) => b.status !== "exhausted");

  let worstSLO: SLOName | null = null;
  let worstConsumed = -1;
  for (const b of budgets) {
    if (b.consumedPercent > worstConsumed) {
      worstConsumed = b.consumedPercent;
      worstSLO = b.sloName;
    }
  }

  const exhaustedCount = budgets.filter((b) => b.status === "exhausted").length;
  const criticalCount = budgets.filter((b) => b.status === "critical").length;
  const healthyCount = budgets.filter((b) => b.status === "healthy").length;

  let summary: string;
  if (exhaustedCount > 0) {
    summary = `${exhaustedCount} SLO(s) have exhausted their error budget. Immediate action required.`;
  } else if (criticalCount > 0) {
    summary = `${criticalCount} SLO(s) in critical state. Monitor closely.`;
  } else if (healthyCount === budgets.length) {
    summary = "All SLOs are healthy and within budget.";
  } else {
    summary = `${healthyCount}/${budgets.length} SLOs healthy. Some approaching budget limits.`;
  }

  return {
    windowStart,
    windowEnd,
    slos: budgets,
    overallCompliance,
    worstSLO,
    summary,
  };
}

/**
 * Detect SLO violations from time-series data
 */
export function detectSLOViolations(
  dataPoints: SLIDataPoint[],
): Array<{ sloName: SLOName; timestamp: string; value: number; threshold: number }> {
  const violations: Array<{ sloName: SLOName; timestamp: string; value: number; threshold: number }> = [];

  for (const dp of dataPoints) {
    const slo = SLO_DEFINITIONS[dp.sloName];
    let violated = false;

    if (dp.sloName === "availability") {
      violated = dp.value < slo.target;
    } else if (dp.sloName === "throughput") {
      violated = dp.value < slo.target;
    } else {
      // latency, error_rate: value exceeding target is a violation
      violated = dp.value > slo.target;
    }

    if (violated) {
      violations.push({
        sloName: dp.sloName,
        timestamp: dp.timestamp,
        value: dp.value,
        threshold: slo.target,
      });
    }
  }

  return violations;
}

/* ---------- Formatting ---------- */

export function formatComplianceReport(report: SLOComplianceReport): string {
  const lines: string[] = [
    "=== SLO Compliance Report ===",
    "",
    `Window: ${report.windowStart} — ${report.windowEnd}`,
    `Overall: ${report.overallCompliance ? "COMPLIANT" : "NON-COMPLIANT"}`,
    `Summary: ${report.summary}`,
    "",
    "SLO Status:",
  ];

  for (const slo of report.slos) {
    const icon =
      slo.status === "healthy" ? "✅" :
      slo.status === "warning" ? "⚠️" :
      slo.status === "critical" ? "🔴" : "💀";
    lines.push(
      `  ${icon} ${slo.sloName}: ${slo.consumedPercent}% budget consumed (${slo.status})` +
      (slo.projectedExhaustionDays !== null ? ` — exhaustion in ~${slo.projectedExhaustionDays}d` : ""),
    );
  }

  return lines.join("\n");
}
