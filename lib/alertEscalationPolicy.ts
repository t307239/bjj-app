/**
 * Q-185: Alert Escalation Policy (Ops 94→95)
 *
 * Multi-tier alert escalation with SLA tracking, on-call rotation,
 * acknowledgment deadlines, and escalation audit trail for SaaS-grade ops.
 */

// ── Types & Constants ──────────────────────────────────────

export type AlertSeverity = "P1" | "P2" | "P3" | "P4";

export interface EscalationTier {
  level: number;
  name: string;
  channels: EscalationChannel[];
  acknowledgeDeadlineMinutes: number;
  autoEscalateAfterMinutes: number;
}

export type EscalationChannel = "telegram" | "email" | "slack" | "pagerduty" | "phone";

export interface EscalationPolicy {
  severity: AlertSeverity;
  description: string;
  tiers: EscalationTier[];
  maxEscalationLevel: number;
  slaMinutes: number; // resolve within
}

export interface AlertEvent {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  source: string;
  createdAt: string;  // ISO
  acknowledgedAt?: string;
  resolvedAt?: string;
  escalationLevel: number;
  escalationHistory: EscalationEntry[];
}

export interface EscalationEntry {
  level: number;
  timestamp: string;
  channel: EscalationChannel;
  notifiedTo: string;
  acknowledged: boolean;
}

export interface AlertSLAStatus {
  alertId: string;
  severity: AlertSeverity;
  slaMinutes: number;
  elapsedMinutes: number;
  withinSLA: boolean;
  slaBreachIn: number | null; // minutes until breach, null if breached
  status: "acknowledged" | "unacknowledged" | "resolved" | "breached";
}

export interface EscalationAuditReport {
  totalAlerts: number;
  slaCompliance: number;
  avgAcknowledgeTime: number;
  avgResolveTime: number;
  escalationsByLevel: Record<number, number>;
  bySeverity: Record<AlertSeverity, { count: number; avgResolveMin: number }>;
  summary: string;
}

// ── Default Policies ───────────────────────────────────────

export const DEFAULT_POLICIES: Record<AlertSeverity, EscalationPolicy> = {
  P1: {
    severity: "P1",
    description: "Critical — Service down, data loss risk",
    tiers: [
      { level: 1, name: "On-call engineer", channels: ["telegram", "pagerduty"], acknowledgeDeadlineMinutes: 5, autoEscalateAfterMinutes: 10 },
      { level: 2, name: "Engineering lead", channels: ["phone", "telegram"], acknowledgeDeadlineMinutes: 10, autoEscalateAfterMinutes: 20 },
      { level: 3, name: "CTO / Incident commander", channels: ["phone"], acknowledgeDeadlineMinutes: 15, autoEscalateAfterMinutes: 30 },
    ],
    maxEscalationLevel: 3,
    slaMinutes: 60,
  },
  P2: {
    severity: "P2",
    description: "High — Major feature degraded",
    tiers: [
      { level: 1, name: "On-call engineer", channels: ["telegram", "slack"], acknowledgeDeadlineMinutes: 15, autoEscalateAfterMinutes: 30 },
      { level: 2, name: "Engineering lead", channels: ["telegram", "email"], acknowledgeDeadlineMinutes: 30, autoEscalateAfterMinutes: 60 },
    ],
    maxEscalationLevel: 2,
    slaMinutes: 240,
  },
  P3: {
    severity: "P3",
    description: "Medium — Minor feature issue",
    tiers: [
      { level: 1, name: "On-call engineer", channels: ["slack", "email"], acknowledgeDeadlineMinutes: 60, autoEscalateAfterMinutes: 120 },
    ],
    maxEscalationLevel: 1,
    slaMinutes: 1440,
  },
  P4: {
    severity: "P4",
    description: "Low — Cosmetic / non-urgent",
    tiers: [
      { level: 1, name: "Engineering team", channels: ["email"], acknowledgeDeadlineMinutes: 480, autoEscalateAfterMinutes: 1440 },
    ],
    maxEscalationLevel: 1,
    slaMinutes: 10080, // 7 days
  },
};

// ── Core Functions ─────────────────────────────────────────

/**
 * Get escalation policy for a severity
 */
export function getPolicy(severity: AlertSeverity): EscalationPolicy {
  return DEFAULT_POLICIES[severity];
}

/**
 * Determine current escalation tier based on elapsed time
 */
export function getCurrentEscalationLevel(
  severity: AlertSeverity,
  elapsedMinutes: number
): number {
  const policy = getPolicy(severity);
  let level = 1;
  let cumulativeMinutes = 0;
  for (const tier of policy.tiers) {
    cumulativeMinutes += tier.autoEscalateAfterMinutes;
    if (elapsedMinutes >= cumulativeMinutes && tier.level < policy.maxEscalationLevel) {
      level = tier.level + 1;
    }
  }
  return Math.min(level, policy.maxEscalationLevel);
}

/**
 * Check if alert needs escalation
 */
