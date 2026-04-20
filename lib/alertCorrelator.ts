/**
 * alertCorrelator.ts
 *
 * Correlates alerts to reduce noise and find root causes.
 * Groups related alerts by time window and shared tags, identifies the
 * most likely root cause in each cluster, calculates alert fatigue
 * metrics, and suggests consolidation strategies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = 'critical' | 'warning' | 'info';

/** A single alert event. */
export type Alert = {
  id: string;
  source: string;
  severity: AlertSeverity;
  /** Unix epoch ms */
  timestamp: number;
  message: string;
  /** Key-value tags for correlation (e.g. service, endpoint, error_code) */
  tags: Record<string, string>;
};

/** A group of correlated alerts. */
export type AlertCluster = {
  id: string;
  alerts: Alert[];
  /** Tags shared by every alert in the cluster */
  sharedTags: Record<string, string>;
  /** Highest severity in the cluster */
  maxSeverity: AlertSeverity;
  /** Earliest timestamp */
  startTime: number;
  /** Latest timestamp */
  endTime: number;
};

/** Root cause analysis for a cluster. */
export type RootCauseAnalysis = {
  clusterId: string;
  /** The alert most likely to be the root cause */
  rootAlert: Alert;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  /** Number of downstream alerts attributed to this root cause */
  downstreamCount: number;
};

export type FatigueReport = {
  windowDays: number;
  totalAlerts: number;
  alertsPerDay: number;
  /** Ratio of info/duplicate alerts to total */
  noiseRatio: number;
  /** Estimated percentage of alerts that require human action */
  actionablePercent: number;
  grade: string;
};

export type Consolidation = {
  /** Suggested new alert name */
  name: string;
  /** Alert IDs that should be merged */
  mergeIds: string[];
  /** Alerts that can be suppressed entirely */
  suppressIds: string[];
  reason: string;
};

