/**
 * lib/rollbackGuard.ts — Deployment rollback decision utilities
 *
 * Q-148: Infra pillar — provides automated rollback decision logic
 * by comparing health metrics before/after deployment. Does NOT
 * execute rollbacks — only recommends action.
 *
 * @example
 *   import { shouldRollback, compareDeployments, ROLLBACK_THRESHOLDS } from "@/lib/rollbackGuard";
 *   const decision = shouldRollback(preMetrics, postMetrics);
 *   if (decision.rollback) alert(decision.reason);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface DeploymentMetrics {
  /** Version/commit SHA */
  version: string;
  /** Deployment timestamp */
  deployedAt: string;
  /** Health endpoint status code */
  healthStatus: number;
  /** Health endpoint response time (ms) */
  healthResponseMs: number;
  /** Error rate (0-1) from monitoring */
  errorRate: number;
  /** P95 response time (ms) */
  p95ResponseMs: number;
  /** Number of 5xx errors in observation window */
  serverErrors: number;
  /** Whether DB connection is healthy */
  dbHealthy: boolean;
}

export interface RollbackDecision {
  /** Whether rollback is recommended */
  rollback: boolean;
  /** Severity of the issue */
  severity: "critical" | "warning" | "ok";
  /** Reason for the decision */
  reason: string;
  /** Individual check results */
  checks: RollbackCheck[];
  /** Suggested action */
  action: "rollback_immediately" | "monitor_closely" | "no_action";
}

export interface RollbackCheck {
  /** Check name */
  name: string;
  /** Whether this check passed */
  passed: boolean;
  /** Details */
  detail: string;
}

export interface DeploymentComparison {
  /** Version being compared from */
  fromVersion: string;
  /** Version being compared to */
  toVersion: string;
  /** Error rate change (positive = worse) */
  errorRateDelta: number;
  /** P95 latency change in ms (positive = slower) */
  p95Delta: number;
  /** Health status changed */
  healthDegraded: boolean;
  /** DB health changed */
  dbDegraded: boolean;
  /** Overall assessment */
  assessment: "improved" | "stable" | "degraded" | "critical";
}

// ── Constants ────────────────────────────────────────────────────────────

/** Thresholds for rollback decisions */
export const ROLLBACK_THRESHOLDS = {
  /** Max acceptable error rate (0.05 = 5%) */
  maxErrorRate: 0.05,
  /** Max acceptable P95 response time (ms) */
  maxP95Ms: 5000,
  /** Max acceptable health endpoint response time (ms) */
  maxHealthMs: 3000,
  /** Error rate increase that triggers rollback */
  errorRateIncreaseTrigger: 0.02,
  /** P95 increase (ms) that triggers concern */
  p95IncreaseTrigger: 1000,
  /** P95 increase (ms) that triggers rollback */
  p95IncreaseRollback: 3000,
  /** Max server errors in observation window */
  maxServerErrors: 10,
  /** Observation window in minutes */
  observationWindowMinutes: 5,
} as const;

// ── Comparison ──────────────────────────────────────────────────────────

/**
 * Compare two deployment metrics snapshots.
 */
export function compareDeployments(
  before: DeploymentMetrics,
  after: DeploymentMetrics,
): DeploymentComparison {
  const errorRateDelta = after.errorRate - before.errorRate;
  const p95Delta = after.p95ResponseMs - before.p95ResponseMs;
  const healthDegraded = before.healthStatus === 200 && after.healthStatus !== 200;
  const dbDegraded = before.dbHealthy && !after.dbHealthy;

  let assessment: DeploymentComparison["assessment"];
  if (healthDegraded || dbDegraded || after.errorRate > ROLLBACK_THRESHOLDS.maxErrorRate) {
    assessment = "critical";
  } else if (errorRateDelta > ROLLBACK_THRESHOLDS.errorRateIncreaseTrigger || p95Delta > ROLLBACK_THRESHOLDS.p95IncreaseTrigger) {
    assessment = "degraded";
  } else if (errorRateDelta < 0 || p95Delta < -200) {
    assessment = "improved";
  } else {
    assessment = "stable";
  }

  return {
    fromVersion: before.version,
    toVersion: after.version,
    errorRateDelta,
    p95Delta,
    healthDegraded,
    dbDegraded,
    assessment,
  };
}

