/**
 * Q-228: Incident Playbook — structured incident response automation
 *
 * Generates runbooks for common incident types, tracks incident
 * lifecycle, and produces post-incident reports.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IncidentSeverity = "sev1" | "sev2" | "sev3" | "sev4";

export type IncidentType =
  | "outage"
  | "degraded_performance"
  | "data_loss"
  | "security_breach"
  | "billing_error"
  | "auth_failure"
  | "third_party_down";

export type IncidentPhase =
  | "detection"
  | "triage"
  | "mitigation"
  | "resolution"
  | "postmortem";

export interface PlaybookStep {
  order: number;
  action: string;
  responsible: string;
  estimatedMinutes: number;
  /** Whether this step can be automated */
  automatable: boolean;
  /** Commands or links for the step */
  runbookRef?: string;
}

export interface Playbook {
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  steps: PlaybookStep[];
  escalationPath: string[];
  /** Expected total resolution time in minutes */
  expectedResolutionMinutes: number;
}

export interface IncidentTimeline {
  phase: IncidentPhase;
  timestamp: string;
  description: string;
  actor: string;
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  status: "open" | "mitigated" | "resolved" | "closed";
  createdAt: string;
  resolvedAt?: string;
  timeline: IncidentTimeline[];
  /** Affected services */
  affectedServices: string[];
  /** Customer impact summary */
  customerImpact: string;
}

export interface PostIncidentReport {
  incidentId: string;
  title: string;
  severity: IncidentSeverity;
  /** Duration in minutes */
  durationMinutes: number;
  /** Root cause */
  rootCause: string;
  /** What went well */
  wentWell: string[];
  /** What could be improved */
  improvements: string[];
  /** Action items */
  actionItems: Array<{ task: string; owner: string; deadline: string }>;
  /** Timeline summary */
  timelineSummary: IncidentTimeline[];
}

export interface IncidentMetrics {
  totalIncidents: number;
  bySeverity: Record<IncidentSeverity, number>;
  avgResolutionMinutes: number;
  mttr: number; // Mean time to resolve
  openCount: number;
}

// ---------------------------------------------------------------------------
// Playbook generation
// ---------------------------------------------------------------------------

/**
 * Generate a playbook for a given incident type and severity.
 */
export function generatePlaybook(
  type: IncidentType,
  severity: IncidentSeverity
): Playbook {
  const baseSteps = PLAYBOOK_TEMPLATES[type] ?? PLAYBOOK_TEMPLATES.outage;

  // Adjust timing based on severity
  const timingMultiplier = severity === "sev1" ? 0.5 : severity === "sev2" ? 0.75 : 1;
  const steps: PlaybookStep[] = baseSteps.map((s, i) => ({
    ...s,
    order: i + 1,
    estimatedMinutes: Math.ceil(s.estimatedMinutes * timingMultiplier),
  }));

  const escalationPath =
    severity === "sev1" || severity === "sev2"
      ? ["On-call engineer", "Tech lead", "CTO"]
      : ["On-call engineer", "Tech lead"];

  return {
    incidentType: type,
    severity,
    title: `${type} — ${severity.toUpperCase()} Playbook`,
    steps,
    escalationPath,
    expectedResolutionMinutes: steps.reduce(
      (s, step) => s + step.estimatedMinutes,
      0
    ),
  };
}

/**
 * Create a new incident.
 */
export function createIncident(
  type: IncidentType,
  severity: IncidentSeverity,
  title: string,
  description: string,
  affectedServices: string[]
): Incident {
  const now = new Date().toISOString();
  return {
    id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    severity,
    title,
    description,
    status: "open",
    createdAt: now,
    timeline: [
      {
        phase: "detection",
        timestamp: now,
        description: `Incident detected: ${title}`,
        actor: "system",
      },
    ],
    affectedServices,
    customerImpact: "",
  };
}

/**
 * Build a post-incident report.
 */
export function buildPostIncidentReport(
  incident: Incident,
  rootCause: string,
  wentWell: string[],
  improvements: string[],
  actionItems: Array<{ task: string; owner: string; deadline: string }>
): PostIncidentReport {
  const resolvedAt = incident.resolvedAt ?? new Date().toISOString();
  const durationMinutes = Math.round(
    (new Date(resolvedAt).getTime() - new Date(incident.createdAt).getTime()) /
      (1000 * 60)
  );

  return {
    incidentId: incident.id,
    title: incident.title,
    severity: incident.severity,
    durationMinutes,
    rootCause,
    wentWell,
    improvements,
    actionItems,
    timelineSummary: incident.timeline,
  };
}

/**
 * Calculate incident metrics from a list of incidents.
 */
export function calculateIncidentMetrics(
  incidents: Incident[]
): IncidentMetrics {
  const bySeverity: Record<IncidentSeverity, number> = {
    sev1: 0,
    sev2: 0,
    sev3: 0,
    sev4: 0,
  };

  let totalResolutionMinutes = 0;
  let resolvedCount = 0;
  let openCount = 0;

  for (const inc of incidents) {
    bySeverity[inc.severity]++;
    if (inc.status === "open") openCount++;
    if (inc.resolvedAt) {
      const mins =
        (new Date(inc.resolvedAt).getTime() -
          new Date(inc.createdAt).getTime()) /
        (1000 * 60);
      totalResolutionMinutes += mins;
      resolvedCount++;
    }
  }

  const avgResolution =
    resolvedCount > 0
      ? Math.round(totalResolutionMinutes / resolvedCount)
      : 0;

  return {
    totalIncidents: incidents.length,
    bySeverity,
    avgResolutionMinutes: avgResolution,
    mttr: avgResolution,
    openCount,
  };
}

