/**
 * disasterRecovery.ts — Disaster recovery planning & RTO/RPO tracking
 *
 * Pure-function utility for DR plan templates, RTO/RPO calculation,
 * failover procedure management, and backup validation tracking.
 *
 * @module disasterRecovery
 * @since Q-177
 */

/* ---------- Constants ---------- */

/** Recovery Time Objective classifications */
export const RTO_CLASSIFICATIONS = {
  tier1: { maxMinutes: 15, label: "Mission Critical", example: "Auth, API Gateway" },
  tier2: { maxMinutes: 60, label: "Business Critical", example: "Database, Payments" },
  tier3: { maxMinutes: 240, label: "Important", example: "Analytics, Email" },
  tier4: { maxMinutes: 1440, label: "Non-Critical", example: "Wiki, Reports" },
} as const;

export type RTOTier = keyof typeof RTO_CLASSIFICATIONS;

/** Recovery Point Objective classifications */
export const RPO_CLASSIFICATIONS = {
  zero: { maxMinutes: 0, label: "Zero Data Loss", method: "Synchronous replication" },
  near_zero: { maxMinutes: 5, label: "Near-Zero", method: "WAL streaming / PITR" },
  hourly: { maxMinutes: 60, label: "Hourly", method: "Hourly snapshots" },
  daily: { maxMinutes: 1440, label: "Daily", method: "Daily backups" },
} as const;

export type RPOClass = keyof typeof RPO_CLASSIFICATIONS;

/** Standard DR scenarios */
export const DR_SCENARIOS = {
  database_failure: {
    description: "Primary database becomes unavailable",
    rtoTier: "tier2" as RTOTier,
    rpoClass: "near_zero" as RPOClass,
    steps: [
      "Detect: Health check fails for DB endpoint",
      "Assess: Check Supabase dashboard for incident status",
      "Failover: If provider-managed, wait for auto-recovery",
      "Restore: If data loss, restore from PITR to nearest recovery point",
      "Verify: Run data integrity checks (db-check cron)",
      "Notify: Post incident update via Telegram",
    ],
  },
  deployment_failure: {
    description: "Bad deployment causes service degradation",
    rtoTier: "tier1" as RTOTier,
    rpoClass: "zero" as RPOClass,
    steps: [
      "Detect: Error rate spike in Sentry",
      "Assess: Check deployment diff in Vercel",
      "Rollback: Revert to last known good deployment in Vercel",
      "Verify: Smoke test all critical endpoints",
      "Notify: Post rollback notice",
    ],
  },
  dns_failure: {
    description: "DNS resolution fails for primary domain",
    rtoTier: "tier1" as RTOTier,
    rpoClass: "zero" as RPOClass,
    steps: [
      "Detect: Synthetic probe fails with DNS error",
      "Assess: Check DNS registrar and Vercel DNS status",
      "Mitigate: If registrar issue, update NS records",
      "Verify: DNS propagation check from multiple regions",
      "Notify: Update status page",
    ],
  },
  data_breach: {
    description: "Unauthorized data access detected",
    rtoTier: "tier1" as RTOTier,
    rpoClass: "zero" as RPOClass,
    steps: [
      "Detect: Anomalous access pattern in logs",
      "Contain: Rotate all API keys and secrets",
      "Assess: Identify scope of compromised data",
      "Notify: GDPR Art.33 — notify authority within 72 hours",
      "Remediate: Patch vulnerability, strengthen access controls",
      "Report: Generate incident postmortem",
    ],
  },
  provider_outage: {
    description: "Cloud provider (Vercel/Supabase) experiences outage",
    rtoTier: "tier3" as RTOTier,
    rpoClass: "hourly" as RPOClass,
    steps: [
      "Detect: Multiple health checks fail simultaneously",
      "Assess: Check provider status pages",
      "Communicate: Post status update to users",
      "Wait: Monitor provider recovery progress",
      "Verify: Full smoke test after recovery",
      "Review: Evaluate multi-provider strategy",
    ],
  },
} as const;

export type DRScenario = keyof typeof DR_SCENARIOS;

/* ---------- Types ---------- */

export interface ServiceComponent {
  name: string;
  rtoTier: RTOTier;
  rpoClass: RPOClass;
  dependencies: string[];
  backupMethod: string;
  lastBackupVerified?: string;
}

export interface DRPlanEntry {
  scenario: DRScenario;
  components: string[];
  estimatedRecoveryMinutes: number;
  lastTested?: string;
  owner: string;
}

export interface BackupValidation {
  component: string;
  timestamp: string;
  status: "valid" | "invalid" | "expired";
  sizeBytes?: number;
  ageMinutes: number;
  rpoCompliant: boolean;
}

