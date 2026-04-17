/**
 * lib/consentManager.ts — User consent management utilities
 *
 * Q-138: Legal pillar — tracks and validates user consent records
 * for GDPR Art.7 compliance. Manages consent versioning, expiration,
 * and audit trail generation.
 *
 * Consent types:
 * - privacy_policy: agreement to current privacy policy version
 * - cookie_essential: required cookies (cannot be withdrawn)
 * - cookie_analytics: optional analytics cookies
 * - cookie_marketing: optional marketing cookies
 * - email_weekly: weekly report email subscription
 * - push_notifications: push notification permission
 * - data_processing: explicit consent for data processing (GDPR Art.6)
 *
 * @example
 *   import { createConsentRecord, isConsentValid, CONSENT_VERSIONS } from "@/lib/consentManager";
 *   const record = createConsentRecord("user-123", "privacy_policy", true);
 *   const valid = isConsentValid(record, CONSENT_VERSIONS.privacy_policy);
 */

// ── Consent Types ────────────────────────────────────────────────────────

export type ConsentType =
  | "privacy_policy"
  | "cookie_essential"
  | "cookie_analytics"
  | "cookie_marketing"
  | "email_weekly"
  | "push_notifications"
  | "data_processing";

export interface ConsentRecord {
  /** User ID */
  userId: string;
  /** Type of consent */
  type: ConsentType;
  /** Whether consent was granted */
  granted: boolean;
  /** Version of the policy consented to */
  policyVersion: string;
  /** ISO timestamp when consent was given/withdrawn */
  timestamp: string;
  /** IP address (hashed) for audit trail — optional */
  ipHash?: string;
  /** User agent for audit trail — optional */
  userAgent?: string;
  /** Method of consent collection */
  method: "banner" | "settings" | "signup" | "api";
}

export interface ConsentSummary {
  userId: string;
  consents: Record<ConsentType, { granted: boolean; version: string; timestamp: string }>;
  allRequired: boolean;
  lastUpdated: string;
}

// ── Consent Versions ─────────────────────────────────────────────────────

/**
 * Current policy versions. When a policy is updated, increment the version.
 * Users with older versions need to re-consent.
 */
export const CONSENT_VERSIONS: Record<ConsentType, string> = {
  privacy_policy: "2.0",
  cookie_essential: "1.0",
  cookie_analytics: "1.0",
  cookie_marketing: "1.0",
  email_weekly: "1.0",
  push_notifications: "1.0",
  data_processing: "1.0",
};

/**
 * Maximum consent validity period (days).
 * After this period, consent should be re-confirmed.
 * GDPR doesn't specify exact duration but recommends periodic renewal.
 */
export const CONSENT_MAX_AGE_DAYS: Record<ConsentType, number> = {
  privacy_policy: 365,
  cookie_essential: 365,
  cookie_analytics: 180,
  cookie_marketing: 180,
  email_weekly: 365,
  push_notifications: 365,
  data_processing: 365,
};

/** Required consents that cannot be opted out of */
export const REQUIRED_CONSENTS: ConsentType[] = [
  "privacy_policy",
  "cookie_essential",
  "data_processing",
];

// ── Consent Record Management ────────────────────────────────────────────

/**
 * Create a new consent record with current version and timestamp.
 */
export function createConsentRecord(
  userId: string,
  type: ConsentType,
  granted: boolean,
  method: ConsentRecord["method"] = "settings",
): ConsentRecord {
  return {
    userId,
    type,
    granted,
    policyVersion: CONSENT_VERSIONS[type],
    timestamp: new Date().toISOString(),
    method,
  };
}

/**
 * Check if a consent record is still valid.
 * Invalid if:
 * 1. Policy version has been updated since consent
 * 2. Consent has expired (older than max age)
 * 3. Consent was not granted
 */
export function isConsentValid(
  record: ConsentRecord,
  currentVersion: string = CONSENT_VERSIONS[record.type],
  now: Date = new Date(),
): boolean {
  if (!record.granted) return false;

  // Version check
  if (record.policyVersion !== currentVersion) return false;

  // Expiry check
  const maxAgeDays = CONSENT_MAX_AGE_DAYS[record.type];
  const consentDate = new Date(record.timestamp);
  const ageMs = now.getTime() - consentDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > maxAgeDays) return false;

  return true;
}

/**
 * Find consent records that need renewal (expired or outdated version).
 */
export function findExpiredConsents(
  records: ConsentRecord[],
  now: Date = new Date(),
): ConsentRecord[] {
  return records.filter((r) => r.granted && !isConsentValid(r, CONSENT_VERSIONS[r.type], now));
}

/**
 * Build a consent summary for a user from their consent records.
 * Uses the most recent record for each consent type.
 */
export function buildConsentSummary(
  userId: string,
  records: ConsentRecord[],
): ConsentSummary {
  const consents = {} as ConsentSummary["consents"];
  let lastUpdated = "";

  // Sort by timestamp descending to get latest first
  const sorted = [...records]
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  for (const record of sorted) {
    if (!consents[record.type]) {
      consents[record.type] = {
        granted: record.granted,
        version: record.policyVersion,
        timestamp: record.timestamp,
      };
      if (!lastUpdated || record.timestamp > lastUpdated) {
        lastUpdated = record.timestamp;
      }
    }
  }

  const allRequired = REQUIRED_CONSENTS.every(
    (type) => consents[type]?.granted === true,
  );

  return { userId, consents, allRequired, lastUpdated };
}

/**
 * Generate an audit log entry for consent changes.
 */
export function formatConsentAuditEntry(record: ConsentRecord): string {
  const action = record.granted ? "GRANTED" : "WITHDRAWN";
  return `[${record.timestamp}] ${action} ${record.type} v${record.policyVersion} by ${record.userId} via ${record.method}`;
}
