/**
 * Q-227: Resource Usage Forecaster — cost trend analysis & alerts
 *
 * Analyses historical resource usage (DB rows, storage, API calls,
 * bandwidth) and projects future costs using linear regression.
 * Helps prevent surprise billing spikes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResourceType = "db_rows" | "storage_mb" | "api_calls" | "bandwidth_gb" | "edge_invocations";

export interface UsageSample {
  /** ISO date (day granularity) */
  date: string;
  value: number;
}

export interface ResourceUsage {
  type: ResourceType;
  unit: string;
  /** Historical daily samples */
  samples: UsageSample[];
  /** Current plan limit (null = unlimited) */
  planLimit: number | null;
  /** Cost per unit above free tier */
  costPerUnit: number;
  /** Free tier amount */
  freeTier: number;
}

export interface Forecast {
  type: ResourceType;
  /** Current daily average */
  currentAvg: number;
  /** Projected value in N days */
  projectedValue: number;
  /** Days until plan limit is reached (null = won't reach) */
  daysUntilLimit: number | null;
  /** Projected monthly cost */
  projectedMonthlyCost: number;
  /** Trend: daily growth rate */
  dailyGrowthRate: number;
  /** Confidence (R² of linear fit) */
  confidence: number;
  /** Alert level */
  alert: "none" | "info" | "warning" | "critical";
}

export interface CostForecastReport {
  forecasts: Forecast[];
  totalProjectedMonthlyCost: number;
  alerts: string[];
  timestamp: string;
  score: number;
  grade: string;
}

// ---------------------------------------------------------------------------
// Linear regression
// ---------------------------------------------------------------------------

/**
 * Simple linear regression: y = slope * x + intercept.
 * Returns slope, intercept, and R² (goodness of fit).
 */
export function linearRegression(
  points: Array<{ x: number; y: number }>
): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const yMean = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const { x, y } of points) {
    const predicted = slope * x + intercept;
    ssTot += (y - yMean) ** 2;
    ssRes += (y - predicted) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;

  return { slope, intercept, r2 };
}

// ---------------------------------------------------------------------------
// Forecasting
// ---------------------------------------------------------------------------

/**
 * Forecast a single resource's future usage.
 */
export function forecastResource(
  usage: ResourceUsage,
  forecastDays = 30
): Forecast {
  if (usage.samples.length < 2) {
    const current = usage.samples[0]?.value ?? 0;
    return {
      type: usage.type,
      currentAvg: current,
      projectedValue: current,
      daysUntilLimit: null,
      projectedMonthlyCost: calculateCost(current * 30, usage),
      dailyGrowthRate: 0,
      confidence: 0,
      alert: "none",
    };
  }

  // Convert dates to day indices
  const sorted = [...usage.samples].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const baseDate = new Date(sorted[0].date).getTime();
  const points = sorted.map((s) => ({
    x: (new Date(s.date).getTime() - baseDate) / (1000 * 60 * 60 * 24),
    y: s.value,
  }));

  const { slope, intercept, r2 } = linearRegression(points);

  const lastDay = points[points.length - 1].x;
  const currentAvg =
    sorted.slice(-7).reduce((s, p) => s + p.value, 0) /
    Math.min(7, sorted.length);
  const projectedValue = Math.max(0, slope * (lastDay + forecastDays) + intercept);

  // Days until limit
  let daysUntilLimit: number | null = null;
  if (usage.planLimit !== null && slope > 0) {
    const currentValue = slope * lastDay + intercept;
    if (currentValue < usage.planLimit) {
      daysUntilLimit = Math.ceil((usage.planLimit - currentValue) / slope);
    } else {
      daysUntilLimit = 0; // Already exceeded
    }
  }

  const projectedMonthlyCost = calculateCost(projectedValue * 30, usage);

  // Alert level
  let alert: Forecast["alert"] = "none";
  if (daysUntilLimit !== null) {
    if (daysUntilLimit <= 7) alert = "critical";
    else if (daysUntilLimit <= 14) alert = "warning";
    else if (daysUntilLimit <= 30) alert = "info";
  }
  if (slope > 0 && currentAvg > 0 && slope / currentAvg > 0.1) {
    // >10% daily growth is concerning
    alert = alert === "none" ? "warning" : alert;
  }

  return {
    type: usage.type,
    currentAvg: Math.round(currentAvg * 100) / 100,
    projectedValue: Math.round(projectedValue * 100) / 100,
    daysUntilLimit,
    projectedMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100,
    dailyGrowthRate: Math.round(slope * 1000) / 1000,
    confidence: Math.round(Math.max(0, r2) * 100) / 100,
    alert,
  };
}

/**
 * Build a full cost forecast report.
 */
export function buildCostForecastReport(
  usages: ResourceUsage[],
  forecastDays = 30
): CostForecastReport {
  const forecasts = usages.map((u) => forecastResource(u, forecastDays));
  const alerts: string[] = [];

  for (const f of forecasts) {
    if (f.alert === "critical") {
      alerts.push(
        `${f.type}: limit reached in ${f.daysUntilLimit ?? 0} days`
      );
    } else if (f.alert === "warning") {
      alerts.push(
        `${f.type}: approaching limit (${f.daysUntilLimit ?? "?"} days)`
      );
    }
  }

  const totalProjectedMonthlyCost = forecasts.reduce(
    (s, f) => s + f.projectedMonthlyCost,
    0
  );

  const criticalCount = forecasts.filter((f) => f.alert === "critical").length;
  const warningCount = forecasts.filter((f) => f.alert === "warning").length;
  const score = Math.max(
    0,
    100 - criticalCount * 25 - warningCount * 10
  );

  return {
    forecasts,
    totalProjectedMonthlyCost:
      Math.round(totalProjectedMonthlyCost * 100) / 100,
    alerts,
    timestamp: new Date().toISOString(),
    score,
    grade: scoreToGrade(score),
  };
}

/**
 * Format the cost forecast report.
 */
export function formatCostForecastReport(
  report: CostForecastReport
): string {
  const lines: string[] = [
    `Cost Forecast: ${report.score}/100 (${report.grade})`,
    `Total projected monthly cost: $${report.totalProjectedMonthlyCost}`,
  ];

  if (report.alerts.length > 0) {
    lines.push("", "Alerts:");
    for (const a of report.alerts) {
      lines.push(`  ${a}`);
    }
  }

  lines.push("", "Resources:");
  for (const f of report.forecasts) {
    lines.push(
      `  ${f.type}: avg=${f.currentAvg} → projected=${f.projectedValue} (${f.alert})`
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateCost(totalUsage: number, usage: ResourceUsage): number {
  const billable = Math.max(0, totalUsage - usage.freeTier);
  return billable * usage.costPerUnit;
}

function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
