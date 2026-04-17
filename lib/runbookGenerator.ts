/**
 * lib/runbookGenerator.ts — Operational runbook generator
 *
 * Q-170: Ops pillar 93→94 — Define runbook steps, prerequisites,
 * rollback procedures, escalation paths. Generate formatted runbooks
 * for common operational tasks.
 *
 * @example
 *   import { createRunbook, RUNBOOK_TEMPLATES } from "@/lib/runbookGenerator";
 *
 *   const rb = createRunbook(RUNBOOK_TEMPLATES.database_migration);
 *   // → formatted runbook with steps, rollback, escalation
 */

// ── Types ───────────────────────────────────────────────────────────────

export type RunbookSeverity = "critical" | "major" | "minor" | "informational";
export type StepStatus = "pending" | "in_progress" | "completed" | "skipped" | "failed";

export interface RunbookStep {
  /** Step number */
  order: number;
  /** Step title */
  title: string;
  /** Detailed instructions */
  instructions: string;
  /** Expected duration in minutes */
  estimatedMinutes: number;
  /** Whether this step can be automated */
  automatable: boolean;
  /** Command to run (if applicable) */
  command?: string;
  /** Verification check after step */
  verification?: string;
  /** Rollback command for this step */
  rollbackCommand?: string;
  /** Current status */
  status: StepStatus;
}

export interface EscalationPath {
  /** Severity level that triggers this escalation */
  triggerSeverity: RunbookSeverity;
  /** Who to contact */
  contact: string;
  /** Communication channel */
  channel: "telegram" | "email" | "slack" | "phone";
  /** Maximum response time in minutes */
  responseTimeMinutes: number;
}

export interface Runbook {
  /** Runbook ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Category */
  category: "deployment" | "database" | "incident" | "maintenance" | "security" | "monitoring";
  /** Severity */
  severity: RunbookSeverity;
  /** Prerequisites before starting */
  prerequisites: string[];
  /** Steps to execute */
  steps: RunbookStep[];
  /** Rollback procedure (global) */
  rollbackProcedure: string[];
  /** Escalation paths */
  escalationPaths: EscalationPath[];
  /** Estimated total duration in minutes */
  estimatedTotalMinutes: number;
  /** Last updated */
  lastUpdated: string;
  /** Tags */
  tags: string[];
}

export interface RunbookExecution {
  /** Runbook being executed */
  runbookId: string;
  /** Start time */
  startTime: string;
  /** Current step index */
  currentStep: number;
  /** Step statuses */
  stepStatuses: StepStatus[];
  /** Overall status */
  status: "in_progress" | "completed" | "failed" | "rolled_back";
  /** Notes from execution */
  notes: string[];
  /** Elapsed time in minutes */
  elapsedMinutes: number;
}

// ── Templates ──────────────────────────────────────────────────────────

export type RunbookTemplateKey =
  | "database_migration"
  | "deploy_rollback"
  | "incident_response"
  | "backup_restore"
  | "security_patch"
  | "performance_investigation";

