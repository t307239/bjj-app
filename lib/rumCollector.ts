/**
 * rumCollector.ts — Real User Monitoring data collection & analysis
 *
 * Collects and aggregates RUM data per page, device type, and connection quality.
 * Enables page-level performance budgets and user-segmented analysis.
 *
 * Pure functions — no browser APIs.
 *
 * @module Q-190 Obs 95→97
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type ConnectionType = "4g" | "3g" | "2g" | "slow-2g" | "wifi" | "unknown";
export type DeviceType = "mobile" | "tablet" | "desktop";

export interface RUMEntry {
  readonly url: string;
  readonly metric: string;
  readonly value: number;
  readonly timestamp: number;
  readonly deviceType: DeviceType;
  readonly connectionType: ConnectionType;
  readonly country?: string;
  readonly userAgent?: string;
}

export interface PageMetrics {
  readonly path: string;
  readonly sampleCount: number;
  readonly metrics: Record<string, {
    readonly p50: number;
    readonly p75: number;
    readonly p95: number;
    readonly mean: number;
    readonly count: number;
  }>;
  readonly deviceBreakdown: Record<DeviceType, number>;
  readonly connectionBreakdown: Record<ConnectionType, number>;
}

export interface RUMBudget {
  readonly path: string;
  readonly metric: string;
  readonly maxP75: number;
}

export interface BudgetViolation {
  readonly path: string;
  readonly metric: string;
  readonly budget: number;
  readonly actual: number;
  readonly overagePercent: number;
}

export interface RUMDashboard {
  readonly totalEntries: number;
  readonly timeRange: { start: number; end: number };
  readonly pages: readonly PageMetrics[];
  readonly violations: readonly BudgetViolation[];
  readonly deviceSummary: Record<DeviceType, number>;
  readonly connectionSummary: Record<ConnectionType, number>;
  readonly overallHealth: "healthy" | "degraded" | "poor";
}

// ── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_BUDGETS: readonly RUMBudget[] = [
  { path: "/dashboard", metric: "LCP", maxP75: 2500 },
  { path: "/dashboard", metric: "CLS", maxP75: 0.1 },
  { path: "/dashboard", metric: "INP", maxP75: 200 },
  { path: "/records", metric: "LCP", maxP75: 2500 },
  { path: "/records", metric: "INP", maxP75: 200 },
  { path: "/techniques", metric: "LCP", maxP75: 3000 },
  { path: "/profile", metric: "LCP", maxP75: 2500 },
  { path: "/login", metric: "LCP", maxP75: 2000 },
  { path: "/login", metric: "FCP", maxP75: 1500 },
];

const DEVICE_PATTERNS: Record<DeviceType, RegExp> = {
  mobile: /Mobile|Android|iPhone|iPod/i,
  tablet: /iPad|Tablet|PlayBook/i,
  desktop: /./,
};

// ── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Classify device type from user agent string.
 */
export function classifyDevice(userAgent: string): DeviceType {
  if (DEVICE_PATTERNS.mobile.test(userAgent)) return "mobile";
  if (DEVICE_PATTERNS.tablet.test(userAgent)) return "tablet";
  return "desktop";
}

/**
 * Extract URL path from full URL.
 */
export function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Calculate percentile from sorted values.
 */
function calcPercentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/**
 * Build page-level metrics from entries.
 */
export function buildPageMetrics(
  path: string,
  entries: readonly RUMEntry[]
): PageMetrics {
  const pageEntries = entries.filter((e) => extractPath(e.url) === path);

  // Group by metric
  const metricGroups: Record<string, number[]> = {};
  const deviceCounts: Record<DeviceType, number> = { mobile: 0, tablet: 0, desktop: 0 };
  const connectionCounts: Record<ConnectionType, number> = {
    "4g": 0, "3g": 0, "2g": 0, "slow-2g": 0, wifi: 0, unknown: 0,
  };

  for (const entry of pageEntries) {
    if (!metricGroups[entry.metric]) metricGroups[entry.metric] = [];
    metricGroups[entry.metric].push(entry.value);
    deviceCounts[entry.deviceType] = (deviceCounts[entry.deviceType] || 0) + 1;
    connectionCounts[entry.connectionType] = (connectionCounts[entry.connectionType] || 0) + 1;
  }

  const metrics: Record<string, { p50: number; p75: number; p95: number; mean: number; count: number }> = {};

  for (const [name, values] of Object.entries(metricGroups)) {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    metrics[name] = {
      p50: Math.round(calcPercentile(sorted, 50) * 100) / 100,
      p75: Math.round(calcPercentile(sorted, 75) * 100) / 100,
      p95: Math.round(calcPercentile(sorted, 95) * 100) / 100,
      mean: Math.round((sum / sorted.length) * 100) / 100,
      count: sorted.length,
    };
  }

  return {
    path,
    sampleCount: pageEntries.length,
    metrics,
    deviceBreakdown: deviceCounts,
    connectionBreakdown: connectionCounts,
  };
}

