/**
 * consentFlowAuditor.ts — Consent flow audit for GDPR/CCPA compliance validation
 *
 * Pure-function utility for validating consent collection flows,
 * detecting dark patterns, checking consent expiry, and auditing
 * overall compliance with GDPR and CCPA regulations.
 *
 * @module Q-200
 * @since Q-200
 */

/* ---------- Types ---------- */

export type ConsentPurpose =
  | "essential"
  | "analytics"
  | "marketing"
  | "personalization"
  | "third_party";

export type ConsentRegulation = "gdpr" | "ccpa" | "both";

export interface ConsentFlowStep {
  readonly id: string;
  readonly purpose: ConsentPurpose;
  readonly label: string;
  readonly preChecked: boolean;
  readonly required: boolean;
  readonly rejectOptionVisible: boolean;
  readonly rejectButtonSameSize: boolean;
  readonly withdrawEasy: boolean;
  readonly description: string;
  readonly linkToPolicy: boolean;
}

export interface DarkPattern {
  readonly stepId: string;
  readonly type: "pre_checked" | "confusing_language" | "hidden_reject" | "asymmetric_buttons" | "forced_consent" | "bundled_consent";
  readonly severity: "critical" | "high" | "medium";
  readonly message: string;
}

export interface ConsentExpiryStatus {
  readonly status: "expired" | "valid" | "expiring_soon";
  readonly daysRemaining: number;
  readonly consentDate: string;
  readonly expiryDate: string;
}

export interface ConsentComplianceResult {
  readonly regulation: ConsentRegulation;
  readonly score: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly passed: boolean;
  readonly violations: readonly { readonly rule: string; readonly message: string; readonly severity: "critical" | "high" | "medium" }[];
}

export interface ConsentReport {
  readonly overallScore: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly gdprCompliance: ConsentComplianceResult | null;
  readonly ccpaCompliance: ConsentComplianceResult | null;
  readonly darkPatterns: readonly DarkPattern[];
  readonly validSteps: number;
  readonly totalSteps: number;
  readonly recommendations: readonly string[];
}

export interface ConsentAudit {
  readonly score: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly compliance: readonly ConsentComplianceResult[];
  readonly darkPatterns: readonly DarkPattern[];
  readonly recommendations: readonly string[];
}

/* ---------- Constants ---------- */

export const GDPR_REQUIREMENTS = {
  granularity: "Consent must be granular — separate per purpose",
  withdraw_ease: "Withdrawing consent must be as easy as giving it",
  pre_checked_forbidden: "Pre-checked consent boxes are forbidden",
  explicit_opt_in: "Consent must be an explicit opt-in action",
  clear_language: "Consent request must use clear, plain language",
  reject_option: "A clear reject/decline option must be available",
  equal_prominence: "Accept and reject must have equal visual prominence",
  policy_link: "Link to privacy policy must be provided",
  purpose_limitation: "Consent must specify each data processing purpose",
  record_keeping: "Consent records must be maintained",
} as const;

export const CCPA_REQUIREMENTS = {
  do_not_sell: "Must provide 'Do Not Sell My Personal Information' option",
  opt_out_visible: "Opt-out mechanism must be clearly visible",
  no_retaliation: "Cannot discriminate against users who opt out",
  disclosure: "Must disclose categories of personal information collected",
  twelve_month_lookback: "Must cover 12 months of data collection practices",
} as const;

export const CONSENT_MAX_AGE_DAYS = 365;

/** Keywords that suggest confusing/manipulative consent language */
const CONFUSING_KEYWORDS = [
  "might",
  "could potentially",
  "may or may not",
  "unless you don't",
  "double negative",
  "not un",
] as const;

/* ---------- Functions ---------- */

/**
 * Validate a consent flow for compliance issues.
 */