export type CorrelationReport = {
  generatedAt: number;
  totalAlerts: number;
  clusterCount: number;
  clusters: AlertCluster[];
  rootCauses: RootCauseAnalysis[];
  noiseReductionPercent: number;
  consolidations: Consolidation[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default correlation parameters. */
export const CORRELATION_WINDOWS = {
  /** Time window for grouping related alerts (ms) */
  time: 300_000,
  /** Tag keys used for correlation */
  tags: ['service', 'endpoint', 'error_code'] as readonly string[],
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 2,
  warning: 1,
  info: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maxSeverity(alerts: Alert[]): AlertSeverity {
  let max: AlertSeverity = 'info';
  for (const a of alerts) {
    if (SEVERITY_ORDER[a.severity] > SEVERITY_ORDER[max]) {
      max = a.severity;
    }
  }
  return max;
}

function sharedTags(alerts: Alert[]): Record<string, string> {
  if (alerts.length === 0) return {};
  const first = alerts[0].tags;
  const shared: Record<string, string> = {};
  for (const key of CORRELATION_WINDOWS.tags) {
    const val = first[key];
    if (val !== undefined && alerts.every((a) => a.tags[key] === val)) {
      shared[key] = val;
    }
  }
  return shared;
}

function tagOverlap(a: Alert, b: Alert): number {
  let overlap = 0;
  for (const key of CORRELATION_WINDOWS.tags) {
    if (a.tags[key] !== undefined && a.tags[key] === b.tags[key]) {
      overlap++;
    }
  }
  return overlap;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Group related alerts by time window and shared tags.
 * Alerts within `CORRELATION_WINDOWS.time` ms of each other that share
 * at least one correlation tag are placed in the same cluster.
 */
export function correlateAlerts(alerts: Alert[]): AlertCluster[] {
  if (alerts.length === 0) return [];

  const sorted = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
  const assigned = new Set<string>();
  const clusters: AlertCluster[] = [];
  let clusterIdx = 0;

  for (const alert of sorted) {
    if (assigned.has(alert.id)) continue;

    const cluster: Alert[] = [alert];
    assigned.add(alert.id);

    for (const candidate of sorted) {
      if (assigned.has(candidate.id)) continue;
      const withinWindow =
        Math.abs(candidate.timestamp - alert.timestamp) <= CORRELATION_WINDOWS.time;
      if (withinWindow && tagOverlap(alert, candidate) >= 1) {
        cluster.push(candidate);
        assigned.add(candidate.id);
      }
    }

    clusters.push({
      id: `cluster-${clusterIdx++}`,
      alerts: cluster,
      sharedTags: sharedTags(cluster),
      maxSeverity: maxSeverity(cluster),
      startTime: cluster[0].timestamp,
      endTime: cluster[cluster.length - 1].timestamp,
    });
  }

  return clusters;
}

/**
 * Identify the most likely root cause in a cluster.
 * Heuristic: earliest alert with the highest severity is most likely
 * the trigger. Confidence is based on cluster size and tag overlap.
 */
export function identifyRootCause(cluster: AlertCluster): RootCauseAnalysis {
  const sorted = [...cluster.alerts].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    return sevDiff !== 0 ? sevDiff : a.timestamp - b.timestamp;
  });

  const root = sorted[0];
  const downstream = cluster.alerts.length - 1;

  let confidence: 'high' | 'medium' | 'low';
  if (downstream >= 3 && Object.keys(cluster.sharedTags).length >= 2) {
    confidence = 'high';
  } else if (downstream >= 1) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    clusterId: cluster.id,
    rootAlert: root,
    confidence,
    reasoning:
      `Earliest ${root.severity} alert in cluster (${cluster.alerts.length} alerts). ` +
      `Shared tags: ${Object.entries(cluster.sharedTags).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}.`,
    downstreamCount: downstream,
  };
}

/**
 * Calculate alert fatigue metrics over a given window.
 * Returns alerts/day, noise ratio, and an actionable percentage.
 */
export function calculateAlertFatigue(
  alerts: Alert[],
  windowDays: number,
): FatigueReport {
  const total = alerts.length;
  const perDay = windowDays > 0 ? Math.round((total / windowDays) * 100) / 100 : total;

  const infoCount = alerts.filter((a) => a.severity === 'info').length;
  const noiseRatio = total > 0 ? Math.round((infoCount / total) * 100) / 100 : 0;
  const actionablePercent = Math.round((1 - noiseRatio) * 100);

  let grade: string;
  if (perDay <= 5 && noiseRatio <= 0.2) grade = 'A';
  else if (perDay <= 15 && noiseRatio <= 0.4) grade = 'B';
  else if (perDay <= 30 && noiseRatio <= 0.6) grade = 'C';
  else if (perDay <= 60) grade = 'D';
  else grade = 'F';

  return { windowDays, totalAlerts: total, alertsPerDay: perDay, noiseRatio, actionablePercent, grade };
}

/**
 * Suggest alert consolidation: which alerts to merge or suppress.
 */
export function suggestAlertConsolidation(clusters: AlertCluster[]): Consolidation[] {
  const consolidations: Consolidation[] = [];

  for (const cluster of clusters) {
    if (cluster.alerts.length < 2) continue;

    const tagStr = Object.entries(cluster.sharedTags)
      .map(([k, v]) => `${k}:${v}`)
      .join('-');
    const name = tagStr ? `consolidated-${tagStr}` : `consolidated-${cluster.id}`;

    const infoAlerts = cluster.alerts.filter((a) => a.severity === 'info');
    const nonInfoAlerts = cluster.alerts.filter((a) => a.severity !== 'info');

    consolidations.push({
      name,
      mergeIds: nonInfoAlerts.map((a) => a.id),
      suppressIds: infoAlerts.map((a) => a.id),
      reason:
        `${cluster.alerts.length} related alerts within ${CORRELATION_WINDOWS.time / 1000}s. ` +
        `${infoAlerts.length} info-level alerts can be suppressed.`,
    });
  }

  return consolidations;
}

/**
 * Build a full correlation report from raw alerts.
 */
export function buildCorrelationReport(alerts: Alert[]): CorrelationReport {
  const clusters = correlateAlerts(alerts);
  const rootCauses = clusters.map(identifyRootCause);
  const consolidations = suggestAlertConsolidation(clusters);

  const suppressedCount = consolidations.reduce(
    (sum, c) => sum + c.suppressIds.length,
    0,
  );
  const noiseReductionPercent =
    alerts.length > 0
      ? Math.round((suppressedCount / alerts.length) * 100 * 100) / 100
      : 0;

  return {
    generatedAt: Date.now(),
    totalAlerts: alerts.length,
    clusterCount: clusters.length,
    clusters,
    rootCauses,
    noiseReductionPercent,
    consolidations,
  };
}

/**
 * Format a correlation report as a human-readable string.
 */
export function formatCorrelationReport(report: CorrelationReport): string {
  const lines: string[] = [
    '=== Alert Correlation Report ===',
    `Generated: ${new Date(report.generatedAt).toISOString()}`,
    `Total alerts: ${report.totalAlerts}`,
    `Clusters: ${report.clusterCount}`,
    `Noise reduction: ${report.noiseReductionPercent}%`,
    '',
  ];

  lines.push('--- Clusters ---');
  for (const c of report.clusters) {
    const tags = Object.entries(c.sharedTags)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    lines.push(
      `  ${c.id}: ${c.alerts.length} alerts, severity=${c.maxSeverity}, tags=[${tags}]`,
    );
  }

  lines.push('', '--- Root causes ---');
  for (const rc of report.rootCauses) {
    lines.push(
      `  ${rc.clusterId}: [${rc.confidence}] ${rc.rootAlert.message} (${rc.downstreamCount} downstream)`,
    );
  }

  if (report.consolidations.length) {
    lines.push('', '--- Consolidation suggestions ---');
    for (const con of report.consolidations) {
      lines.push(
        `  ${con.name}: merge ${con.mergeIds.length}, suppress ${con.suppressIds.length} - ${con.reason}`,
      );
    }
  }

  return lines.join('\n');
}
