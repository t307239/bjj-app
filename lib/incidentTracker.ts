/**
 * lib/incidentTracker.ts — Operational incident tracking utilities
 *
 * Q-156: Ops pillar — provides incident lifecycle management,
 * MTTR/MTTA calculation, severity classification, and postmortem
 * template generation to reduce operational burden.
 *
 * Pure utility layer — no DB access, no UI.
 *
 * @example
 *   import { createIncident, resolveIncident, calculateMTTR, SEVERITY_LEVELS } from "@/lib/incidentTracker";
 *   const incident = createIncident("API 500s", "critical", "deployment");
 *   const resolved = resolveIncident(incident, "Rolled back deploy v1.2.3");
 *   const metrics = calculateMTTR([resolved]);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface Incident {
  /** Unique incident ID */
  id: string;
  /** Incident title */
  title: string;
  /** Severity level */
  severity: SeverityLevel;
  /** Category */
  category: IncidentCategory;
  /** Current status */
  status: IncidentStatus;
  /** When detected */
  detectedAt: string;
  /** When acknowledged */
  acknowledgedAt: string | null;
  /** When resolved */
  resolvedAt: string | null;
  /** Resolution summary */
  resolution: string | null;
  /** Impact description */
  impact: string;
  /** Timeline entries */
  timeline: TimelineEntry[];
}

export type SeverityLevel = "critical" | "major" | "minor" | "cosmetic";
export type IncidentCategory = "deployment" | "infrastructure" | "data" | "security" | "external" | "unknown";
export type IncidentStatus = "detected" | "acknowledged" | "investigating" | "mitigating" | "resolved" | "postmortem";

export interface TimelineEntry {
  /** Timestamp */
  timestamp: string;
  /** Action taken */
  action: string;
  /** Who took the action */
  actor: string;
}

export interface IncidentMetrics {
  /** Total incidents in period */
  totalIncidents: number;
  /** Mean Time To Acknowledge (minutes) */
  mtta: number;
  /** Mean Time To Resolve (minutes) */
  mttr: number;
  /** Incidents by severity */
  bySeverity: Record<SeverityLevel, number>;
  /** Incidents by category */
  byCategory: Record<string, number>;
  /** Uptime percentage (based on critical incidents) */
  uptimePercent: number;
}

export interface PostmortemTemplate {
  /** Incident ID */
  incidentId: string;
  /** Title */
  title: string;
  /** Sections */
  sections: { heading: string; prompt: string }[];
}

// ── Constants ────────────────────────────────────────────────────────────

/** Severity level configurations */
export const SEVERITY_LEVELS: Record<SeverityLevel, { label: string; responseMinutes: number; icon: string }> = {
  critical: { label: "Critical — service down", responseMinutes: 15, icon: "🔴" },
  major: { label: "Major — degraded service", responseMinutes: 30, icon: "🟠" },
  minor: { label: "Minor — partial issue", responseMinutes: 120, icon: "🟡" },
  cosmetic: { label: "Cosmetic — no user impact", responseMinutes: 480, icon: "⚪" },
};

/** Status transitions */
export const STATUS_FLOW: IncidentStatus[] = [
  "detected",
  "acknowledged",
  "investigating",
  "mitigating",
  "resolved",
  "postmortem",
];

// ── Incident Lifecycle ──────────────────────────────────────────────────

/**
 * Create a new incident.
 */
export function createIncident(
  title: string,
  severity: SeverityLevel,
  category: IncidentCategory,
  impact: string = "",
): Incident {
  const now = new Date().toISOString();
  return {
    id: `INC-${Date.now()}`,
    title,
    severity,
    category,
    status: "detected",
    detectedAt: now,
    acknowledgedAt: null,
    resolvedAt: null,
    resolution: null,
    impact,
    timeline: [{ timestamp: now, action: "Incident detected", actor: "system" }],
  };
}

/**
 * Acknowledge an incident.
 */
export function acknowledgeIncident(
  incident: Incident,
  actor: string = "on-call",
): Incident {
  const now = new Date().toISOString();
  return {
    ...incident,
    status: "acknowledged",
    acknowledgedAt: now,
    timeline: [...incident.timeline, { timestamp: now, action: "Incident acknowledged", actor }],
  };
}