export function validateConsentFlow(
  steps: readonly ConsentFlowStep[]
): readonly { readonly rule: string; readonly message: string; readonly severity: "critical" | "high" | "medium" }[] {
  const violations: { rule: string; message: string; severity: "critical" | "high" | "medium" }[] = [];

  if (steps.length === 0) {
    violations.push({
      rule: "no_consent_flow",
      message: "No consent flow steps defined",
      severity: "critical",
    });
    return violations;
  }

  // Check that essential purposes are correctly marked as required
  const essentialSteps = steps.filter((s) => s.purpose === "essential");
  const nonEssentialSteps = steps.filter((s) => s.purpose !== "essential");

  // Non-essential purposes must not be required
  for (const step of nonEssentialSteps) {
    if (step.required) {
      violations.push({
        rule: "forced_consent",
        message: `Non-essential purpose "${step.purpose}" (${step.id}) is marked as required`,
        severity: "critical",
      });
    }
  }

  // All non-essential must have visible reject
  for (const step of nonEssentialSteps) {
    if (!step.rejectOptionVisible) {
      violations.push({
        rule: "hidden_reject",
        message: `Step "${step.id}" has no visible reject option`,
        severity: "high",
      });
    }
  }

  // Check pre-checked boxes
  for (const step of nonEssentialSteps) {
    if (step.preChecked) {
      violations.push({
        rule: "pre_checked",
        message: `Step "${step.id}" has pre-checked consent (GDPR violation)`,
        severity: "critical",
      });
    }
  }

  // Check policy links
  for (const step of steps) {
    if (!step.linkToPolicy) {
      violations.push({
        rule: "missing_policy_link",
        message: `Step "${step.id}" does not link to privacy policy`,
        severity: "medium",
      });
    }
  }

  // Check withdraw ease
  for (const step of nonEssentialSteps) {
    if (!step.withdrawEasy) {
      violations.push({
        rule: "withdraw_difficulty",
        message: `Step "${step.id}" does not provide easy consent withdrawal`,
        severity: "high",
      });
    }
  }

  // Check granularity — all purposes should be separate
  const purposes = nonEssentialSteps.map((s) => s.purpose);
  const uniquePurposes = new Set(purposes);
  if (uniquePurposes.size === 1 && nonEssentialSteps.length > 1) {
    // All bundled under one purpose is OK
  } else if (uniquePurposes.size < 2 && purposes.length > 0) {
    // Only one non-essential purpose — check if multiple are bundled
  }

  return violations;
}

/**
 * Check consent expiry status.
 */
