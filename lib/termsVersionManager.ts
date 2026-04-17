/**
 * Q-183: Terms Version Manager (Legal 94→95)
 *
 * Legal document version tracking, user consent management,
 * re-acceptance detection, and compliance audit trail for SaaS-grade legal compliance.
 */

// ── Types & Constants ──────────────────────────────────────

export interface TermsVersion {
  id: string;           // e.g. "tos-2.1"
  document: TermsDocType;
  version: string;      // semver
  effectiveDate: string; // ISO date
  summary: string;      // human-readable change summary
  requiresReAcceptance: boolean;
  changes: TermsChange[];
}

export type TermsDocType = "tos" | "privacy" | "cookie" | "dpa" | "ccpa";

export interface TermsChange {
  section: string;
  type: "added" | "modified" | "removed";
  description: string;
  materialChange: boolean;
}

export interface UserConsent {
  userId: string;
  document: TermsDocType;
  version: string;
  acceptedAt: string;  // ISO timestamp
  ipHash?: string;     // hashed IP for audit
}

export interface ConsentStatus {
  document: TermsDocType;
  currentVersion: string;
  userVersion: string | null;
  isAccepted: boolean;
  needsReAcceptance: boolean;
  daysSinceAcceptance: number | null;
}

export interface ConsentAuditReport {
  userId: string;
  statuses: ConsentStatus[];
  allCurrent: boolean;
  pendingDocuments: TermsDocType[];
  summary: string;
}

export const TERMS_DOCUMENTS: Record<TermsDocType, string> = {
  tos: "Terms of Service",
  privacy: "Privacy Policy",
  cookie: "Cookie Policy",
  dpa: "Data Processing Agreement",
  ccpa: "CCPA Notice",
};

export const CONSENT_MAX_AGE_DAYS = 365;

// ── Version Comparison ─────────────────────────────────────

/**
 * Compare two version strings (semver)
 */
export function compareTermsVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/**
 * Check if a user consent version matches the current version
 */
export function isConsentCurrent(
  userVersion: string | null,
  currentVersion: string
): boolean {
  if (!userVersion) return false;
  return compareTermsVersions(userVersion, currentVersion) >= 0;
}

// ── Consent Status ─────────────────────────────────────────

/**
 * Get consent status for a single document
 */
export function getConsentStatus(
  currentVersion: TermsVersion,
  userConsent: UserConsent | null
): ConsentStatus {
  const isAccepted = userConsent
    ? isConsentCurrent(userConsent.version, currentVersion.version)
    : false;

  let daysSinceAcceptance: number | null = null;
  if (userConsent) {
    const accepted = new Date(userConsent.acceptedAt).getTime();
    const now = Date.now();
    daysSinceAcceptance = Math.floor((now - accepted) / (1000 * 60 * 60 * 24));
  }

  const needsReAcceptance =
    !isAccepted ||
    (currentVersion.requiresReAcceptance && !isAccepted) ||
    (daysSinceAcceptance !== null && daysSinceAcceptance > CONSENT_MAX_AGE_DAYS);

  return {
    document: currentVersion.document,
    currentVersion: currentVersion.version,
    userVersion: userConsent?.version ?? null,
    isAccepted,
    needsReAcceptance,
    daysSinceAcceptance,
  };
}

/**
 * Build full consent audit report for a user
 */
export function buildConsentAudit(
  userId: string,
  currentVersions: TermsVersion[],
  userConsents: UserConsent[]
): ConsentAuditReport {
  const consentMap = new Map<TermsDocType, UserConsent>();
  for (const consent of userConsents) {
    const existing = consentMap.get(consent.document);
    if (!existing || compareTermsVersions(consent.version, existing.version) > 0) {
      consentMap.set(consent.document, consent);
    }
  }

  const statuses = currentVersions.map((cv) =>
    getConsentStatus(cv, consentMap.get(cv.document) ?? null)
  );

  const pendingDocuments = statuses
    .filter((s) => s.needsReAcceptance)
    .map((s) => s.document);

  const allCurrent = pendingDocuments.length === 0;

  const summary = allCurrent
    ? "All legal documents are up to date"
    : `${pendingDocuments.length} document(s) require re-acceptance: ${pendingDocuments.map((d) => TERMS_DOCUMENTS[d]).join(", ")}`;

  return { userId, statuses, allCurrent, pendingDocuments, summary };
}

// ── Change Detection ───────────────────────────────────────

/**
 * Detect material changes between versions
 */
export function detectMaterialChanges(version: TermsVersion): TermsChange[] {
  return version.changes.filter((c) => c.materialChange);
}

/**
 * Check if version requires user notification
 */
export function requiresNotification(version: TermsVersion): boolean {
  return (
    version.requiresReAcceptance ||
    version.changes.some((c) => c.materialChange)
  );
}

/**
 * Build notification message for terms update
 */
export function buildUpdateNotification(version: TermsVersion): string {
  const docName = TERMS_DOCUMENTS[version.document];
  const materialChanges = detectMaterialChanges(version);
  const lines = [
    `${docName} has been updated to version ${version.version}`,
    `Effective: ${version.effectiveDate}`,
    ``,
    version.summary,
  ];
  if (materialChanges.length > 0) {
    lines.push(``, `Key changes:`);
    for (const change of materialChanges) {
      lines.push(`- [${change.type}] ${change.section}: ${change.description}`);
    }
  }
  if (version.requiresReAcceptance) {
    lines.push(``, `⚠️ You must re-accept this document to continue using the service.`);
  }
  return lines.join("\n");
}

/**
 * Format consent audit as readable string
 */
export function formatConsentAudit(report: ConsentAuditReport): string {
  const lines = [
    `# Consent Audit — User ${report.userId}`,
    `Status: ${report.allCurrent ? "✅ All current" : "⚠️ Action required"}`,
    ``,
  ];
  for (const status of report.statuses) {
    const docName = TERMS_DOCUMENTS[status.document];
    const icon = status.needsReAcceptance ? "❌" : "✅";
    lines.push(
      `${icon} ${docName}: v${status.userVersion ?? "none"} / v${status.currentVersion}` +
        (status.daysSinceAcceptance !== null
          ? ` (${status.daysSinceAcceptance}d ago)`
          : "")
    );
  }
  return lines.join("\n");
}
