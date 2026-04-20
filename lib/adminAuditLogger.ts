/**
 * adminAuditLogger.ts
 * Admin action audit trail and query builder for BJJ App.
 * Produces immutable audit entries, detects suspicious activity,
 * and generates GDPR Art.30 compliant processing records.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An auditable admin action */
export type AuditableAction =
  | 'user_view'
  | 'user_search'
  | 'user_export'
  | 'subscription_modify'
  | 'data_delete'
  | 'config_change'
  | 'impersonation'
  | 'report_generate';

/** Sensitivity classification */
export type SensitivityLevel = 'low' | 'medium' | 'high' | 'critical';

/** A single immutable audit log entry */
export interface AuditEntry {
  readonly id: string;
  readonly action: AuditableAction;
  readonly adminId: string;
  readonly targetId: string | null;
  readonly targetType: string;
  readonly metadata: Record<string, unknown>;
  readonly sensitivity: SensitivityLevel;
  readonly timestamp: string;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly sessionId: string;
}

/** Filters for querying audit entries */
export interface AuditQuery {
  readonly actions?: AuditableAction[];
  readonly adminIds?: string[];
  readonly startDate?: string;
  readonly endDate?: string;
  readonly sensitivity?: SensitivityLevel[];
  readonly targetId?: string;
  readonly limit?: number;
}

/** Result of an audit query (in-memory filtering) */
export interface QueryResult {
  readonly entries: AuditEntry[];
  readonly totalCount: number;
  readonly appliedFilters: string[];
}

/** A flag for suspicious admin behavior */
export interface SuspiciousFlag {
  readonly type: 'bulk_export' | 'off_hours' | 'unusual_volume' | 'rapid_access' | 'impersonation_spike';
  readonly adminId: string;
  readonly detail: string;
  readonly severity: SensitivityLevel;
  readonly entries: string[];
}

/** GDPR Art.30 compliant processing record */
export interface ComplianceReport {
  readonly period: { start: string; end: string };
  readonly processingActivities: Array<{
    action: AuditableAction;
    count: number;
    uniqueAdmins: number;
    uniqueDataSubjects: number;
    legalBasis: string;
  }>;
  readonly totalActions: number;
  readonly generatedAt: string;
}

/** Activity metrics per admin */
export interface ActivityMetrics {
  readonly adminId: string;
  readonly totalActions: number;
  readonly actionBreakdown: Record<AuditableAction, number>;
  readonly peakHour: number;
  readonly mostAccessedTargets: Array<{ targetId: string; count: number }>;
}