// ── Rollback Decision ───────────────────────────────────────────────────

/**
 * Determine whether a rollback is recommended.
 */
export function shouldRollback(
  before: DeploymentMetrics,
  after: DeploymentMetrics,
): RollbackDecision {
  const checks: RollbackCheck[] = [];
  const comparison = compareDeployments(before, after);

  // Check 1: Health endpoint
  checks.push({
    name: "Health Endpoint",
    passed: after.healthStatus === 200,
    detail: after.healthStatus === 200
      ? `Healthy (${after.healthResponseMs}ms)`
      : `Unhealthy: status ${after.healthStatus}`,
  });

  // Check 2: DB connectivity
  checks.push({
    name: "Database",
    passed: after.dbHealthy,
    detail: after.dbHealthy ? "Connected" : "Connection failed",
  });

  // Check 3: Error rate
  checks.push({
    name: "Error Rate",
    passed: after.errorRate <= ROLLBACK_THRESHOLDS.maxErrorRate,
    detail: `${(after.errorRate * 100).toFixed(2)}% (threshold: ${ROLLBACK_THRESHOLDS.maxErrorRate * 100}%)`,
  });

  // Check 4: Error rate increase
  checks.push({
    name: "Error Rate Change",
    passed: comparison.errorRateDelta <= ROLLBACK_THRESHOLDS.errorRateIncreaseTrigger,
    detail: `${comparison.errorRateDelta >= 0 ? "+" : ""}${(comparison.errorRateDelta * 100).toFixed(2)}%`,
  });

  // Check 5: P95 latency
  checks.push({
    name: "P95 Latency",
    passed: after.p95ResponseMs <= ROLLBACK_THRESHOLDS.maxP95Ms,
    detail: `${after.p95ResponseMs}ms (threshold: ${ROLLBACK_THRESHOLDS.maxP95Ms}ms)`,
  });

  // Check 6: P95 increase
  checks.push({
    name: "P95 Change",
    passed: comparison.p95Delta <= ROLLBACK_THRESHOLDS.p95IncreaseRollback,
    detail: `${comparison.p95Delta >= 0 ? "+" : ""}${comparison.p95Delta}ms`,
  });

  // Check 7: Server errors count
  checks.push({
    name: "Server Errors",
    passed: after.serverErrors <= ROLLBACK_THRESHOLDS.maxServerErrors,
    detail: `${after.serverErrors} errors (threshold: ${ROLLBACK_THRESHOLDS.maxServerErrors})`,
  });

  // Decision logic
  const failedChecks = checks.filter((c) => !c.passed);
  const criticalFails = failedChecks.filter((c) =>
    c.name === "Health Endpoint" || c.name === "Database" || c.name === "Error Rate",
  );

  if (criticalFails.length > 0) {
    return {
      rollback: true,
      severity: "critical",
      reason: `Critical failure: ${criticalFails.map((c) => c.name).join(", ")}`,
      checks,
      action: "rollback_immediately",
    };
  }

  if (failedChecks.length >= 2) {
    return {
      rollback: true,
      severity: "warning",
      reason: `Multiple degradations: ${failedChecks.map((c) => c.name).join(", ")}`,
      checks,
      action: "rollback_immediately",
    };
  }

  if (failedChecks.length === 1) {
    return {
      rollback: false,
      severity: "warning",
      reason: `Single issue: ${failedChecks[0].name} — monitor closely`,
      checks,
      action: "monitor_closely",
    };
  }

  return {
    rollback: false,
    severity: "ok",
    reason: "All checks passed",
    checks,
    action: "no_action",
  };
}

/**
 * Format a rollback decision as a human-readable string.
 */
export function formatRollbackDecision(decision: RollbackDecision): string {
  const icon = decision.severity === "critical" ? "🔴" : decision.severity === "warning" ? "⚠️" : "✅";
  const lines = [
    `${icon} ${decision.action.replace(/_/g, " ").toUpperCase()}: ${decision.reason}`,
    ...decision.checks.map((c) => `  ${c.passed ? "✅" : "❌"} ${c.name}: ${c.detail}`),
  ];
  return lines.join("\n");
}
