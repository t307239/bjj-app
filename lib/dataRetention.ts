/**
 * lib/dataRetention.ts — Data retention policy implementation
 *
 * Q-140: Data pillar — codifies data retention periods as described
 * in Privacy Policy §9. Provides utilities to identify data eligible
 * for purging and generate retention compliance reports.
 *
 * This module does NOT delete data — it identifies candidates.
 * Actual deletion requires admin approval and audit logging.
 *
 * @example
 *   import { RETENTION_POLICIES, findPurgeCandidates } from "@/lib/dataRetention";
 *   const candidates = findPurgeCandidates("analytics_events", events, new Date());
 */

// ── Types ────────────────────────────────────────────────────────────────

export type DataCategory =
  | "training_logs"
  | "profile"
  | "payment_records"
  | "push_tokens"
  | "analytics_events"
  | "session_data"
  | "audit_logs"
  | "deleted_accounts";

export interface RetentionPolicy {
  /** Data category */
  category: DataCategory;
  /** Retention period in days */
  retentionDays: number;
  /** Legal basis for retention */
  legalBasis: string;
  /** Whether data is anonymized instead of deleted */
  anonymize: boolean;
  /** Whether user can request earlier deletion */
  userDeletable: boolean;
  /** Description for privacy policy */
  description: string;
}

export interface PurgeCandidate {
  /** Record identifier */
  id: string;
  /** Data category */
  category: DataCategory;
  /** Record creation/update date */
  recordDate: string;
  /** Days past retention period */
  daysOverdue: number;
  /** Recommended action */
  action: "delete" | "anonymize";
}

export interface RetentionReport {
  /** Report generation timestamp */
  generatedAt: string;
  /** Total records analyzed */
  totalRecords: number;
  /** Records within retention period */
  compliant: number;
  /** Records past retention period */
  overdue: number;
  /** Purge candidates by category */
  candidates: Record<DataCategory, number>;
  /** Compliance percentage */
  compliancePercent: number;
}

// ── Retention Policies ───────────────────────────────────────────────────

/**
 * Data retention policies aligned with Privacy Policy §9.
 */
export const RETENTION_POLICIES: Record<DataCategory, RetentionPolicy> = {
  training_logs: {
    category: "training_logs",
    retentionDays: -1, // Indefinite while account active
    legalBasis: "Legitimate interest — core service functionality",
    anonymize: false,
    userDeletable: true,
    description: "Retained while account is active. Deleted 30 days after account deletion.",
  },
  profile: {
    category: "profile",
    retentionDays: -1, // Indefinite while account active
    legalBasis: "Contract performance — user account",
    anonymize: false,
    userDeletable: true,
    description: "Retained while account is active. Soft-deleted with 30-day recovery window.",
  },
  payment_records: {
    category: "payment_records",
    retentionDays: 2555, // ~7 years (tax/accounting requirement)
    legalBasis: "Legal obligation — tax/accounting records (Japan: 7 years)",
    anonymize: true,
    userDeletable: false,
    description: "Retained 7 years per Japanese tax law. Anonymized after period.",
  },
  push_tokens: {
    category: "push_tokens",
    retentionDays: 90,
    legalBasis: "Consent — push notification opt-in",
    anonymize: false,
    userDeletable: true,
    description: "Expired or failed tokens cleaned after 90 days of inactivity.",
  },
  analytics_events: {
    category: "analytics_events",
    retentionDays: 365,
    legalBasis: "Legitimate interest — service improvement",
    anonymize: true,
    userDeletable: false,
    description: "Anonymized after 12 months. Aggregated data retained indefinitely.",
  },
  session_data: {
    category: "session_data",
    retentionDays: 30,
    legalBasis: "Contract performance — authentication",
    anonymize: false,
    userDeletable: false,
    description: "Session tokens expire after 30 days.",
  },
  audit_logs: {
    category: "audit_logs",
    retentionDays: 730, // 2 years
    legalBasis: "Legitimate interest — security and compliance",
    anonymize: true,
    userDeletable: false,
    description: "Retained 2 years for security auditing. Anonymized after period.",
  },
  deleted_accounts: {
    category: "deleted_accounts",
    retentionDays: 30,
    legalBasis: "Contract performance — recovery window",
    anonymize: false,
    userDeletable: false,
    description: "Soft-deleted data retained 30 days for recovery, then permanently deleted.",
  },
};

// ── Purge Candidate Detection ────────────────────────────────────────────

/**
 * Find records that have exceeded their retention period.
 * Returns purge candidates sorted by overdue days (most overdue first).
 *
 * @param category - Data category to check
 * @param records - Array of records with id and date fields
 * @param now - Current date for comparison
 */
export function findPurgeCandidates(
  category: DataCategory,
  records: Array<{ id: string; date: string }>,
  now: Date = new Date(),
): PurgeCandidate[] {
  const policy = RETENTION_POLICIES[category];

  // Indefinite retention — no purge candidates
  if (policy.retentionDays < 0) return [];

  const candidates: PurgeCandidate[] = [];
  const retentionMs = policy.retentionDays * 24 * 60 * 60 * 1000;

  for (const record of records) {
    const recordDate = new Date(record.date);
    const ageMs = now.getTime() - recordDate.getTime();

    if (ageMs > retentionMs) {
      const daysOverdue = Math.floor((ageMs - retentionMs) / (24 * 60 * 60 * 1000));
      candidates.push({
        id: record.id,
        category,
        recordDate: record.date,
        daysOverdue,
        action: policy.anonymize ? "anonymize" : "delete",
      });
    }
  }

  return candidates.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/**
 * Check if a specific record is within its retention period.
 */
export function isWithinRetention(
  category: DataCategory,
  recordDate: string,
  now: Date = new Date(),
): boolean {
  const policy = RETENTION_POLICIES[category];
  if (policy.retentionDays < 0) return true; // Indefinite

  const ageMs = now.getTime() - new Date(recordDate).getTime();
  const retentionMs = policy.retentionDays * 24 * 60 * 60 * 1000;
  return ageMs <= retentionMs;
}

/**
 * Generate a retention compliance report.
 */
export function generateRetentionReport(
  data: Record<DataCategory, Array<{ id: string; date: string }>>,
  now: Date = new Date(),
): RetentionReport {
  let totalRecords = 0;
  let overdue = 0;
  const candidates: Record<string, number> = {};

  for (const [category, records] of Object.entries(data) as Array<[DataCategory, Array<{ id: string; date: string }>]>) {
    totalRecords += records.length;
    const purgeCandidates = findPurgeCandidates(category, records, now);
    overdue += purgeCandidates.length;
    candidates[category] = purgeCandidates.length;
  }

  const compliant = totalRecords - overdue;

  return {
    generatedAt: now.toISOString(),
    totalRecords,
    compliant,
    overdue,
    candidates: candidates as Record<DataCategory, number>,
    compliancePercent: totalRecords > 0
      ? Math.round((compliant / totalRecords) * 100)
      : 100,
  };
}

/**
 * Get all categories that allow user-initiated deletion.
 */
export function getUserDeletableCategories(): DataCategory[] {
  return Object.values(RETENTION_POLICIES)
    .filter((p) => p.userDeletable)
    .map((p) => p.category);
}