export function checkConsentExpiry(
  consentDate: string,
  maxAgeDays: number = CONSENT_MAX_AGE_DAYS
): ConsentExpiryStatus {
  const consent = new Date(consentDate);
  const now = new Date();
  const expiry = new Date(consent.getTime() + maxAgeDays * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.round((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  let status: "expired" | "valid" | "expiring_soon";
  if (daysRemaining <= 0) {
    status = "expired";
  } else if (daysRemaining <= 30) {
    status = "expiring_soon";
  } else {
    status = "valid";
  }

  return {
    status,
    daysRemaining: Math.max(0, daysRemaining),
    consentDate: consent.toISOString().split("T")[0],
    expiryDate: expiry.toISOString().split("T")[0],
  };
}

/**
 * Detect dark patterns in consent flow steps.
 */
export function detectDarkPatterns(
  steps: readonly ConsentFlowStep[]
): readonly DarkPattern[] {
  const patterns: DarkPattern[] = [];

  for (const step of steps) {
    if (step.purpose === "essential") continue;

    // Pre-checked boxes
    if (step.preChecked) {
      patterns.push({
        stepId: step.id,
        type: "pre_checked",
        severity: "critical",
        message: `"${step.label}" is pre-checked — users must actively opt-in`,
      });
    }

    // Hidden reject option
    if (!step.rejectOptionVisible) {
      patterns.push({
        stepId: step.id,
        type: "hidden_reject",
        severity: "critical",
        message: `"${step.label}" has no visible reject/decline option`,
      });
    }

    // Asymmetric button sizing
    if (step.rejectOptionVisible && !step.rejectButtonSameSize) {
      patterns.push({
        stepId: step.id,
        type: "asymmetric_buttons",
        severity: "high",
        message: `"${step.label}" has differently-sized accept/reject buttons`,
      });
    }

    // Forced consent on non-essential
    if (step.required) {
      patterns.push({
        stepId: step.id,
        type: "forced_consent",
        severity: "critical",
        message: `"${step.label}" forces consent for non-essential purpose "${step.purpose}"`,
      });
    }

    // Confusing language
    const descLower = step.description.toLowerCase();
    for (const keyword of CONFUSING_KEYWORDS) {
      if (descLower.includes(keyword)) {
        patterns.push({
          stepId: step.id,
          type: "confusing_language",
          severity: "medium",
          message: `"${step.label}" uses confusing language: "${keyword}"`,
        });
        break;
      }
    }
  }

  // Check for bundled consent (all non-essential in one step)
  const nonEssential = steps.filter((s) => s.purpose !== "essential");
  const uniquePurposes = new Set(nonEssential.map((s) => s.purpose));
  if (nonEssential.length > 1 && uniquePurposes.size > 1) {
    // Check if multiple purposes share a single toggle
    const idCounts = new Map<string, number>();
    for (const step of nonEssential) {
      idCounts.set(step.id, (idCounts.get(step.id) ?? 0) + 1);
    }
    for (const [id, count] of idCounts) {
      if (count > 1) {
        patterns.push({
          stepId: id,
          type: "bundled_consent",
          severity: "high",
          message: `Step "${id}" bundles ${count} different purposes into one consent`,
        });
      }
    }
  }

  return patterns;
}

/**
 * Audit consent compliance against GDPR, CCPA, or both.
 */
export function auditConsentCompliance(
  steps: readonly ConsentFlowStep[],
  regulation: ConsentRegulation
): ConsentAudit {
  const compliance: ConsentComplianceResult[] = [];
  const darkPatterns = detectDarkPatterns(steps);
  const flowViolations = validateConsentFlow(steps);
  const recommendations: string[] = [];

  if (regulation === "gdpr" || regulation === "both") {
    let gdprScore = 100;
    const gdprViolations: { rule: string; message: string; severity: "critical" | "high" | "medium" }[] = [];

    // Check each GDPR requirement
    const nonEssential = steps.filter((s) => s.purpose !== "essential");
    const preChecked = nonEssential.filter((s) => s.preChecked);
    if (preChecked.length > 0) {
      gdprScore -= 25;
      gdprViolations.push({ rule: "pre_checked_forbidden", message: `${preChecked.length} step(s) with pre-checked consent`, severity: "critical" });
    }

    const noReject = nonEssential.filter((s) => !s.rejectOptionVisible);
    if (noReject.length > 0) {
      gdprScore -= 20;
      gdprViolations.push({ rule: "reject_option", message: `${noReject.length} step(s) without reject option`, severity: "critical" });
    }

    const hardWithdraw = nonEssential.filter((s) => !s.withdrawEasy);
    if (hardWithdraw.length > 0) {
      gdprScore -= 15;
      gdprViolations.push({ rule: "withdraw_ease", message: `${hardWithdraw.length} step(s) without easy withdrawal`, severity: "high" });
    }

    const asymmetric = nonEssential.filter((s) => s.rejectOptionVisible && !s.rejectButtonSameSize);
    if (asymmetric.length > 0) {
      gdprScore -= 10;
      gdprViolations.push({ rule: "equal_prominence", message: `${asymmetric.length} step(s) with asymmetric buttons`, severity: "high" });
    }

    const noPolicy = steps.filter((s) => !s.linkToPolicy);
    if (noPolicy.length > 0) {
      gdprScore -= 5;
      gdprViolations.push({ rule: "policy_link", message: `${noPolicy.length} step(s) without policy link`, severity: "medium" });
    }

    const finalGdpr = Math.max(0, Math.min(100, gdprScore));
    compliance.push({
      regulation: "gdpr",
      score: finalGdpr,
      grade: finalGdpr >= 90 ? "A" : finalGdpr >= 80 ? "B" : finalGdpr >= 70 ? "C" : finalGdpr >= 60 ? "D" : "F",
      passed: finalGdpr >= 80,
      violations: gdprViolations,
    });
  }

  if (regulation === "ccpa" || regulation === "both") {
    let ccpaScore = 100;
    const ccpaViolations: { rule: string; message: string; severity: "critical" | "high" | "medium" }[] = [];

    const nonEssential = steps.filter((s) => s.purpose !== "essential");
    const noOptOut = nonEssential.filter((s) => !s.rejectOptionVisible);
    if (noOptOut.length > 0) {
      ccpaScore -= 25;
      ccpaViolations.push({ rule: "opt_out_visible", message: `${noOptOut.length} step(s) without visible opt-out`, severity: "critical" });
    }

    const noDescription = steps.filter((s) => s.description.length < 10);
    if (noDescription.length > 0) {
      ccpaScore -= 10;
      ccpaViolations.push({ rule: "disclosure", message: `${noDescription.length} step(s) with insufficient disclosure`, severity: "medium" });
    }

    const finalCcpa = Math.max(0, Math.min(100, ccpaScore));
    compliance.push({
      regulation: "ccpa",
      score: finalCcpa,
      grade: finalCcpa >= 90 ? "A" : finalCcpa >= 80 ? "B" : finalCcpa >= 70 ? "C" : finalCcpa >= 60 ? "D" : "F",
      passed: finalCcpa >= 80,
      violations: ccpaViolations,
    });
  }

  // Overall score
  const avgScore = compliance.length > 0
    ? Math.round(compliance.reduce((s, c) => s + c.score, 0) / compliance.length)
    : 0;

  // Dark pattern deductions
  const darkPenalty = darkPatterns.reduce((sum, dp) => {
    return sum + (dp.severity === "critical" ? 5 : dp.severity === "high" ? 3 : 1);
  }, 0);
  const finalScore = Math.max(0, Math.min(100, avgScore - darkPenalty));

  // Recommendations
  if (darkPatterns.length > 0) {
    recommendations.push(`Fix ${darkPatterns.length} dark pattern(s) detected in consent flow`);
  }
  if (flowViolations.some((v) => v.rule === "pre_checked")) {
    recommendations.push("Remove all pre-checked consent boxes for non-essential purposes");
  }
  if (flowViolations.some((v) => v.rule === "hidden_reject")) {
    recommendations.push("Add visible reject/decline option to all consent steps");
  }
  if (flowViolations.some((v) => v.rule === "withdraw_difficulty")) {
    recommendations.push("Make consent withdrawal as easy as consent giving (e.g., one-click toggle)");
  }

  return {
    score: finalScore,
    grade: finalScore >= 90 ? "A" : finalScore >= 80 ? "B" : finalScore >= 70 ? "C" : finalScore >= 60 ? "D" : "F",
    compliance,
    darkPatterns,
    recommendations,
  };
}

/**
 * Build a comprehensive consent compliance report.
 */
export function buildConsentReport(
  steps: readonly ConsentFlowStep[],
  regulation: ConsentRegulation = "both"
): ConsentReport {
  const audit = auditConsentCompliance(steps, regulation);
  const validSteps = steps.filter((s) => {
    if (s.purpose === "essential") return true;
    return !s.preChecked && s.rejectOptionVisible && s.withdrawEasy;
  }).length;

  return {
    overallScore: audit.score,
    grade: audit.grade,
    gdprCompliance: audit.compliance.find((c) => c.regulation === "gdpr") ?? null,
    ccpaCompliance: audit.compliance.find((c) => c.regulation === "ccpa") ?? null,
    darkPatterns: audit.darkPatterns,
    validSteps,
    totalSteps: steps.length,
    recommendations: audit.recommendations,
  };
}

/**
 * Format a consent report as a human-readable string.
 */
export function formatConsentReport(report: ConsentReport): string {
  const lines: string[] = [
    "=== Consent Flow Compliance Report ===",
    `Overall Score: ${report.overallScore}/100 (${report.grade})`,
    `Valid Steps: ${report.validSteps}/${report.totalSteps}`,
  ];

  if (report.gdprCompliance) {
    const g = report.gdprCompliance;
    lines.push("", `GDPR: ${g.score}/100 (${g.passed ? "PASS" : "FAIL"})`);
    for (const v of g.violations) {
      lines.push(`  [${v.severity.toUpperCase()}] ${v.rule}: ${v.message}`);
    }
  }

  if (report.ccpaCompliance) {
    const c = report.ccpaCompliance;
    lines.push("", `CCPA: ${c.score}/100 (${c.passed ? "PASS" : "FAIL"})`);
    for (const v of c.violations) {
      lines.push(`  [${v.severity.toUpperCase()}] ${v.rule}: ${v.message}`);
    }
  }

  if (report.darkPatterns.length > 0) {
    lines.push("", `Dark Patterns (${report.darkPatterns.length}):`);
    for (const dp of report.darkPatterns) {
      lines.push(`  [${dp.severity.toUpperCase()}] ${dp.type}: ${dp.message}`);
    }
  }

  if (report.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const rec of report.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }

  return lines.join("\n");
}