/** Full audit report */
export interface AuditReport {
  readonly generatedAt: string;
  readonly period: { start: string; end: string };
  readonly totalEntries: number;
  readonly bySensitivity: Record<SensitivityLevel, number>;
  readonly suspiciousFlags: SuspiciousFlag[];
  readonly topAdmins: Array<{ adminId: string; actionCount: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All auditable actions */
export const AUDITABLE_ACTIONS: AuditableAction[] = [
  'user_view', 'user_search', 'user_export', 'subscription_modify',
  'data_delete', 'config_change', 'impersonation', 'report_generate',
];

/** Sensitivity level per action */
export const SENSITIVITY_LEVELS: Record<AuditableAction, SensitivityLevel> = {
  user_view: 'low',
  user_search: 'low',
  user_export: 'medium',
  subscription_modify: 'medium',
  data_delete: 'high',
  config_change: 'high',
  impersonation: 'critical',
  report_generate: 'low',
};

/** Legal basis mapping for GDPR Art.30 records */
const LEGAL_BASIS: Record<AuditableAction, string> = {
  user_view: 'Legitimate interest (support)',
  user_search: 'Legitimate interest (support)',
  user_export: 'Legal obligation / Data subject request',
  subscription_modify: 'Contract performance',
  data_delete: 'Data subject request (Art.17)',
  config_change: 'Legitimate interest (operations)',
  impersonation: 'Legitimate interest (debugging)',
  report_generate: 'Legitimate interest (analytics)',
};

/** Business hours range (UTC) */
const BUSINESS_HOURS_START = 6;
const BUSINESS_HOURS_END = 22;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an immutable, timestamped audit entry.
 */
export function createAuditEntry(
  action: AuditableAction,
  adminId: string,
  target: { id: string | null; type: string },
  metadata: Record<string, unknown>,
  context?: { ipAddress?: string; userAgent?: string; sessionId?: string },
): AuditEntry {
  const now = new Date().toISOString();
  return {
    id: `audit_${Date.now()}_${simpleHash(adminId + now)}`,
    action,
    adminId,
    targetId: target.id,
    targetType: target.type,
    metadata: Object.freeze({ ...metadata }),
    sensitivity: SENSITIVITY_LEVELS[action],
    timestamp: now,
    ipAddress: context?.ipAddress ?? 'unknown',
    userAgent: context?.userAgent ?? 'unknown',
    sessionId: context?.sessionId ?? 'unknown',
  };
}

/**
 * Filter audit entries based on query parameters.
 */
export function buildAuditQuery(entries: AuditEntry[], filters: AuditQuery): QueryResult {
  const appliedFilters: string[] = [];
  let result = [...entries];

  if (filters.actions?.length) {
    result = result.filter((e) => filters.actions!.includes(e.action));
    appliedFilters.push(`actions: ${filters.actions.join(', ')}`);
  }
  if (filters.adminIds?.length) {
    result = result.filter((e) => filters.adminIds!.includes(e.adminId));
    appliedFilters.push(`admins: ${filters.adminIds.join(', ')}`);
  }
  if (filters.startDate) {
    result = result.filter((e) => e.timestamp >= filters.startDate!);
    appliedFilters.push(`from: ${filters.startDate}`);
  }
  if (filters.endDate) {
    result = result.filter((e) => e.timestamp <= filters.endDate!);
    appliedFilters.push(`to: ${filters.endDate}`);
  }
  if (filters.sensitivity?.length) {
    result = result.filter((e) => filters.sensitivity!.includes(e.sensitivity));
    appliedFilters.push(`sensitivity: ${filters.sensitivity.join(', ')}`);
  }
  if (filters.targetId) {
    result = result.filter((e) => e.targetId === filters.targetId);
    appliedFilters.push(`target: ${filters.targetId}`);
  }

  result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (filters.limit && filters.limit > 0) {
    result = result.slice(0, filters.limit);
  }

  return { entries: result, totalCount: result.length, appliedFilters };
}

/**
 * Detect suspicious admin activity patterns.
 */
export function detectSuspiciousActivity(entries: AuditEntry[]): SuspiciousFlag[] {
  const flags: SuspiciousFlag[] = [];

  // Group by admin
  const byAdmin = new Map<string, AuditEntry[]>();
  for (const e of entries) {
    const list = byAdmin.get(e.adminId) ?? [];
    list.push(e);
    byAdmin.set(e.adminId, list);
  }

  for (const [adminId, adminEntries] of byAdmin) {
    // Bulk exports: more than 5 exports in a day
    const exports = adminEntries.filter((e) => e.action === 'user_export');
    if (exports.length >= 5) {
      flags.push({
        type: 'bulk_export',
        adminId,
        detail: `${exports.length} data exports detected`,
        severity: 'high',
        entries: exports.map((e) => e.id),
      });
    }

    // Off-hours access
    const offHours = adminEntries.filter((e) => {
      const hour = new Date(e.timestamp).getUTCHours();
      return hour < BUSINESS_HOURS_START || hour >= BUSINESS_HOURS_END;
    });
    if (offHours.length >= 3) {
      flags.push({
        type: 'off_hours',
        adminId,
        detail: `${offHours.length} actions outside business hours`,
        severity: 'medium',
        entries: offHours.map((e) => e.id),
      });
    }

    // Unusual volume: more than 100 actions in the dataset
    if (adminEntries.length > 100) {
      flags.push({
        type: 'unusual_volume',
        adminId,
        detail: `${adminEntries.length} actions recorded`,
        severity: 'medium',
        entries: adminEntries.slice(0, 5).map((e) => e.id),
      });
    }

    // Impersonation spike: more than 3 impersonations
    const impersonations = adminEntries.filter((e) => e.action === 'impersonation');
    if (impersonations.length >= 3) {
      flags.push({
        type: 'impersonation_spike',
        adminId,
        detail: `${impersonations.length} impersonation sessions`,
        severity: 'critical',
        entries: impersonations.map((e) => e.id),
      });
    }
  }

  return flags;
}

/**
 * Generate a GDPR Art.30 compliant processing activities report.
 */
export function generateComplianceReport(
  entries: AuditEntry[],
  period: { start: string; end: string },
): ComplianceReport {
  const filtered = entries.filter(
    (e) => e.timestamp >= period.start && e.timestamp <= period.end,
  );

  const activityMap = new Map<AuditableAction, { admins: Set<string>; subjects: Set<string>; count: number }>();

  for (const e of filtered) {
    const rec = activityMap.get(e.action) ?? { admins: new Set(), subjects: new Set(), count: 0 };
    rec.admins.add(e.adminId);
    if (e.targetId) rec.subjects.add(e.targetId);
    rec.count++;
    activityMap.set(e.action, rec);
  }

  const processingActivities = [...activityMap.entries()].map(([action, rec]) => ({
    action,
    count: rec.count,
    uniqueAdmins: rec.admins.size,
    uniqueDataSubjects: rec.subjects.size,
    legalBasis: LEGAL_BASIS[action],
  }));

  return {
    period,
    processingActivities,
    totalActions: filtered.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate activity metrics for each admin.
 */
export function calculateAdminActivityMetrics(entries: AuditEntry[]): ActivityMetrics[] {
  const byAdmin = new Map<string, AuditEntry[]>();
  for (const e of entries) {
    const list = byAdmin.get(e.adminId) ?? [];
    list.push(e);
    byAdmin.set(e.adminId, list);
  }

  return [...byAdmin.entries()].map(([adminId, adminEntries]) => {
    const actionBreakdown = {} as Record<AuditableAction, number>;
    for (const a of AUDITABLE_ACTIONS) actionBreakdown[a] = 0;
    const hourCounts = new Map<number, number>();
    const targetCounts = new Map<string, number>();

    for (const e of adminEntries) {
      actionBreakdown[e.action] = (actionBreakdown[e.action] ?? 0) + 1;
      const hour = new Date(e.timestamp).getUTCHours();
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
      if (e.targetId) {
        targetCounts.set(e.targetId, (targetCounts.get(e.targetId) ?? 0) + 1);
      }
    }

    let peakHour = 0;
    let peakCount = 0;
    for (const [hour, count] of hourCounts) {
      if (count > peakCount) { peakHour = hour; peakCount = count; }
    }

    const mostAccessedTargets = [...targetCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([targetId, count]) => ({ targetId, count }));

    return { adminId, totalActions: adminEntries.length, actionBreakdown, peakHour, mostAccessedTargets };
  });
}

/**
 * Mask PII fields in an audit entry for long-term log retention.
 */
export function maskSensitiveData(entry: AuditEntry): AuditEntry {
  const maskedIp = entry.ipAddress !== 'unknown'
    ? entry.ipAddress.replace(/\d+$/, '***')
    : 'unknown';

  const maskedTarget = entry.targetId
    ? entry.targetId.slice(0, 4) + '****'
    : null;

  return {
    ...entry,
    ipAddress: maskedIp,
    targetId: maskedTarget,
    metadata: Object.freeze({ masked: true }),
    userAgent: entry.userAgent.slice(0, 20) + '...',
  };
}

/**
 * Build a comprehensive audit report for a given period.
 */
export function buildAuditReport(
  entries: AuditEntry[],
  period: { start: string; end: string },
): AuditReport {
  const filtered = entries.filter(
    (e) => e.timestamp >= period.start && e.timestamp <= period.end,
  );

  const bySensitivity: Record<SensitivityLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const adminCounts = new Map<string, number>();

  for (const e of filtered) {
    bySensitivity[e.sensitivity]++;
    adminCounts.set(e.adminId, (adminCounts.get(e.adminId) ?? 0) + 1);
  }

  const topAdmins = [...adminCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([adminId, actionCount]) => ({ adminId, actionCount }));

  return {
    generatedAt: new Date().toISOString(),
    period,
    totalEntries: filtered.length,
    bySensitivity,
    suspiciousFlags: detectSuspiciousActivity(filtered),
    topAdmins,
  };
}

/**
 * Format an audit report as a human-readable string.
 */
export function formatAuditReport(report: AuditReport): string {
  const lines: string[] = [
    '=== Admin Audit Report ===',
    `Generated: ${report.generatedAt}`,
    `Period: ${report.period.start} to ${report.period.end}`,
    `Total entries: ${report.totalEntries}`,
    '',
    '--- By Sensitivity ---',
    `  Low: ${report.bySensitivity.low}`,
    `  Medium: ${report.bySensitivity.medium}`,
    `  High: ${report.bySensitivity.high}`,
    `  Critical: ${report.bySensitivity.critical}`,
    '',
    '--- Top Admins ---',
    ...report.topAdmins.map((a, i) => `  ${i + 1}. ${a.adminId} (${a.actionCount} actions)`),
  ];
  if (report.suspiciousFlags.length > 0) {
    lines.push('', '--- Suspicious Activity ---');
    for (const f of report.suspiciousFlags) {
      lines.push(`  [${f.severity.toUpperCase()}] ${f.type} (${f.adminId}): ${f.detail}`);
    }
  }
  return lines.join('\n');
}
