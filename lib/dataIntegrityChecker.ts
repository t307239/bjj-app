/**
 * lib/dataIntegrityChecker.ts — Cross-table data integrity validation
 *
 * Q-153: Data pillar — provides a framework for defining and running
 * data integrity checks across Supabase tables. Checks include orphan
 * detection, referential integrity, value range validation, and
 * temporal consistency.
 *
 * Pure utility layer — does not execute SQL directly. Produces
 * check definitions and evaluates results.
 *
 * @example
 *   import { defineCheck, evaluateResults, INTEGRITY_CHECKS } from "@/lib/dataIntegrityChecker";
 *   const check = INTEGRITY_CHECKS.orphanRecords;
 *   // Execute check.query via Supabase, then:
 *   const result = evaluateResults(check, rows);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface IntegrityCheck {
  /** Unique check ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what is checked */
  description: string;
  /** Tables involved */
  tables: string[];
  /** Severity if check fails */
  severity: "critical" | "warning" | "info";
  /** Category */
  category: IntegrityCategory;
  /** SQL query hint (pseudo-SQL for documentation) */
  queryHint: string;
  /** Threshold — number of violations before failure */
  threshold: number;
}

export type IntegrityCategory =
  | "orphan"
  | "referential"
  | "range"
  | "temporal"
  | "consistency"
  | "uniqueness";

export interface CheckResult {
  /** Check that was run */
  checkId: string;
  /** Whether check passed */
  passed: boolean;
  /** Number of violations found */
  violationCount: number;
  /** Sample violations (first N) */
  samples: string[];
  /** Severity */
  severity: "critical" | "warning" | "info";
  /** Human-readable message */
  message: string;
}

