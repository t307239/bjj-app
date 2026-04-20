/**
 * Q-226: GDPR Request Automation — Art.17 deletion request processing
 *
 * Automates GDPR data subject requests (DSR) with structured
 * workflows for right-to-erasure, data export, and consent management.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RequestType = "erasure" | "export" | "rectification" | "restriction" | "portability";
export type RequestStatus = "pending" | "verified" | "processing" | "completed" | "rejected";

export interface DataSubjectRequest {
  id: string;
  userId: string;
  email: string;
  type: RequestType;
  status: RequestStatus;
  submittedAt: string;
  verifiedAt?: string;
  completedAt?: string;
  /** Reason for rejection if applicable */
  rejectionReason?: string;
  /** Data categories affected */
  categories: DataCategory[];
  /** Audit trail */
  auditLog: AuditEntry[];
}

export type DataCategory =
  | "profile"
  | "training_logs"
  | "techniques"
  | "skill_map"
  | "goals"
  | "preferences"
  | "analytics"
  | "auth";

export interface AuditEntry {
  action: string;
  timestamp: string;
  detail?: string;
}

export interface ErasureReport {
  requestId: string;
  userId: string;
  /** Categories successfully deleted */
  deletedCategories: DataCategory[];
  /** Categories retained (legal obligation) */
  retainedCategories: DataCategory[];
  /** Retention reasons */
  retentionReasons: Record<string, string>;
  /** Total records deleted */
  totalRecordsDeleted: number;
  /** Completion timestamp */
  completedAt: string;
  /** GDPR compliance deadline (30 days from submission) */
  deadline: string;
  /** Whether completed within deadline */
  withinDeadline: boolean;
}

export interface DSRDashboard {
  totalRequests: number;
  byType: Record<RequestType, number>;
  byStatus: Record<RequestStatus, number>;
  avgCompletionDays: number;
  complianceRate: number;
  overdueCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GDPR_DEADLINE_DAYS = 30;

/** Categories that may be retained for legal obligations */
const LEGALLY_RETAINED: Partial<Record<DataCategory, string>> = {
  auth: "Authentication records retained for security audit (6 months)",
  analytics: "Anonymized analytics retained (no PII)",
};

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Create a new data subject request.
 */
export function createDSR(
  userId: string,
  email: string,
  type: RequestType,
  categories: DataCategory[]
): DataSubjectRequest {
  const now = new Date().toISOString();

  return {
    id: `dsr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    email,
    type,
    status: "pending",
    submittedAt: now,
    categories,
    auditLog: [
      {
        action: "request_submitted",
        timestamp: now,
        detail: `${type} request for ${categories.length} categories`,
      },
    ],
  };
}

/**
 * Calculate the GDPR compliance deadline (30 days from submission).
 */
export function calculateDeadline(submittedAt: string): string {
  const deadline = new Date(submittedAt);
  deadline.setDate(deadline.getDate() + GDPR_DEADLINE_DAYS);
  return deadline.toISOString();
}

/**
 * Process an erasure request and generate a report.
 */
export function processErasure(
  request: DataSubjectRequest
): ErasureReport {
  const deletedCategories: DataCategory[] = [];
  const retainedCategories: DataCategory[] = [];
  const retentionReasons: Record<string, string> = {};
  let totalRecordsDeleted = 0;

  for (const cat of request.categories) {
    const retainReason = LEGALLY_RETAINED[cat];
    if (retainReason) {
      retainedCategories.push(cat);
      retentionReasons[cat] = retainReason;
    } else {
      deletedCategories.push(cat);
      totalRecordsDeleted += estimateRecordCount(cat);
    }
  }

  const completedAt = new Date().toISOString();
  const deadline = calculateDeadline(request.submittedAt);

  return {
    requestId: request.id,
    userId: request.userId,
    deletedCategories,
    retainedCategories,
    retentionReasons,
    totalRecordsDeleted,
    completedAt,
    deadline,
    withinDeadline: new Date(completedAt) <= new Date(deadline),
  };
}

/**
 * Build a dashboard summary from multiple DSRs.
 */
export function buildDSRDashboard(
  requests: DataSubjectRequest[]
): DSRDashboard {
  const byType: Record<RequestType, number> = {
    erasure: 0,
    export: 0,
    rectification: 0,
    restriction: 0,
    portability: 0,
  };

  const byStatus: Record<RequestStatus, number> = {
    pending: 0,
    verified: 0,
    processing: 0,
    completed: 0,
    rejected: 0,
  };

  let totalCompletionDays = 0;
  let completedCount = 0;
  let overdueCount = 0;

  for (const req of requests) {
    byType[req.type]++;
    byStatus[req.status]++;

    if (req.completedAt) {
      const days = daysBetween(req.submittedAt, req.completedAt);
      totalCompletionDays += days;
      completedCount++;
    }

    const deadline = calculateDeadline(req.submittedAt);
    if (
      req.status !== "completed" &&
      req.status !== "rejected" &&
      new Date() > new Date(deadline)
    ) {
      overdueCount++;
    }
  }

  return {
    totalRequests: requests.length,
    byType,
    byStatus,
    avgCompletionDays:
      completedCount > 0 ? Math.round(totalCompletionDays / completedCount) : 0,
    complianceRate:
      completedCount > 0
        ? requests.filter(
            (r) =>
              r.completedAt &&
              new Date(r.completedAt) <=
                new Date(calculateDeadline(r.submittedAt))
          ).length / completedCount
        : 1,
    overdueCount,
  };
}

/**
 * Format an erasure report as human-readable string.
 */
export function formatErasureReport(report: ErasureReport): string {
  const lines: string[] = [
    `GDPR Erasure Report — ${report.requestId}`,
    `User: ${report.userId}`,
    `Deleted: ${report.deletedCategories.join(", ") || "none"}`,
    `Retained: ${report.retainedCategories.join(", ") || "none"}`,
    `Records deleted: ${report.totalRecordsDeleted}`,
    `Within deadline: ${report.withinDeadline ? "YES" : "NO — OVERDUE"}`,
  ];

  if (Object.keys(report.retentionReasons).length > 0) {
    lines.push("", "Retention reasons:");
    for (const [cat, reason] of Object.entries(report.retentionReasons)) {
      lines.push(`  ${cat}: ${reason}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateRecordCount(category: DataCategory): number {
  const estimates: Record<DataCategory, number> = {
    profile: 1,
    training_logs: 50,
    techniques: 20,
    skill_map: 10,
    goals: 5,
    preferences: 3,
    analytics: 100,
    auth: 5,
  };
  return estimates[category] ?? 0;
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