/**
 * Check budget violations for a page.
 */
export function checkBudgetViolations(
  pageMetrics: PageMetrics,
  budgets: readonly RUMBudget[]
): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  for (const budget of budgets) {
    if (budget.path !== pageMetrics.path) continue;

    const metric = pageMetrics.metrics[budget.metric];
    if (!metric) continue;

    if (metric.p75 > budget.maxP75) {
      violations.push({
        path: budget.path,
        metric: budget.metric,
        budget: budget.maxP75,
        actual: metric.p75,
        overagePercent: Math.round(((metric.p75 - budget.maxP75) / budget.maxP75) * 100 * 10) / 10,
      });
    }
  }

  return violations;
}

/**
 * Build comprehensive RUM dashboard.
 */
export function buildRUMDashboard(
  entries: readonly RUMEntry[],
  budgets: readonly RUMBudget[] = DEFAULT_BUDGETS
): RUMDashboard {
  if (entries.length === 0) {
    return {
      totalEntries: 0,
      timeRange: { start: 0, end: 0 },
      pages: [],
      violations: [],
      deviceSummary: { mobile: 0, tablet: 0, desktop: 0 },
      connectionSummary: { "4g": 0, "3g": 0, "2g": 0, "slow-2g": 0, wifi: 0, unknown: 0 },
      overallHealth: "healthy",
    };
  }

  // Get unique paths
  const paths = [...new Set(entries.map((e) => extractPath(e.url)))];

  // Build per-page metrics
  const pages = paths.map((p) => buildPageMetrics(p, entries));

  // Check all budget violations
  const violations = pages.flatMap((p) => checkBudgetViolations(p, budgets));

  // Device & connection summary
  const deviceSummary: Record<DeviceType, number> = { mobile: 0, tablet: 0, desktop: 0 };
  const connectionSummary: Record<ConnectionType, number> = {
    "4g": 0, "3g": 0, "2g": 0, "slow-2g": 0, wifi: 0, unknown: 0,
  };

  for (const entry of entries) {
    deviceSummary[entry.deviceType] = (deviceSummary[entry.deviceType] || 0) + 1;
    connectionSummary[entry.connectionType] = (connectionSummary[entry.connectionType] || 0) + 1;
  }

  // Time range
  const timestamps = entries.map((e) => e.timestamp);
  const timeRange = {
    start: Math.min(...timestamps),
    end: Math.max(...timestamps),
  };

  // Health
  let overallHealth: "healthy" | "degraded" | "poor" = "healthy";
  if (violations.length > 3) overallHealth = "poor";
  else if (violations.length > 0) overallHealth = "degraded";

  return {
    totalEntries: entries.length,
    timeRange,
    pages,
    violations,
    deviceSummary,
    connectionSummary,
    overallHealth,
  };
}

/**
 * Segment entries by device type for comparative analysis.
 */
export function segmentByDevice(
  entries: readonly RUMEntry[]
): Record<DeviceType, RUMEntry[]> {
  const segments: Record<DeviceType, RUMEntry[]> = {
    mobile: [],
    tablet: [],
    desktop: [],
  };
  for (const entry of entries) {
    segments[entry.deviceType].push(entry);
  }
  return segments;
}

/**
 * Format RUM dashboard as human-readable string.
 */
export function formatRUMDashboard(dashboard: RUMDashboard): string {
  const lines = [
    `=== RUM Dashboard ===`,
    `Health: ${dashboard.overallHealth === "healthy" ? "✅" : dashboard.overallHealth === "degraded" ? "⚠️" : "❌"} ${dashboard.overallHealth}`,
    `Total entries: ${dashboard.totalEntries}`,
    "",
    "--- Pages ---",
  ];

  for (const page of dashboard.pages) {
    lines.push(`${page.path} (n=${page.sampleCount})`);
    for (const [name, m] of Object.entries(page.metrics)) {
      lines.push(`  ${name}: p50=${m.p50} p75=${m.p75} p95=${m.p95}`);
    }
  }

  if (dashboard.violations.length > 0) {
    lines.push("", "--- Budget Violations ---");
    for (const v of dashboard.violations) {
      lines.push(`❌ ${v.path} ${v.metric}: ${v.actual} > ${v.budget} (+${v.overagePercent}%)`);
    }
  }

  lines.push(
    "",
    "--- Device Split ---",
    `Mobile: ${dashboard.deviceSummary.mobile} | Tablet: ${dashboard.deviceSummary.tablet} | Desktop: ${dashboard.deviceSummary.desktop}`
  );

  return lines.join("\n");
}