/** Pre-built runbook templates for common operations */
export const RUNBOOK_TEMPLATES: Record<RunbookTemplateKey, Omit<Runbook, "id" | "lastUpdated">> = {
  database_migration: {
    title: "Database Migration",
    description: "Apply Supabase database migration with safety checks",
    category: "database",
    severity: "major",
    prerequisites: [
      "Backup verified within last 24 hours",
      "Migration SQL reviewed and tested on staging",
      "Low-traffic window confirmed (02:00-06:00 UTC)",
      "Rollback SQL prepared and tested",
    ],
    steps: [
      {
        order: 1, title: "Verify backup status", instructions: "Check that backup-verify cron ran successfully in last 24h",
        estimatedMinutes: 2, automatable: true, command: "curl -s https://bjj-app.net/api/cron/backup-verify",
        verification: "Response contains healthy status", status: "pending",
      },
      {
        order: 2, title: "Check active connections", instructions: "Verify no long-running queries that could conflict",
        estimatedMinutes: 3, automatable: true, command: "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'",
        verification: "Active connections < 10", status: "pending",
      },
      {
        order: 3, title: "Apply migration", instructions: "Run migration SQL via Supabase dashboard or CLI",
        estimatedMinutes: 5, automatable: false, verification: "Migration applied without errors", status: "pending",
        rollbackCommand: "Run rollback SQL from prepared script",
      },
      {
        order: 4, title: "Verify schema", instructions: "Check that new tables/columns exist and constraints are correct",
        estimatedMinutes: 3, automatable: true, verification: "Schema matches expected state", status: "pending",
      },
      {
        order: 5, title: "Run health check", instructions: "Verify application health endpoint returns OK",
        estimatedMinutes: 2, automatable: true, command: "curl -s https://bjj-app.net/api/health",
        verification: "Health check returns 200 with dbStatus: connected", status: "pending",
      },
    ],
    rollbackProcedure: [
      "1. Run prepared rollback SQL script",
      "2. Verify schema reverted to previous state",
      "3. Restart application if needed",
      "4. Verify health check passes",
      "5. Notify team of rollback",
    ],
    escalationPaths: [
      { triggerSeverity: "critical", contact: "Admin (Telegram)", channel: "telegram", responseTimeMinutes: 15 },
      { triggerSeverity: "major", contact: "Admin (Email)", channel: "email", responseTimeMinutes: 60 },
    ],
    estimatedTotalMinutes: 15,
    tags: ["database", "migration", "supabase"],
  },

  deploy_rollback: {
    title: "Deployment Rollback",
    description: "Roll back a failed Vercel deployment to previous version",
    category: "deployment",
    severity: "critical",
    prerequisites: [
      "Previous deployment ID identified",
      "Error logs collected from current deployment",
    ],
    steps: [
      {
        order: 1, title: "Identify rollback target", instructions: "Find last known good deployment in Vercel dashboard",
        estimatedMinutes: 2, automatable: false, verification: "Deployment ID noted", status: "pending",
      },
      {
        order: 2, title: "Promote previous deployment", instructions: "Use Vercel dashboard to promote previous deployment to production",
        estimatedMinutes: 3, automatable: false, verification: "Previous deployment is now production", status: "pending",
      },
      {
        order: 3, title: "Verify rollback", instructions: "Check health endpoint and key pages",
        estimatedMinutes: 5, automatable: true, command: "curl -s https://bjj-app.net/api/health",
        verification: "Application responding normally", status: "pending",
      },
      {
        order: 4, title: "Notify stakeholders", instructions: "Send notification about rollback via Telegram",
        estimatedMinutes: 2, automatable: true, verification: "Notification sent", status: "pending",
      },
    ],
    rollbackProcedure: [
      "1. If rollback itself fails, contact Vercel support",
      "2. Enable maintenance mode if necessary",
      "3. Investigate root cause before re-deploying",
    ],
    escalationPaths: [
      { triggerSeverity: "critical", contact: "Admin (Telegram)", channel: "telegram", responseTimeMinutes: 5 },
    ],
    estimatedTotalMinutes: 12,
    tags: ["deployment", "vercel", "rollback"],
  },

  incident_response: {
    title: "Incident Response",
    description: "Standard incident response procedure for production issues",
    category: "incident",
    severity: "critical",
    prerequisites: [
      "Alert received and acknowledged",
      "Initial severity assessment completed",
    ],
    steps: [
      {
        order: 1, title: "Acknowledge incident", instructions: "Confirm receipt of alert and begin investigation",
        estimatedMinutes: 2, automatable: false, status: "pending",
      },
      {
        order: 2, title: "Assess impact", instructions: "Determine affected users, features, and severity",
        estimatedMinutes: 5, automatable: false, verification: "Impact scope documented", status: "pending",
      },
      {
        order: 3, title: "Communicate status", instructions: "Post initial status update",
        estimatedMinutes: 3, automatable: false, verification: "Status communicated", status: "pending",
      },
      {
        order: 4, title: "Investigate root cause", instructions: "Check logs, metrics, recent deployments",
        estimatedMinutes: 30, automatable: false, verification: "Root cause identified or escalated", status: "pending",
      },
      {
        order: 5, title: "Apply fix", instructions: "Implement fix or workaround",
        estimatedMinutes: 15, automatable: false, verification: "Issue resolved", status: "pending",
      },
      {
        order: 6, title: "Verify resolution", instructions: "Confirm fix and monitor for recurrence",
        estimatedMinutes: 10, automatable: true, command: "curl -s https://bjj-app.net/api/health",
        verification: "All health checks passing", status: "pending",
      },
      {
        order: 7, title: "Write postmortem", instructions: "Document timeline, root cause, and action items",
        estimatedMinutes: 30, automatable: false, verification: "Postmortem documented", status: "pending",
      },
    ],
    rollbackProcedure: [
      "1. If fix causes regression, revert immediately",
      "2. Fall back to deploy_rollback runbook if needed",
    ],
    escalationPaths: [
      { triggerSeverity: "critical", contact: "Admin (Telegram)", channel: "telegram", responseTimeMinutes: 5 },
      { triggerSeverity: "major", contact: "Admin (Email)", channel: "email", responseTimeMinutes: 30 },
    ],
    estimatedTotalMinutes: 95,
    tags: ["incident", "response", "production"],
  },

  backup_restore: {
    title: "Backup Restore",
    description: "Restore database from backup (PITR or daily snapshot)",
    category: "database",
    severity: "critical",
    prerequisites: [
      "Target restore point identified",
      "Confirmation that restore is necessary (data loss confirmed)",
      "Users notified of maintenance window",
    ],
    steps: [
      {
        order: 1, title: "Enable maintenance mode", instructions: "Set maintenance flag to prevent writes during restore",
        estimatedMinutes: 2, automatable: true, status: "pending",
      },
      {
        order: 2, title: "Initiate PITR restore", instructions: "Use Supabase dashboard to initiate point-in-time recovery",
        estimatedMinutes: 5, automatable: false, verification: "Restore initiated", status: "pending",
      },
      {
        order: 3, title: "Wait for restore", instructions: "Monitor restore progress in Supabase dashboard",
        estimatedMinutes: 30, automatable: false, verification: "Restore completed", status: "pending",
      },
      {
        order: 4, title: "Verify data integrity", instructions: "Run integrity checks on restored data",
        estimatedMinutes: 10, automatable: true, verification: "All integrity checks pass", status: "pending",
      },
      {
        order: 5, title: "Disable maintenance mode", instructions: "Remove maintenance flag and verify access",
        estimatedMinutes: 2, automatable: true, verification: "Application accessible", status: "pending",
      },
    ],
    rollbackProcedure: [
      "1. If restore fails, try alternative backup point",
      "2. Contact Supabase support if PITR fails",
    ],
    escalationPaths: [
      { triggerSeverity: "critical", contact: "Admin (Telegram)", channel: "telegram", responseTimeMinutes: 5 },
    ],
    estimatedTotalMinutes: 49,
    tags: ["database", "backup", "restore", "pitr"],
  },

  security_patch: {
    title: "Security Patch",
    description: "Apply security update to dependencies or configuration",
    category: "security",
    severity: "major",
    prerequisites: [
      "CVE or security advisory identified",
      "Patch available and tested on development",
    ],
    steps: [
      {
        order: 1, title: "Assess vulnerability", instructions: "Review CVE details and determine impact on our application",
        estimatedMinutes: 10, automatable: false, verification: "Risk assessment documented", status: "pending",
      },
      {
        order: 2, title: "Update dependency", instructions: "Apply patch via npm update or manual code change",
        estimatedMinutes: 5, automatable: true, verification: "Dependency updated", status: "pending",
      },
      {
        order: 3, title: "Run tests", instructions: "Execute full test suite to verify no regression",
        estimatedMinutes: 10, automatable: true, command: "npm test",
        verification: "All tests pass", status: "pending",
      },
      {
        order: 4, title: "Deploy", instructions: "Deploy patched version to production",
        estimatedMinutes: 5, automatable: true, verification: "Deployment successful", status: "pending",
      },
      {
        order: 5, title: "Verify fix", instructions: "Confirm vulnerability is patched in production",
        estimatedMinutes: 5, automatable: false, verification: "Vulnerability confirmed fixed", status: "pending",
      },
    ],
    rollbackProcedure: [
      "1. If patch breaks functionality, use deploy_rollback runbook",
      "2. Apply alternative mitigation (WAF rule, feature disable) until proper fix",
    ],
    escalationPaths: [
      { triggerSeverity: "critical", contact: "Admin (Telegram)", channel: "telegram", responseTimeMinutes: 15 },
    ],
    estimatedTotalMinutes: 35,
    tags: ["security", "patch", "cve"],
  },

  performance_investigation: {
    title: "Performance Investigation",
    description: "Investigate and resolve performance degradation",
    category: "monitoring",
    severity: "minor",
    prerequisites: [
      "Performance degradation detected (slow response times, high latency)",
      "Monitoring data available (Server-Timing, Sentry, health endpoint)",
    ],
    steps: [
      {
        order: 1, title: "Gather metrics", instructions: "Check health endpoint, Server-Timing headers, and Sentry performance data",
        estimatedMinutes: 5, automatable: true, command: "curl -s https://bjj-app.net/api/health",
        verification: "Metrics collected", status: "pending",
      },
      {
        order: 2, title: "Identify bottleneck", instructions: "Analyze slow queries, N+1 patterns, or resource contention",
        estimatedMinutes: 15, automatable: false, verification: "Bottleneck identified", status: "pending",
      },
      {
        order: 3, title: "Implement fix", instructions: "Apply optimization (index, query rewrite, caching, etc.)",
        estimatedMinutes: 20, automatable: false, verification: "Fix applied", status: "pending",
      },
      {
        order: 4, title: "Verify improvement", instructions: "Compare before/after metrics",
        estimatedMinutes: 10, automatable: true, verification: "Performance improved to acceptable levels", status: "pending",
      },
    ],
    rollbackProcedure: [
      "1. If optimization causes regression, revert changes",
      "2. Add monitoring for the specific bottleneck",
    ],
    escalationPaths: [
      { triggerSeverity: "major", contact: "Admin (Telegram)", channel: "telegram", responseTimeMinutes: 30 },
    ],
    estimatedTotalMinutes: 50,
    tags: ["performance", "monitoring", "optimization"],
  },
};

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Create a runbook from a template.
 */