/**
 * Format a playbook as human-readable string.
 */
export function formatPlaybook(playbook: Playbook): string {
  const lines: string[] = [
    playbook.title,
    `Expected resolution: ${playbook.expectedResolutionMinutes} min`,
    `Escalation: ${playbook.escalationPath.join(" → ")}`,
    "",
    "Steps:",
  ];

  for (const step of playbook.steps) {
    const auto = step.automatable ? " [AUTO]" : "";
    lines.push(
      `  ${step.order}. ${step.action} (${step.responsible}, ~${step.estimatedMinutes}m)${auto}`
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Playbook templates
// ---------------------------------------------------------------------------

const PLAYBOOK_TEMPLATES: Record<IncidentType, Omit<PlaybookStep, "order">[]> = {
  outage: [
    { action: "Verify outage scope via monitoring", responsible: "on-call", estimatedMinutes: 5, automatable: true },
    { action: "Check Vercel deployment status", responsible: "on-call", estimatedMinutes: 3, automatable: true },
    { action: "Check Supabase health dashboard", responsible: "on-call", estimatedMinutes: 3, automatable: true },
    { action: "Roll back to last known good deployment", responsible: "on-call", estimatedMinutes: 10, automatable: false },
    { action: "Verify recovery", responsible: "on-call", estimatedMinutes: 5, automatable: true },
    { action: "Notify stakeholders", responsible: "tech-lead", estimatedMinutes: 5, automatable: false },
  ],
  degraded_performance: [
    { action: "Identify slow endpoints via Web Vitals", responsible: "on-call", estimatedMinutes: 5, automatable: true },
    { action: "Check database query performance", responsible: "on-call", estimatedMinutes: 10, automatable: false },
    { action: "Review recent deployments for regressions", responsible: "on-call", estimatedMinutes: 10, automatable: false },
    { action: "Apply targeted fix or feature flag", responsible: "on-call", estimatedMinutes: 15, automatable: false },
    { action: "Verify metrics returned to baseline", responsible: "on-call", estimatedMinutes: 5, automatable: true },
  ],
  data_loss: [
    { action: "Assess scope of data loss", responsible: "on-call", estimatedMinutes: 10, automatable: false },
    { action: "Enable PITR if not already active", responsible: "on-call", estimatedMinutes: 5, automatable: false },
    { action: "Restore from backup/PITR", responsible: "tech-lead", estimatedMinutes: 30, automatable: false },
    { action: "Validate data integrity", responsible: "tech-lead", estimatedMinutes: 15, automatable: true },
    { action: "Notify affected users", responsible: "tech-lead", estimatedMinutes: 10, automatable: false },
  ],
  security_breach: [
    { action: "Isolate affected systems", responsible: "on-call", estimatedMinutes: 5, automatable: false },
    { action: "Rotate all exposed credentials", responsible: "tech-lead", estimatedMinutes: 15, automatable: false },
    { action: "Review access logs for unauthorized activity", responsible: "tech-lead", estimatedMinutes: 30, automatable: false },
    { action: "Patch vulnerability", responsible: "tech-lead", estimatedMinutes: 60, automatable: false },
    { action: "Notify affected users per GDPR Art.33", responsible: "tech-lead", estimatedMinutes: 15, automatable: false },
  ],
  billing_error: [
    { action: "Identify affected customers", responsible: "on-call", estimatedMinutes: 10, automatable: true },
    { action: "Pause billing webhook processing", responsible: "on-call", estimatedMinutes: 5, automatable: false },
    { action: "Fix billing logic", responsible: "tech-lead", estimatedMinutes: 30, automatable: false },
    { action: "Issue refunds for overcharges", responsible: "tech-lead", estimatedMinutes: 15, automatable: false },
    { action: "Resume billing and verify", responsible: "on-call", estimatedMinutes: 5, automatable: true },
  ],
  auth_failure: [
    { action: "Check Supabase Auth service status", responsible: "on-call", estimatedMinutes: 3, automatable: true },
    { action: "Verify JWT signing key validity", responsible: "on-call", estimatedMinutes: 5, automatable: true },
    { action: "Check OAuth provider status", responsible: "on-call", estimatedMinutes: 5, automatable: true },
    { action: "Clear session cache if applicable", responsible: "on-call", estimatedMinutes: 5, automatable: false },
    { action: "Verify login flow end-to-end", responsible: "on-call", estimatedMinutes: 5, automatable: true },
  ],
  third_party_down: [
    { action: "Confirm third-party status page", responsible: "on-call", estimatedMinutes: 3, automatable: true },
    { action: "Enable fallback/graceful degradation", responsible: "on-call", estimatedMinutes: 10, automatable: false },
    { action: "Monitor for recovery", responsible: "on-call", estimatedMinutes: 5, automatable: true },
    { action: "Disable fallback once recovered", responsible: "on-call", estimatedMinutes: 5, automatable: false },
  ],
};
