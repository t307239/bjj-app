/**
 * Q-224: Backup Verification Scheduler — automated backup integrity checks
 *
 * Extends the existing backup-verify cron with structured verification
 * scheduling, result tracking, and alerting logic.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerificationType = "row_count" | "freshness" | "referential" | "schema" | "pitr";

export interface VerificationCheck {
  type: VerificationType;
  name: string;
  /** Cron expression for when to run */
  schedule: string;
  /** Maximum acceptable age in hours */
  maxAgeHours?: number;
  /** Whether failure should trigger alert */
  alertOnFailure: boolean;
}

export interface VerificationResult {
  check: VerificationCheck;
  status: "pass" | "warn" | "fail";
  message: string;
  durationMs: number;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface VerificationHistory {
  /** Check name */
  checkName: string;
  /** Recent results (most recent first) */
  results: VerificationResult[];
  /** Success rate over history */
  successRate: number;
  /** Last pass timestamp */
  lastPass?: string;
  /** Last fail timestamp */
  lastFail?: string;
  /** Consecutive failures */
  consecutiveFailures: number;
}

export interface BackupVerificationReport {
  /** Overall status */
  status: "healthy" | "degraded" | "critical";
  /** Total checks configured */
  totalChecks: number;
  /** Checks that passed */
  passed: number;
  /** Checks that warned */
  warned: number;
  /** Checks that failed */
  failed: number;
  /** Individual check histories */
  histories: VerificationHistory[];
  /** Alert-worthy items */
  alerts: string[];
  /** Score 0-100 */
  score: number;
  /** Grade */
  grade: string;
  /** Timestamp */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Default checks
// ---------------------------------------------------------------------------

export const DEFAULT_VERIFICATION_CHECKS: VerificationCheck[] = [
  {
    type: "row_count",
    name: "Training logs row count",
    schedule: "0 4 * * 1", // Weekly Monday 4AM UTC
    alertOnFailure: true,
  },
  {
    type: "freshness",
    name: "Latest backup freshness",
    schedule: "0 4 * * *", // Daily 4AM UTC
    maxAgeHours: 25, // Must be within 25 hours
    alertOnFailure: true,
  },
  {
    type: "referential",
    name: "Orphan record detection",
    schedule: "0 3 * * 0", // Weekly Sunday 3AM UTC
    alertOnFailure: true,
  },
  {
    type: "schema",
    name: "Schema consistency check",
    schedule: "0 5 * * 1", // Weekly Monday 5AM UTC
    alertOnFailure: false,
  },
  {
    type: "pitr",
    name: "PITR WAL archive status",
    schedule: "0 6 1 * *", // Monthly 1st 6AM UTC
    alertOnFailure: true,
  },
];

// ---------------------------------------------------------------------------
// Verification logic
// ---------------------------------------------------------------------------

/**
 * Simulate running a verification check (actual DB calls happen in cron).
 * This structures the check result based on provided metrics.
 */
export function evaluateCheck(
  check: VerificationCheck,
  metrics: {
    rowCount?: number;
    previousRowCount?: number;
    lastBackupAge?: number; // hours
    orphanCount?: number;
    schemaMatch?: boolean;
    walArchiveEnabled?: boolean;
  },
  durationMs: number
): VerificationResult {
  const timestamp = new Date().toISOString();

  switch (check.type) {
    case "row_count": {
      const count = metrics.rowCount ?? 0;
      const prev = metrics.previousRowCount ?? count;
      const dropPercent =
        prev > 0 ? ((prev - count) / prev) * 100 : 0;

      if (dropPercent > 50) {
        return {
          check,
          status: "fail",
          message: `Row count dropped ${dropPercent.toFixed(1)}% (${prev} → ${count})`,
          durationMs,
          timestamp,
          details: { rowCount: count, previousRowCount: prev },
        };
      }
      if (dropPercent > 10) {
        return {
          check,
          status: "warn",
          message: `Row count dropped ${dropPercent.toFixed(1)}%`,
          durationMs,
          timestamp,
          details: { rowCount: count, previousRowCount: prev },
        };
      }
      return {
        check,
        status: "pass",
        message: `Row count: ${count} (${dropPercent > 0 ? `-${dropPercent.toFixed(1)}%` : "stable"})`,
        durationMs,
        timestamp,
        details: { rowCount: count },
      };
    }

    case "freshness": {
      const ageHours = metrics.lastBackupAge ?? 999;
      const maxAge = check.maxAgeHours ?? 25;

      if (ageHours > maxAge * 2) {
        return {
          check,
          status: "fail",
          message: `Backup is ${ageHours.toFixed(1)}h old (max: ${maxAge}h)`,
          durationMs,
          timestamp,
          details: { ageHours, maxAgeHours: maxAge },
        };
      }
      if (ageHours > maxAge) {
        return {
          check,
          status: "warn",
          message: `Backup age ${ageHours.toFixed(1)}h exceeds ${maxAge}h`,
          durationMs,
          timestamp,
        };
      }
      return {
        check,
        status: "pass",
        message: `Backup is ${ageHours.toFixed(1)}h old (within ${maxAge}h)`,
        durationMs,
        timestamp,
      };
    }

    case "referential": {
      const orphans = metrics.orphanCount ?? 0;
      if (orphans > 10) {
        return {
          check,
          status: "fail",
          message: `${orphans} orphan records detected`,
          durationMs,
          timestamp,
          details: { orphanCount: orphans },
        };
      }
      if (orphans > 0) {
        return {
          check,
          status: "warn",
          message: `${orphans} orphan records found`,
          durationMs,
          timestamp,
        };
      }
      return {
        check,
        status: "pass",
        message: "No orphan records",
        durationMs,
        timestamp,
      };
    }

    case "schema": {
      const match = metrics.schemaMatch ?? true;
      return {
        check,
        status: match ? "pass" : "warn",
        message: match ? "Schema consistent" : "Schema drift detected",
        durationMs,
        timestamp,
      };
    }

    case "pitr": {
      const enabled = metrics.walArchiveEnabled ?? false;
      return {
        check,
        status: enabled ? "pass" : "fail",
        message: enabled ? "WAL archiving enabled" : "WAL archiving DISABLED",
        durationMs,
        timestamp,
      };
    }
  }
}

/**
 * Build a verification history from a list of results.
 */
export function buildHistory(
  checkName: string,
  results: VerificationResult[]
): VerificationHistory {
  const sorted = [...results].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const passes = sorted.filter((r) => r.status === "pass");
  const fails = sorted.filter((r) => r.status === "fail");

  let consecutiveFailures = 0;
  for (const r of sorted) {
    if (r.status === "fail") consecutiveFailures++;
    else break;
  }

  return {
    checkName,
    results: sorted,
    successRate:
      sorted.length > 0 ? passes.length / sorted.length : 1,
    lastPass: passes[0]?.timestamp,
    lastFail: fails[0]?.timestamp,
    consecutiveFailures,
  };
}

/**
 * Build the full verification report.
 */
export function buildVerificationReport(
  histories: VerificationHistory[]
): BackupVerificationReport {
  const alerts: string[] = [];

  let passed = 0;
  let warned = 0;
  let failed = 0;

  for (const h of histories) {
    const latest = h.results[0];
    if (!latest) continue;

    if (latest.status === "pass") passed++;
    else if (latest.status === "warn") warned++;
    else {
      failed++;
      if (latest.check.alertOnFailure) {
        alerts.push(`${h.checkName}: ${latest.message}`);
      }
    }

    if (h.consecutiveFailures >= 3) {
      alerts.push(
        `${h.checkName}: ${h.consecutiveFailures} consecutive failures`
      );
    }
  }

  const total = passed + warned + failed;
  const score =
    total > 0 ? Math.round(((passed + warned * 0.5) / total) * 100) : 100;

  const status: BackupVerificationReport["status"] =
    failed > 0 ? "critical" : warned > 0 ? "degraded" : "healthy";

  return {
    status,
    totalChecks: total,
    passed,
    warned,
    failed,
    histories,
    alerts,
    score,
    grade: scoreToGrade(score),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format the report as human-readable string.
 */
export function formatVerificationReport(
  report: BackupVerificationReport
): string {
  const lines: string[] = [
    `Backup Verification: ${report.score}/100 (${report.grade})`,
    `Status: ${report.status.toUpperCase()}`,
    `Passed: ${report.passed} | Warned: ${report.warned} | Failed: ${report.failed}`,
  ];

  if (report.alerts.length > 0) {
    lines.push("", "Alerts:");
    for (const a of report.alerts) {
      lines.push(`  ⚠ ${a}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