export function createRunbook(
  template: Omit<Runbook, "id" | "lastUpdated">,
  id?: string
): Runbook {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // JST
  return {
    ...template,
    id: id ?? `rb_${Date.now()}`,
    lastUpdated: now.toISOString().split("T")[0],
  };
}

/**
 * Start executing a runbook.
 */
export function startExecution(runbook: Runbook): RunbookExecution {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    runbookId: runbook.id,
    startTime: now.toISOString(),
    currentStep: 0,
    stepStatuses: runbook.steps.map(() => "pending" as StepStatus),
    status: "in_progress",
    notes: [],
    elapsedMinutes: 0,
  };
}

/**
 * Advance execution to next step.
 */
export function advanceStep(
  execution: RunbookExecution,
  stepResult: StepStatus,
  note?: string
): RunbookExecution {
  const updated = { ...execution, stepStatuses: [...execution.stepStatuses] };
  updated.stepStatuses[execution.currentStep] = stepResult;

  if (note) {
    updated.notes = [...updated.notes, `Step ${execution.currentStep + 1}: ${note}`];
  }

  if (stepResult === "failed") {
    updated.status = "failed";
  } else if (execution.currentStep >= execution.stepStatuses.length - 1) {
    updated.status = "completed";
  } else {
    updated.currentStep = execution.currentStep + 1;
  }

  return updated;
}