export function needsEscalation(alert: AlertEvent): boolean {
  if (alert.resolvedAt) return false;
  const policy = getPolicy(alert.severity);
  const currentTier = policy.tiers.find((t) => t.level === alert.escalationLevel);
  if (!currentTier) return false;

  const createdAt = new Date(alert.createdAt).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - createdAt) / (1000 * 60);

  // Calculate cumulative time for current level
  let cumulativeMinutes = 0;
  for (const tier of policy.tiers) {
    cumulativeMinutes += tier.autoEscalateAfterMinutes;
    if (tier.level === alert.escalationLevel) break;
  }

  return elapsedMinutes >= cumulativeMinutes && alert.escalationLevel < policy.maxEscalationLevel;
}

/**
 * Calculate SLA status for an alert
 */
export function calculateSLAStatus(alert: AlertEvent): AlertSLAStatus {
  const policy = getPolicy(alert.severity);
  const createdAt = new Date(alert.createdAt).getTime();
  const now = alert.resolvedAt ? new Date(alert.resolvedAt).getTime() : Date.now();
  const elapsedMinutes = Math.round((now - createdAt) / (1000 * 60));
  const withinSLA = elapsedMinutes <= policy.slaMinutes;
  const slaBreachIn = withinSLA ? policy.slaMinutes - elapsedMinutes : null;

  let status: AlertSLAStatus["status"];
  if (alert.resolvedAt) {
    status = "resolved";
  } else if (!withinSLA) {
    status = "breached";
  } else if (alert.acknowledgedAt) {
    status = "acknowledged";
  } else {
    status = "unacknowledged";
  }

  return {
    alertId: alert.id,
    severity: alert.severity,
    slaMinutes: policy.slaMinutes,
    elapsedMinutes,
    withinSLA,
    slaBreachIn,
    status,
  };
}

/**
 * Build escalation audit report from alert history
 */
export function buildEscalationAudit(
  alerts: AlertEvent[]
): EscalationAuditReport {
  if (alerts.length === 0) {
    return {
      totalAlerts: 0,
      slaCompliance: 100,
      avgAcknowledgeTime: 0,
      avgResolveTime: 0,
      escalationsByLevel: {},
      bySeverity: {} as Record<AlertSeverity, { count: number; avgResolveMin: number }>,
      summary: "No alerts in period",
    };
  }

  const escalationsByLevel: Record<number, number> = {};
  const bySeverity: Record<string, { count: number; totalResolveMin: number }> = {};
  let slaCompliantCount = 0;
  let totalAckTime = 0;
  let ackCount = 0;
  let totalResolveTime = 0;
  let resolveCount = 0;

  for (const alert of alerts) {
    const sla = calculateSLAStatus(alert);
    if (sla.withinSLA || sla.status === "resolved") slaCompliantCount++;

    escalationsByLevel[alert.escalationLevel] =
      (escalationsByLevel[alert.escalationLevel] || 0) + 1;

    if (!bySeverity[alert.severity]) {
      bySeverity[alert.severity] = { count: 0, totalResolveMin: 0 };
    }
    bySeverity[alert.severity].count++;

    const createdAt = new Date(alert.createdAt).getTime();
    if (alert.acknowledgedAt) {
      const ackTime = (new Date(alert.acknowledgedAt).getTime() - createdAt) / (1000 * 60);
      totalAckTime += ackTime;
      ackCount++;
    }
    if (alert.resolvedAt) {
      const resolveTime = (new Date(alert.resolvedAt).getTime() - createdAt) / (1000 * 60);
      totalResolveTime += resolveTime;
      resolveCount++;
      bySeverity[alert.severity].totalResolveMin += resolveTime;
    }
  }

  const slaCompliance = Math.round((slaCompliantCount / alerts.length) * 100);
  const avgAcknowledgeTime = ackCount > 0 ? Math.round(totalAckTime / ackCount) : 0;
  const avgResolveTime = resolveCount > 0 ? Math.round(totalResolveTime / resolveCount) : 0;

  const bySeverityResult = {} as Record<AlertSeverity, { count: number; avgResolveMin: number }>;
  for (const [sev, data] of Object.entries(bySeverity)) {
    bySeverityResult[sev as AlertSeverity] = {
      count: data.count,
      avgResolveMin: data.count > 0 ? Math.round(data.totalResolveMin / data.count) : 0,
    };
  }

  return {
    totalAlerts: alerts.length,
    slaCompliance,
    avgAcknowledgeTime,
    avgResolveTime,
    escalationsByLevel,
    bySeverity: bySeverityResult,
    summary: `${alerts.length} alerts, ${slaCompliance}% SLA compliance, avg ack ${avgAcknowledgeTime}min, avg resolve ${avgResolveTime}min`,
  };
}

/**
 * Format escalation audit as readable string
 */
export function formatEscalationAudit(report: EscalationAuditReport): string {
  const lines = [
    `# Escalation Audit Report`,
    `Total Alerts: ${report.totalAlerts}`,
    `SLA Compliance: ${report.slaCompliance}%`,
    `Avg Acknowledge: ${report.avgAcknowledgeTime} min`,
    `Avg Resolve: ${report.avgResolveTime} min`,
    ``,
    `## By Severity`,
  ];
  for (const [sev, data] of Object.entries(report.bySeverity)) {
    lines.push(`- ${sev}: ${data.count} alerts, avg resolve ${data.avgResolveMin} min`);
  }
  return lines.join("\n");
}