export interface DRReadinessReport {
  components: ServiceComponent[];
  planEntries: DRPlanEntry[];
  backupValidations: BackupValidation[];
  overallReadiness: "ready" | "at_risk" | "not_ready";
  gaps: string[];
  score: number;
}

/* ---------- Core Functions ---------- */

/**
 * Calculate RTO compliance for a component
 */
export function isRTOCompliant(
  component: ServiceComponent,
  actualRecoveryMinutes: number,
): boolean {
  const tier = RTO_CLASSIFICATIONS[component.rtoTier];
  return actualRecoveryMinutes <= tier.maxMinutes;
}

/**
 * Calculate RPO compliance based on backup age
 */
export function isRPOCompliant(
  component: ServiceComponent,
  backupAgeMinutes: number,
): boolean {
  const rpo = RPO_CLASSIFICATIONS[component.rpoClass];
  return backupAgeMinutes <= rpo.maxMinutes;
}

/**
 * Validate backup freshness
 */
export function validateBackup(
  component: ServiceComponent,
  backupTimestamp: string,
  now: string,
): BackupValidation {
  const backupTime = new Date(backupTimestamp).getTime();
  const nowTime = new Date(now).getTime();
  const ageMinutes = Math.round((nowTime - backupTime) / 60000);

  const rpo = RPO_CLASSIFICATIONS[component.rpoClass];
  const rpoCompliant = ageMinutes <= rpo.maxMinutes;

  let status: BackupValidation["status"];
  if (ageMinutes <= rpo.maxMinutes) {
    status = "valid";
  } else if (ageMinutes <= rpo.maxMinutes * 2) {
    status = "expired";
  } else {
    status = "invalid";
  }

  return {
    component: component.name,
    timestamp: backupTimestamp,
    status,
    ageMinutes,
    rpoCompliant,
  };
}

/**
 * Identify gaps in DR readiness
 */
export function identifyDRGaps(
  components: ServiceComponent[],
  planEntries: DRPlanEntry[],
  backupValidations: BackupValidation[],
): string[] {
  const gaps: string[] = [];

  // Components without backup verification
  for (const comp of components) {
    if (!comp.lastBackupVerified) {
      gaps.push(`${comp.name}: backup never verified`);
    }
  }

  // Scenarios without plan entries
  for (const scenario of Object.keys(DR_SCENARIOS)) {
    if (!planEntries.some((p) => p.scenario === scenario)) {
      gaps.push(`No DR plan for scenario: ${scenario}`);
    }
  }

  // Untested plans
  for (const plan of planEntries) {
    if (!plan.lastTested) {
      gaps.push(`DR plan for ${plan.scenario} never tested`);
    }
  }

  // Non-compliant backups
  for (const validation of backupValidations) {
    if (!validation.rpoCompliant) {
      gaps.push(`${validation.component}: backup age (${validation.ageMinutes}min) exceeds RPO`);
    }
  }

  return gaps;
}

/**
 * Generate DR readiness report
 */
export function generateDRReadinessReport(
  components: ServiceComponent[],
  planEntries: DRPlanEntry[],
  backupValidations: BackupValidation[],
): DRReadinessReport {
  const gaps = identifyDRGaps(components, planEntries, backupValidations);

  // Score calculation
  const totalChecks = components.length * 2 + Object.keys(DR_SCENARIOS).length;
  const passedChecks = totalChecks - gaps.length;
  const score = totalChecks > 0 ? Math.max(0, Math.round((passedChecks / totalChecks) * 100)) : 0;

  let overallReadiness: DRReadinessReport["overallReadiness"];
  if (score >= 80) overallReadiness = "ready";
  else if (score >= 50) overallReadiness = "at_risk";
  else overallReadiness = "not_ready";

  return {
    components,
    planEntries,
    backupValidations,
    overallReadiness,
    gaps,
    score,
  };
}

/**
 * Get DR steps for a specific scenario
 */
export function getDRSteps(scenario: DRScenario): string[] {
  return [...DR_SCENARIOS[scenario].steps];
}

/* ---------- Formatting ---------- */

export function formatDRReport(report: DRReadinessReport): string {
  const lines: string[] = [
    "=== Disaster Recovery Readiness ===",
    "",
    `Readiness: ${report.overallReadiness.toUpperCase()}`,
    `Score: ${report.score}/100`,
    `Components: ${report.components.length}`,
    `Plans: ${report.planEntries.length}`,
  ];

  if (report.gaps.length > 0) {
    lines.push("", "Gaps:");
    for (const gap of report.gaps) {
      lines.push(`  ⚠️ ${gap}`);
    }
  } else {
    lines.push("", "No gaps identified.");
  }

  return lines.join("\n");
}
