/**
 * webVitalsAnalyzer.ts — Real User Monitoring & Core Web Vitals analysis
 *
 * Provides CWV budget enforcement, performance regression detection,
 * and RUM data aggregation for monitoring real user experience.
 *
 * Pure functions — no browser APIs. Works on metric arrays.
 *
 * @module Q-187 Performance 95→97
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type MetricName = "LCP" | "FID" | "CLS" | "INP" | "FCP" | "TTFB";

export interface WebVitalEntry {
  readonly name: MetricName;
  readonly value: number;
  readonly rating: "good" | "needs-improvement" | "poor";
  readonly url: string;
  readonly timestamp: number;
}

export interface CWVBudget {
  readonly good: number;
  readonly needsImprovement: number;
}

export interface MetricDistribution {
  readonly name: MetricName;
  readonly p50: number;
  readonly p75: number;
  readonly p95: number;
  readonly p99: number;
  readonly mean: number;
  readonly count: number;
  readonly goodPercent: number;
  readonly poorPercent: number;
}

export interface PerformanceRegression {
  readonly metric: MetricName;
  readonly before: number;
  readonly after: number;
  readonly changePercent: number;
  readonly severity: "minor" | "moderate" | "critical";
}

export interface RUMReport {
  readonly distributions: readonly MetricDistribution[];
  readonly overallScore: number;
  readonly grade: string;
  readonly regressions: readonly PerformanceRegression[];
  readonly recommendations: readonly string[];
  readonly totalEntries: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Google CWV thresholds (ms for timing, unitless for CLS) */
export const CWV_BUDGETS: Record<MetricName, CWVBudget> = {
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  INP: { good: 200, needsImprovement: 500 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

/** Core Web Vitals (used for overall scoring) */
export const CORE_METRICS: readonly MetricName[] = ["LCP", "CLS", "INP"];

/** Regression thresholds (percent change) */
const REGRESSION_THRESHOLDS = {
  minor: 10,
  moderate: 25,
  critical: 50,
} as const;

// ── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Rate a single metric value against CWV budgets.
 */
export function rateMetric(name: MetricName, value: number): "good" | "needs-improvement" | "poor" {
  const budget = CWV_BUDGETS[name];
  if (value <= budget.good) return "good";
  if (value <= budget.needsImprovement) return "needs-improvement";
  return "poor";
}

/**
 * Calculate percentile from sorted array.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/**
 * Build distribution statistics for a single metric.
 */
export function buildMetricDistribution(
  name: MetricName,
  entries: readonly WebVitalEntry[]
): MetricDistribution {
  const values = entries
    .filter((e) => e.name === name)
    .map((e) => e.value)
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return {
      name,
      p50: 0,
      p75: 0,
      p95: 0,
      p99: 0,
      mean: 0,
      count: 0,
      goodPercent: 0,
      poorPercent: 0,
    };
  }

  const budget = CWV_BUDGETS[name];
  const good = values.filter((v) => v <= budget.good).length;
  const poor = values.filter((v) => v > budget.needsImprovement).length;
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    name,
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    mean: Math.round((sum / values.length) * 100) / 100,
    count: values.length,
    goodPercent: Math.round((good / values.length) * 100 * 10) / 10,
    poorPercent: Math.round((poor / values.length) * 100 * 10) / 10,
  };
}

/**
 * Detect performance regressions by comparing two metric sets.
 */
export function detectRegressions(
  before: readonly WebVitalEntry[],
  after: readonly WebVitalEntry[]
): PerformanceRegression[] {
  const regressions: PerformanceRegression[] = [];
  const metrics: MetricName[] = ["LCP", "FID", "CLS", "INP", "FCP", "TTFB"];

  for (const metric of metrics) {
    const beforeDist = buildMetricDistribution(metric, before);
    const afterDist = buildMetricDistribution(metric, after);

    if (beforeDist.count === 0 || afterDist.count === 0) continue;

    const beforeVal = beforeDist.p75;
    const afterVal = afterDist.p75;

    if (beforeVal === 0) continue;

    const changePercent = ((afterVal - beforeVal) / beforeVal) * 100;

    if (changePercent > REGRESSION_THRESHOLDS.minor) {
      let severity: "minor" | "moderate" | "critical" = "minor";
      if (changePercent > REGRESSION_THRESHOLDS.critical) severity = "critical";
      else if (changePercent > REGRESSION_THRESHOLDS.moderate) severity = "moderate";

      regressions.push({
        metric,
        before: beforeVal,
        after: afterVal,
        changePercent: Math.round(changePercent * 10) / 10,
        severity,
      });
    }
  }

  return regressions;
}

/**
 * Calculate overall RUM score (0-100) based on Core Web Vitals.
 * Uses Google's "75th percentile at origin" methodology.
 */
