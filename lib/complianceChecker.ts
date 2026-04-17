/**
 * lib/complianceChecker.ts — Legal compliance verification utilities
 *
 * Q-154: Legal pillar — provides automated compliance checking
 * for GDPR, CCPA, COPPA, and app-specific legal requirements.
 * Verifies that required legal pages exist, consent flows are
 * properly configured, and data handling meets policy requirements.
 *
 * Pure utility layer — no DB access, no UI.
 *
 * @example
 *   import { runComplianceChecks, buildComplianceReport, COMPLIANCE_REQUIREMENTS } from "@/lib/complianceChecker";
 *   const results = runComplianceChecks(appState);
 *   const report = buildComplianceReport(results);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface ComplianceRequirement {
  /** Unique ID */
  id: string;
  /** Display name */
  name: string;
  /** Regulation it belongs to */
  regulation: Regulation;
  /** Description */
  description: string;
  /** Severity if not met */
  severity: "critical" | "warning" | "info";
  /** Article/section reference */
  reference: string;
}

export type Regulation = "GDPR" | "CCPA" | "COPPA" | "CAN-SPAM" | "TOKUSHOHO" | "APP";

export interface ComplianceState {
  /** Privacy policy exists and is up-to-date */
  privacyPolicyExists: boolean;
  /** Terms of service exists */
  termsExists: boolean;
  /** Cookie consent banner active */
  cookieConsentActive: boolean;
  /** Cookie consent has category control */
  cookieCategoryControl: boolean;
  /** Data export functionality available */
  dataExportAvailable: boolean;
  /** Account deletion with grace period */
  accountDeletionAvailable: boolean;
  /** Deletion grace period in days */
  deletionGracePeriodDays: number;
  /** Children's age verification */
  ageVerificationExists: boolean;
  /** DPA page exists */
  dpaExists: boolean;
  /** Tokushoho page exists */
  tokushohoExists: boolean;
  /** Unsubscribe link in emails */
  emailUnsubscribeAvailable: boolean;
  /** Incident notification policy defined */
  incidentPolicyDefined: boolean;
  /** Data retention policy defined */
  retentionPolicyDefined: boolean;
  /** RLS enabled on all tables */
  rlsEnabled: boolean;
  /** Consent version tracking */
  consentVersionTracking: boolean;
}

export interface ComplianceCheckResult {
  /** Requirement that was checked */
  requirement: ComplianceRequirement;
  /** Whether it passed */
  passed: boolean;
  /** Details */
  detail: string;
}

export interface ComplianceReport {
  /** Timestamp */
  timestamp: string;
  /** Results per check */
  results: ComplianceCheckResult[];
  /** Pass rate */
  passRate: number;
  /** Critical failures */
  criticalFailures: ComplianceCheckResult[];
  /** Regulations covered */
  regulationsCovered: Regulation[];
  /** Overall compliance status */
  status: "compliant" | "partial" | "non-compliant";
}

// ── Constants ────────────────────────────────────────────────────────────

export const COMPLIANCE_REQUIREMENTS: ComplianceRequirement[] = [
  // GDPR
  { id: "gdpr_privacy", name: "Privacy Policy", regulation: "GDPR", description: "Publicly accessible privacy policy", severity: "critical", reference: "GDPR Art. 13-14" },
  { id: "gdpr_consent", name: "Cookie Consent", regulation: "GDPR", description: "Cookie consent with category control", severity: "critical", reference: "GDPR Art. 7, ePrivacy" },
  { id: "gdpr_export", name: "Data Portability", regulation: "GDPR", description: "User data export in machine-readable format", severity: "critical", reference: "GDPR Art. 20" },
  { id: "gdpr_deletion", name: "Right to Erasure", regulation: "GDPR", description: "Account deletion capability", severity: "critical", reference: "GDPR Art. 17" },
  { id: "gdpr_dpa", name: "DPA Available", regulation: "GDPR", description: "Data Processing Agreement page", severity: "warning", reference: "GDPR Art. 28" },
  { id: "gdpr_retention", name: "Retention Policy", regulation: "GDPR", description: "Data retention policy documented", severity: "warning", reference: "GDPR Art. 5(1)(e)" },
  { id: "gdpr_incident", name: "Incident Response", regulation: "GDPR", description: "Security incident notification policy", severity: "warning", reference: "GDPR Art. 33-34" },
  { id: "gdpr_rls", name: "Data Isolation", regulation: "GDPR", description: "Row-level security on all user data", severity: "critical", reference: "GDPR Art. 32" },
  { id: "gdpr_consent_version", name: "Consent Versioning", regulation: "GDPR", description: "Consent version tracking for re-consent", severity: "info", reference: "GDPR Art. 7(1)" },

  // CCPA
  { id: "ccpa_privacy", name: "CCPA Notice", regulation: "CCPA", description: "Privacy policy with CCPA-specific sections", severity: "critical", reference: "CCPA §1798.100" },
  { id: "ccpa_deletion", name: "CCPA Deletion", regulation: "CCPA", description: "Right to delete personal information", severity: "critical", reference: "CCPA §1798.105" },

  // COPPA
  { id: "coppa_age", name: "Age Verification", regulation: "COPPA", description: "Children's age verification mechanism", severity: "critical", reference: "COPPA Rule §312.5" },

  // CAN-SPAM
  { id: "canspam_unsub", name: "Unsubscribe", regulation: "CAN-SPAM", description: "Unsubscribe mechanism in commercial emails", severity: "critical", reference: "CAN-SPAM Act §7704" },

  // Tokushoho (Japan)
  { id: "tokushoho_page", name: "Tokushoho Display", regulation: "TOKUSHOHO", description: "Specified commercial transaction display", severity: "critical", reference: "特定商取引法 §11" },

  // App-specific
  { id: "app_terms", name: "Terms of Service", regulation: "APP", description: "Terms of service page", severity: "critical", reference: "App Policy" },
  { id: "app_grace", name: "Deletion Grace Period", regulation: "APP", description: "Account deletion has ≥30 day grace period", severity: "warning", reference: "Best Practice" },
];