export interface IntegrityReport {
  /** Timestamp */
  timestamp: string;
  /** Total checks run */
  totalChecks: number;
  /** Passed checks */
  passedChecks: number;
  /** Failed checks */
  failedChecks: number;
  /** Per-check results */
  results: CheckResult[];
  /** Overall health */
  health: "healthy" | "degraded" | "critical";
  /** Score (0-100) */
  score: number;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Predefined integrity checks for BJJ App schema */
export const INTEGRITY_CHECKS: Record<string, IntegrityCheck> = {
  orphanTrainingLogs: {
    id: "orphan_training_logs",
    name: "Orphan Training Logs",
    description: "Training logs referencing non-existent users",
    tables: ["training_logs", "profiles"],
    severity: "critical",
    category: "orphan",
    queryHint: "SELECT t.id FROM training_logs t LEFT JOIN profiles p ON t.user_id = p.id WHERE p.id IS NULL",
    threshold: 0,
  },
  orphanPushSubscriptions: {
    id: "orphan_push_subscriptions",
    name: "Orphan Push Subscriptions",
    description: "Push subscriptions for deleted users",
    tables: ["push_subscriptions", "profiles"],
    severity: "warning",
    category: "orphan",
    queryHint: "SELECT ps.id FROM push_subscriptions ps LEFT JOIN profiles p ON ps.user_id = p.id WHERE p.id IS NULL",
    threshold: 0,
  },
  invalidBeltValues: {
    id: "invalid_belt_values",
    name: "Invalid Belt Values",
    description: "Belt values outside allowed range",
    tables: ["profiles"],
    severity: "warning",
    category: "range",
    queryHint: "SELECT id FROM profiles WHERE belt NOT IN ('white','blue','purple','brown','black')",
    threshold: 0,
  },
  futureTrainingDates: {
    id: "future_training_dates",
    name: "Future Training Dates",
    description: "Training logs with dates in the future",
    tables: ["training_logs"],
    severity: "warning",
    category: "temporal",
    queryHint: "SELECT id FROM training_logs WHERE date > CURRENT_DATE",
    threshold: 0,
  },
  negativeStripeCount: {
    id: "negative_stripe_count",
    name: "Negative Stripe Count",
    description: "Profiles with negative stripe count",
    tables: ["profiles"],
    severity: "critical",
    category: "range",
    queryHint: "SELECT id FROM profiles WHERE stripe < 0",
    threshold: 0,
  },
  duplicatePushEndpoints: {
    id: "duplicate_push_endpoints",
    name: "Duplicate Push Endpoints",
    description: "Same push endpoint registered multiple times",
    tables: ["push_subscriptions"],
    severity: "info",
    category: "uniqueness",
    queryHint: "SELECT endpoint, COUNT(*) FROM push_subscriptions GROUP BY endpoint HAVING COUNT(*) > 1",
    threshold: 5,
  },
  proWithoutStripe: {
    id: "pro_without_stripe",
    name: "Pro Without Stripe",
    description: "Pro users without Stripe customer ID",
    tables: ["profiles"],
    severity: "warning",
    category: "consistency",
    queryHint: "SELECT id FROM profiles WHERE is_pro = true AND stripe_customer_id IS NULL",
    threshold: 0,
  },
  stripeWithoutPro: {
    id: "stripe_without_pro",
    name: "Stripe Without Pro",
    description: "Users with Stripe subscription but is_pro=false",
    tables: ["profiles"],
    severity: "critical",
    category: "consistency",
    queryHint: "SELECT id FROM profiles WHERE stripe_subscription_id IS NOT NULL AND is_pro = false AND deleted_at IS NULL",
    threshold: 0,
  },
  weightOutOfRange: {
    id: "weight_out_of_range",
    name: "Weight Out of Range",
    description: "Weight entries outside reasonable range (20-300 kg)",
    tables: ["training_logs"],
    severity: "info",
    category: "range",
    queryHint: "SELECT id FROM training_logs WHERE weight IS NOT NULL AND (weight < 20 OR weight > 300)",
    threshold: 0,
  },
  durationOutOfRange: {
    id: "duration_out_of_range",
    name: "Duration Out of Range",
    description: "Sessions with unreasonable duration (>480 minutes)",
    tables: ["training_logs"],
    severity: "info",
    category: "range",
    queryHint: "SELECT id FROM training_logs WHERE duration_minutes > 480",
    threshold: 5,
  },
};

/** Maximum sample violations to include in results */
export const MAX_SAMPLES = 5;

// ── Check Helpers ───────────────────────────────────────────────────────

/**
 * Create a custom integrity check.
 */
export function defineCheck(
  partial: Omit<IntegrityCheck, "threshold"> & { threshold?: number },
): IntegrityCheck {
  return {
    ...partial,
    threshold: partial.threshold ?? 0,
  };
}

/**
 * Evaluate check results against threshold.
 */
export function evaluateResults(
  check: IntegrityCheck,
  violationIds: string[],
): CheckResult {
  const passed = violationIds.length <= check.threshold;
  const samples = violationIds.slice(0, MAX_SAMPLES);

  return {
    checkId: check.id,
    passed,
    violationCount: violationIds.length,
    samples,
    severity: check.severity,
    message: passed
      ? `${check.name}: OK (${violationIds.length} violations, threshold ${check.threshold})`
      : `${check.name}: FAILED — ${violationIds.length} violations found (threshold ${check.threshold})`,
  };
}

/**
 * Get all checks for a specific table.
 */
export function getChecksForTable(table: string): IntegrityCheck[] {
  return Object.values(INTEGRITY_CHECKS).filter((c) =>
    c.tables.includes(table),
  );
}

/**
 * Get all checks for a specific category.
 */
export function getChecksByCategory(category: IntegrityCategory): IntegrityCheck[] {
  return Object.values(INTEGRITY_CHECKS).filter((c) => c.category === category);
}

// ── Report ──────────────────────────────────────────────────────────────

/**
 * Build an integrity report from check results.
 */
export function buildIntegrityReport(results: CheckResult[]): IntegrityReport {
  const passedChecks = results.filter((r) => r.passed).length;
  const failedChecks = results.length - passedChecks;
  const criticalFails = results.filter((r) => !r.passed && r.severity === "critical").length;

  let health: IntegrityReport["health"];
  if (criticalFails > 0) {
    health = "critical";
  } else if (failedChecks > 0) {
    health = "degraded";
  } else {
    health = "healthy";
  }

  const score = results.length > 0
    ? Math.round((passedChecks / results.length) * 100)
    : 100;

  return {
    timestamp: new Date().toISOString(),
    totalChecks: results.length,
    passedChecks,
    failedChecks,
    results,
    health,
    score,
  };
}

/**
 * Format an integrity report as a human-readable string.
 */
export function formatIntegrityReport(report: IntegrityReport): string {
  const icon = report.health === "healthy" ? "✅" : report.health === "degraded" ? "⚠️" : "🔴";
  const lines = [
    `${icon} Data Integrity: ${report.health.toUpperCase()} (${report.score}/100)`,
    `   Checks: ${report.passedChecks}/${report.totalChecks} passed`,
  ];

  const failed = report.results.filter((r) => !r.passed);
  if (failed.length > 0) {
    lines.push("", "Failed checks:");
    for (const r of failed) {
      const sev = r.severity === "critical" ? "🔴" : r.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`  ${sev} ${r.message}`);
    }
  }

  return lines.join("\n");
}