/**
 * Get the appropriate escalation path for a severity.
 */
export function getEscalationPath(
  runbook: Runbook,
  severity: RunbookSeverity
): EscalationPath | null {
  const severityOrder: RunbookSeverity[] = ["critical", "major", "minor", "informational"];
  const targetIdx = severityOrder.indexOf(severity);

  // Find the closest matching or more severe escalation path
  for (let i = targetIdx; i < severityOrder.length; i++) {
    const path = runbook.escalationPaths.find((p) => p.triggerSeverity === severityOrder[i]);
    if (path) return path;
  }
  // Fall back to most severe
  return runbook.escalationPaths[0] ?? null;
}

/**
 * Format a runbook as a human-readable string.
 */
export function formatRunbook(runbook: Runbook): string {
  const lines: string[] = [
    `=== Runbook: ${runbook.title} ===`,
    `ID: ${runbook.id}`,
    `Category: ${runbook.category} | Severity: ${runbook.severity}`,
    `Estimated time: ${runbook.estimatedTotalMinutes} minutes`,
    `Last updated: ${runbook.lastUpdated}`,
    "",
    "Prerequisites:",
    ...runbook.prerequisites.map((p) => `  - ${p}`),
    "",
    "Steps:",
  ];

  for (const step of runbook.steps) {
    lines.push(`  ${step.order}. [${step.status}] ${step.title} (~${step.estimatedMinutes}min)`);
    lines.push(`     ${step.instructions}`);
    if (step.command) lines.push(`     $ ${step.command}`);
    if (step.verification) lines.push(`     ✓ ${step.verification}`);
  }

  if (runbook.rollbackProcedure.length > 0) {
    lines.push("", "Rollback:");
    for (const r of runbook.rollbackProcedure) {
      lines.push(`  ${r}`);
    }
  }

  return lines.join("\n");
}

/**
 * Get list of all template keys.
 */
export function getTemplateKeys(): RunbookTemplateKey[] {
  return Object.keys(RUNBOOK_TEMPLATES) as RunbookTemplateKey[];
}