/**
 * Resolve an incident.
 */
export function resolveIncident(
  incident: Incident,
  resolution: string,
  actor: string = "on-call",
): Incident {
  const now = new Date().toISOString();
  return {
    ...incident,
    status: "resolved",
    resolvedAt: now,
    resolution,
    timeline: [...incident.timeline, { timestamp: now, action: `Resolved: ${resolution}`, actor }],
  };
}

/**
 * Add a timeline entry to an incident.
 */
export function addTimelineEntry(
  incident: Incident,
  action: string,
  actor: string = "system",
): Incident {
  return {
    ...incident,
    timeline: [...incident.timeline, { timestamp: new Date().toISOString(), action, actor }],
  };
}

// ── Metrics ─────────────────────────────────────────────────────────────

/**
 * Calculate incident metrics from a list of incidents.
 */
export function calculateMetrics(
  incidents: Incident[],
  periodDays: number = 30,
): IncidentMetrics {
  const bySeverity: Record<SeverityLevel, number> = { critical: 0, major: 0, minor: 0, cosmetic: 0 };
  const byCategory: Record<string, number> = {};
  let totalTTA = 0;
  let ttaCount = 0;
  let totalTTR = 0;
  let ttrCount = 0;
  let criticalDownMinutes = 0;

  for (const inc of incidents) {
    bySeverity[inc.severity]++;
    byCategory[inc.category] = (byCategory[inc.category] ?? 0) + 1;

    if (inc.acknowledgedAt) {
      const tta = (new Date(inc.acknowledgedAt).getTime() - new Date(inc.detectedAt).getTime()) / 60000;
      totalTTA += tta;
      ttaCount++;
    }

    if (inc.resolvedAt) {
      const ttr = (new Date(inc.resolvedAt).getTime() - new Date(inc.detectedAt).getTime()) / 60000;
      totalTTR += ttr;
      ttrCount++;

      if (inc.severity === "critical") {
        criticalDownMinutes += ttr;
      }
    }
  }

  const totalMinutes = periodDays * 24 * 60;
  const uptimePercent = totalMinutes > 0
    ? ((totalMinutes - criticalDownMinutes) / totalMinutes) * 100
    : 100;

  return {
    totalIncidents: incidents.length,
    mtta: ttaCount > 0 ? totalTTA / ttaCount : 0,
    mttr: ttrCount > 0 ? totalTTR / ttrCount : 0,
    bySeverity,
    byCategory,
    uptimePercent: Math.min(100, Math.max(0, uptimePercent)),
  };
}

/**
 * Generate a postmortem template for an incident.
 */
export function generatePostmortemTemplate(incident: Incident): PostmortemTemplate {
  return {
    incidentId: incident.id,
    title: `Postmortem: ${incident.title}`,
    sections: [
      { heading: "Summary", prompt: `What happened? (Incident: ${incident.title}, Severity: ${incident.severity})` },
      { heading: "Impact", prompt: `What was the user impact? Duration? Affected users?` },
      { heading: "Timeline", prompt: "Chronological list of events from detection to resolution" },
      { heading: "Root Cause", prompt: "What was the underlying cause?" },
      { heading: "Resolution", prompt: `How was it fixed? (${incident.resolution ?? "pending"})` },
      { heading: "Lessons Learned", prompt: "What went well? What could be improved?" },
      { heading: "Action Items", prompt: "What changes will prevent recurrence?" },
    ],
  };
}

/**
 * Format incident metrics as a human-readable string.
 */
export function formatMetrics(metrics: IncidentMetrics): string {
  return [
    `📊 Incident Metrics`,
    `  Total: ${metrics.totalIncidents} incidents`,
    `  MTTA: ${metrics.mtta.toFixed(0)} min | MTTR: ${metrics.mttr.toFixed(0)} min`,
    `  Uptime: ${metrics.uptimePercent.toFixed(2)}%`,
    `  By severity: Critical ${metrics.bySeverity.critical}, Major ${metrics.bySeverity.major}, Minor ${metrics.bySeverity.minor}`,
  ].join("\n");
}