export function calculateRUMScore(distributions: readonly MetricDistribution[]): number {
  const coreDistributions = distributions.filter((d) =>
    CORE_METRICS.includes(d.name)
  );

  if (coreDistributions.length === 0) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  for (const dist of coreDistributions) {
    if (dist.count === 0) continue;

    const budget = CWV_BUDGETS[dist.name];
    const p75 = dist.p75;

    let metricScore: number;
    if (p75 <= budget.good) {
      metricScore = 90 + 10 * (1 - p75 / budget.good);
    } else if (p75 <= budget.needsImprovement) {
      const range = budget.needsImprovement - budget.good;
      metricScore = 50 + 40 * (1 - (p75 - budget.good) / range);
    } else {
      metricScore = Math.max(0, 50 * (1 - (p75 - budget.needsImprovement) / budget.needsImprovement));
    }

    totalScore += metricScore;
    totalWeight += 1;
  }

  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
}

/**
 * Generate recommendations based on metric distributions.
 */
export function generateRecommendations(
  distributions: readonly MetricDistribution[]
): string[] {
  const recommendations: string[] = [];

  for (const dist of distributions) {
    if (dist.count === 0) continue;

    const budget = CWV_BUDGETS[dist.name];

    if (dist.p75 > budget.needsImprovement) {
      switch (dist.name) {
        case "LCP":
          recommendations.push("LCP is poor: optimize largest image/text, use preload for hero images, reduce server response time");
          break;
        case "CLS":
          recommendations.push("CLS is poor: set explicit dimensions on images/videos, avoid inserting content above existing content");
          break;
        case "INP":
          recommendations.push("INP is poor: break up long tasks, use requestIdleCallback, optimize event handlers");
          break;
        case "FCP":
          recommendations.push("FCP is poor: reduce render-blocking resources, inline critical CSS, preconnect to origins");
          break;
        case "TTFB":
          recommendations.push("TTFB is poor: use CDN, optimize server response, enable compression");
          break;
      }
    } else if (dist.p75 > budget.good) {
      recommendations.push(`${dist.name} needs improvement (p75: ${dist.p75}). Target: ≤${budget.good}`);
    }

    if (dist.poorPercent > 10) {
      recommendations.push(`${dist.name}: ${dist.poorPercent}% of users experience poor performance — investigate outliers`);
    }
  }

  return recommendations;
}

/**
 * Score grade from numeric score.
 */
function scoreToGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 50) return "D";
  return "F";
}

/**
 * Build comprehensive RUM report.
 */
export function buildRUMReport(
  entries: readonly WebVitalEntry[],
  previousEntries?: readonly WebVitalEntry[]
): RUMReport {
  const allMetrics: MetricName[] = ["LCP", "FID", "CLS", "INP", "FCP", "TTFB"];
  const distributions = allMetrics.map((m) => buildMetricDistribution(m, entries));
  const overallScore = calculateRUMScore(distributions);
  const regressions = previousEntries
    ? detectRegressions(previousEntries, entries)
    : [];
  const recommendations = generateRecommendations(distributions);

  return {
    distributions,
    overallScore,
    grade: scoreToGrade(overallScore),
    regressions,
    recommendations,
    totalEntries: entries.length,
  };
}

/**
 * Group entries by URL path for page-level analysis.
 */
export function groupByPage(
  entries: readonly WebVitalEntry[]
): Record<string, WebVitalEntry[]> {
  const groups: Record<string, WebVitalEntry[]> = {};
  for (const entry of entries) {
    try {
      const url = new URL(entry.url);
      const path = url.pathname;
      if (!groups[path]) groups[path] = [];
      groups[path].push(entry);
    } catch {
      // skip invalid URLs
    }
  }
  return groups;
}

/**
 * Format RUM report as human-readable string.
 */
export function formatRUMReport(report: RUMReport): string {
  const lines: string[] = [
    `=== RUM Performance Report ===`,
    `Score: ${report.overallScore}/100 (${report.grade})`,
    `Total entries: ${report.totalEntries}`,
    "",
    "--- Metric Distributions ---",
  ];

  for (const dist of report.distributions) {
    if (dist.count === 0) continue;
    const budget = CWV_BUDGETS[dist.name];
    const status = dist.p75 <= budget.good ? "✅" : dist.p75 <= budget.needsImprovement ? "⚠️" : "❌";
    lines.push(
      `${status} ${dist.name}: p50=${dist.p75 <= 1 ? dist.p50.toFixed(3) : Math.round(dist.p50)} p75=${dist.p75 <= 1 ? dist.p75.toFixed(3) : Math.round(dist.p75)} p95=${dist.p95 <= 1 ? dist.p95.toFixed(3) : Math.round(dist.p95)} (${dist.goodPercent}% good, ${dist.poorPercent}% poor, n=${dist.count})`
    );
  }

  if (report.regressions.length > 0) {
    lines.push("", "--- Regressions ---");
    for (const reg of report.regressions) {
      lines.push(`⚠️ ${reg.metric}: +${reg.changePercent}% (${reg.severity}) ${reg.before}→${reg.after}`);
    }
  }

  if (report.recommendations.length > 0) {
    lines.push("", "--- Recommendations ---");
    for (const rec of report.recommendations) {
      lines.push(`• ${rec}`);
    }
  }

  return lines.join("\n");
}