// ── Checking ────────────────────────────────────────────────────────────

/**
 * Run all compliance checks against current app state.
 */
export function runComplianceChecks(state: ComplianceState): ComplianceCheckResult[] {
  const checks: Record<string, (s: ComplianceState) => { passed: boolean; detail: string }> = {
    gdpr_privacy: (s) => ({ passed: s.privacyPolicyExists, detail: s.privacyPolicyExists ? "Privacy policy found" : "Privacy policy missing" }),
    gdpr_consent: (s) => ({ passed: s.cookieConsentActive && s.cookieCategoryControl, detail: s.cookieConsentActive ? (s.cookieCategoryControl ? "Cookie consent with categories" : "Cookie consent without category control") : "Cookie consent not active" }),
    gdpr_export: (s) => ({ passed: s.dataExportAvailable, detail: s.dataExportAvailable ? "Data export available" : "Data export not available" }),
    gdpr_deletion: (s) => ({ passed: s.accountDeletionAvailable, detail: s.accountDeletionAvailable ? "Account deletion available" : "Account deletion not available" }),
    gdpr_dpa: (s) => ({ passed: s.dpaExists, detail: s.dpaExists ? "DPA page exists" : "DPA page missing" }),
    gdpr_retention: (s) => ({ passed: s.retentionPolicyDefined, detail: s.retentionPolicyDefined ? "Retention policy defined" : "Retention policy not defined" }),
    gdpr_incident: (s) => ({ passed: s.incidentPolicyDefined, detail: s.incidentPolicyDefined ? "Incident policy defined" : "Incident policy missing" }),
    gdpr_rls: (s) => ({ passed: s.rlsEnabled, detail: s.rlsEnabled ? "RLS enabled" : "RLS not enabled" }),
    gdpr_consent_version: (s) => ({ passed: s.consentVersionTracking, detail: s.consentVersionTracking ? "Consent versioning active" : "Consent versioning not active" }),
    ccpa_privacy: (s) => ({ passed: s.privacyPolicyExists, detail: s.privacyPolicyExists ? "CCPA notice in privacy policy" : "CCPA notice missing" }),
    ccpa_deletion: (s) => ({ passed: s.accountDeletionAvailable, detail: s.accountDeletionAvailable ? "CCPA deletion available" : "CCPA deletion not available" }),
    coppa_age: (s) => ({ passed: s.ageVerificationExists, detail: s.ageVerificationExists ? "Age verification exists" : "Age verification missing" }),
    canspam_unsub: (s) => ({ passed: s.emailUnsubscribeAvailable, detail: s.emailUnsubscribeAvailable ? "Unsubscribe in emails" : "Unsubscribe missing in emails" }),
    tokushoho_page: (s) => ({ passed: s.tokushohoExists, detail: s.tokushohoExists ? "Tokushoho page exists" : "Tokushoho page missing" }),
    app_terms: (s) => ({ passed: s.termsExists, detail: s.termsExists ? "Terms of service found" : "Terms of service missing" }),
    app_grace: (s) => ({ passed: s.deletionGracePeriodDays >= 30, detail: `Grace period: ${s.deletionGracePeriodDays} days (min 30)` }),
  };

  return COMPLIANCE_REQUIREMENTS.map((req) => {
    const checkFn = checks[req.id];
    const result = checkFn ? checkFn(state) : { passed: false, detail: "Check not implemented" };
    return {
      requirement: req,
      passed: result.passed,
      detail: result.detail,
    };
  });
}

/**
 * Build a compliance report from check results.
 */
export function buildComplianceReport(results: ComplianceCheckResult[]): ComplianceReport {
  const passedCount = results.filter((r) => r.passed).length;
  const passRate = results.length > 0 ? passedCount / results.length : 1;
  const criticalFailures = results.filter((r) => !r.passed && r.requirement.severity === "critical");
  const regulationsCovered = [...new Set(results.map((r) => r.requirement.regulation))];

  let status: ComplianceReport["status"];
  if (criticalFailures.length > 0) {
    status = "non-compliant";
  } else if (passRate < 1) {
    status = "partial";
  } else {
    status = "compliant";
  }

  return {
    timestamp: new Date().toISOString(),
    results,
    passRate,
    criticalFailures,
    regulationsCovered,
    status,
  };
}

/**
 * Get requirements by regulation.
 */
export function getRequirementsByRegulation(regulation: Regulation): ComplianceRequirement[] {
  return COMPLIANCE_REQUIREMENTS.filter((r) => r.regulation === regulation);
}

/**
 * Format a compliance report as a human-readable string.
 */
export function formatComplianceReport(report: ComplianceReport): string {
  const icon = report.status === "compliant" ? "✅" : report.status === "partial" ? "⚠️" : "🔴";
  const lines = [
    `${icon} Compliance: ${report.status.toUpperCase()} (${(report.passRate * 100).toFixed(0)}% pass)`,
    `   Regulations: ${report.regulationsCovered.join(", ")}`,
  ];

  if (report.criticalFailures.length > 0) {
    lines.push("", "Critical failures:");
    for (const f of report.criticalFailures) {
      lines.push(`  🔴 ${f.requirement.name} [${f.requirement.reference}]: ${f.detail}`);
    }
  }

  return lines.join("\n");
}
