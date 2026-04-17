/**
 * lib/privacyImpactAssessment.ts — Privacy Impact Assessment (PIA/DPIA)
 *
 * Q-168: Legal pillar 93→94 — GDPR Art.35 Data Protection Impact
 * Assessment template with automated risk scoring, data flow mapping,
 * mitigation recommendations, and report generation.
 *
 * Pure utility layer — produces assessment structures and reports.
 *
 * @example
 *   import { createAssessment, scoreRisk, generatePIAReport } from "@/lib/privacyImpactAssessment";
 *
 *   const pia = createAssessment({
 *     name: "Training Log Feature",
 *     dataTypes: ["personal", "health"],
 *     processing: ["collection", "storage", "analysis"],
 *   });
 *   // → { overallRisk: "medium", mitigations: [...], ... }
 */

// ── Types ───────────────────────────────────────────────────────────────

export type DataCategory =
  | "personal"       // Name, email, profile
  | "health"         // Weight, injuries, body measurements
  | "behavioral"     // Training frequency, techniques, patterns
  | "financial"      // Payment info (via Stripe)
  | "location"       // Gym location/check-ins
  | "communication"  // Push tokens, email preferences
  | "technical"      // Device info, IP, user agent
  | "children";      // Under-16 data (GDPR special category)

export type ProcessingActivity =
  | "collection"
  | "storage"
  | "analysis"
  | "profiling"
  | "automated_decision"
  | "sharing_third_party"
  | "cross_border_transfer"
  | "retention"
  | "deletion";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskFactor {
  /** Risk factor ID */
  id: string;
  /** Category of risk */
  category: "data_sensitivity" | "processing_scope" | "data_subject" | "technology" | "third_party";
  /** Description */
  description: string;
  /** Impact score (1-5) */
  impact: number;
  /** Likelihood score (1-5) */
  likelihood: number;
  /** Calculated risk score (impact × likelihood) */
  score: number;
  /** Risk level derived from score */
  level: RiskLevel;
}

export interface Mitigation {
  /** Mitigation ID */
  id: string;
  /** Which risk factor this addresses */
  riskFactorId: string;
  /** Mitigation description */
  description: string;
  /** Implementation status */
  status: "implemented" | "planned" | "not_started";
  /** Residual risk after mitigation */
  residualRisk: RiskLevel;
}

export interface DataFlow {
  /** Source of data */
  source: string;
  /** Destination */
  destination: string;
  /** Data categories in this flow */
  dataCategories: DataCategory[];
  /** Legal basis for processing */
  legalBasis: string;
  /** Whether encryption is applied */
  encrypted: boolean;
}

export interface PIAAssessment {
  /** Assessment name */
  name: string;
  /** Assessment date (ISO string) */
  date: string;
  /** Assessor */
  assessor: string;
  /** Data categories involved */
  dataCategories: DataCategory[];
  /** Processing activities */
  processingActivities: ProcessingActivity[];
  /** Risk factors identified */
  riskFactors: RiskFactor[];
  /** Mitigations applied or planned */
  mitigations: Mitigation[];
  /** Data flow map */
  dataFlows: DataFlow[];
  /** Overall risk level */
  overallRisk: RiskLevel;
  /** Whether DPIA is required per GDPR Art.35 */
  dpiaRequired: boolean;
  /** DPIA requirement reason */
  dpiaReason: string;
  /** Recommendations */
  recommendations: string[];
}

// ── Risk Scoring Constants ─────────────────────────────────────────────

/** Data sensitivity weights */
export const DATA_SENSITIVITY: Record<DataCategory, number> = {
  children: 5,
  health: 4,
  financial: 4,
  location: 3,
  personal: 2,
  behavioral: 2,
  communication: 2,
  technical: 1,
};

/** Processing risk weights */
export const PROCESSING_RISK: Record<ProcessingActivity, number> = {
  automated_decision: 5,
  cross_border_transfer: 4,
  profiling: 4,
  sharing_third_party: 3,
  analysis: 2,
  collection: 2,
  storage: 1,
  retention: 1,
  deletion: 1,
};

/** DPIA trigger conditions (GDPR Art.35 + WP29 guidelines) */
export const DPIA_TRIGGERS = [
  { condition: "health data processing", check: (cats: DataCategory[]) => cats.includes("health") },
  { condition: "children's data processing", check: (cats: DataCategory[]) => cats.includes("children") },
  { condition: "systematic profiling", check: (_c: DataCategory[], procs: ProcessingActivity[]) => procs.includes("profiling") },
  { condition: "automated decision-making", check: (_c: DataCategory[], procs: ProcessingActivity[]) => procs.includes("automated_decision") },
  { condition: "large-scale processing of sensitive data", check: (cats: DataCategory[]) => cats.filter((c) => DATA_SENSITIVITY[c] >= 4).length >= 2 },
  { condition: "cross-border data transfer", check: (_c: DataCategory[], procs: ProcessingActivity[]) => procs.includes("cross_border_transfer") },
] as const;

// ── Predefined Mitigations ─────────────────────────────────────────────

/** Standard mitigation library */
export const STANDARD_MITIGATIONS: Record<string, Omit<Mitigation, "riskFactorId" | "status">> = {
  encryption_at_rest: {
    id: "mit_encrypt_rest",
    description: "Encrypt all personal data at rest using AES-256 (Supabase default)",
    residualRisk: "low",
  },
  encryption_in_transit: {
    id: "mit_encrypt_transit",
    description: "Enforce TLS 1.2+ for all data in transit",
    residualRisk: "low",
  },
  access_control: {
    id: "mit_access_ctrl",
    description: "Implement Row-Level Security (RLS) to isolate user data",
    residualRisk: "low",
  },
  data_minimization: {
    id: "mit_minimize",
    description: "Collect only necessary data fields; avoid over-collection",
    residualRisk: "low",
  },
  consent_management: {
    id: "mit_consent",
    description: "Implement granular consent with version tracking and expiry",
    residualRisk: "low",
  },
  retention_policy: {
    id: "mit_retention",
    description: "Apply data retention policies with automatic purging schedules",
    residualRisk: "low",
  },
  anonymization: {
    id: "mit_anonymize",
    description: "Anonymize or pseudonymize data used for analytics/profiling",
    residualRisk: "low",
  },
  breach_response: {
    id: "mit_breach",
    description: "Maintain incident response plan with 72-hour GDPR notification",
    residualRisk: "medium",
  },
  dpo_review: {
    id: "mit_dpo",
    description: "Regular DPO review of data processing activities",
    residualRisk: "low",
  },
  third_party_audit: {
    id: "mit_3p_audit",
    description: "Audit third-party processors (Stripe, Supabase, Vercel) for compliance",
    residualRisk: "medium",
  },
};

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Calculate risk score from impact and likelihood.
 *
 * @param impact - Impact score (1-5)
 * @param likelihood - Likelihood score (1-5)
 * @returns Risk score and level
 */
export function scoreRisk(impact: number, likelihood: number): { score: number; level: RiskLevel } {
  const score = Math.min(impact, 5) * Math.min(likelihood, 5);
  const level: RiskLevel =
    score >= 20 ? "critical" :
    score >= 12 ? "high" :
    score >= 6 ? "medium" :
    "low";
  return { score, level };
}

/**
 * Check if a DPIA is required based on data categories and processing.
 *
 * @param dataCategories - Types of data being processed
 * @param processingActivities - Types of processing
 * @returns Whether DPIA is required and the triggering reason
 */
export function checkDPIARequired(
  dataCategories: DataCategory[],
  processingActivities: ProcessingActivity[]
): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];

  for (const trigger of DPIA_TRIGGERS) {
    if (trigger.check(dataCategories, processingActivities)) {
      reasons.push(trigger.condition);
    }
  }

  return { required: reasons.length > 0, reasons };
}

/**
 * Generate risk factors based on data categories and processing activities.
 *
 * @param dataCategories - Types of data
 * @param processingActivities - Types of processing
 * @returns Array of identified risk factors
 */
export function identifyRiskFactors(
  dataCategories: DataCategory[],
  processingActivities: ProcessingActivity[]
): RiskFactor[] {
  const factors: RiskFactor[] = [];
  let idCounter = 1;

  // Data sensitivity risks
  for (const cat of dataCategories) {
    const sensitivity = DATA_SENSITIVITY[cat];
    if (sensitivity >= 3) {
      const likelihood = processingActivities.includes("sharing_third_party") ? 4 :
        processingActivities.includes("cross_border_transfer") ? 3 : 2;
      const { score, level } = scoreRisk(sensitivity, likelihood);
      factors.push({
        id: `rf_${idCounter++}`,
        category: "data_sensitivity",
        description: `Processing of ${cat} data (sensitivity: ${sensitivity}/5)`,
        impact: sensitivity,
        likelihood,
        score,
        level,
      });
    }
  }

  // Processing scope risks
  for (const proc of processingActivities) {
    const risk = PROCESSING_RISK[proc];
    if (risk >= 3) {
      const impact = dataCategories.some((c) => DATA_SENSITIVITY[c] >= 4) ? 4 : 3;
      const { score, level } = scoreRisk(impact, risk);
      factors.push({
        id: `rf_${idCounter++}`,
        category: "processing_scope",
        description: `${proc.replace(/_/g, " ")} activity (risk weight: ${risk}/5)`,
        impact,
        likelihood: risk,
        score,
        level,
      });
    }
  }

  // Data subject vulnerability (children)
  if (dataCategories.includes("children")) {
    const { score, level } = scoreRisk(5, 3);
    factors.push({
      id: `rf_${idCounter++}`,
      category: "data_subject",
      description: "Processing data of minors (vulnerable data subjects)",
      impact: 5,
      likelihood: 3,
      score,
      level,
    });
  }

  // Third-party risk
  if (processingActivities.includes("sharing_third_party")) {
    const maxSensitivity = Math.max(...dataCategories.map((c) => DATA_SENSITIVITY[c]));
    const { score, level } = scoreRisk(maxSensitivity, 3);
    factors.push({
      id: `rf_${idCounter++}`,
      category: "third_party",
      description: "Data sharing with third-party processors",
      impact: maxSensitivity,
      likelihood: 3,
      score,
      level,
    });
  }

  return factors;
}

/**
 * Suggest mitigations for identified risk factors.
 *
 * @param riskFactors - Identified risk factors
 * @param dataCategories - Data categories being processed
 * @returns Array of suggested mitigations
 */
export function suggestMitigations(
  riskFactors: RiskFactor[],
  dataCategories: DataCategory[]
): Mitigation[] {
  const mitigations: Mitigation[] = [];
  const usedMitigations = new Set<string>();

  // Always recommend basics
  const alwaysApply = ["encryption_at_rest", "encryption_in_transit", "access_control"];
  for (const key of alwaysApply) {
    const template = STANDARD_MITIGATIONS[key];
    if (template && !usedMitigations.has(key)) {
      usedMitigations.add(key);
      mitigations.push({
        ...template,
        riskFactorId: riskFactors[0]?.id ?? "general",
        status: "implemented",
      });
    }
  }

  // Add based on data categories
  if (dataCategories.includes("health") || dataCategories.includes("children")) {
    for (const key of ["consent_management", "data_minimization", "anonymization"]) {
      if (!usedMitigations.has(key)) {
        const template = STANDARD_MITIGATIONS[key];
        if (template) {
          usedMitigations.add(key);
          mitigations.push({
            ...template,
            riskFactorId: riskFactors.find((f) => f.category === "data_sensitivity")?.id ?? "general",
            status: "implemented",
          });
        }
      }
    }
  }

  // Add based on risk levels
  for (const factor of riskFactors) {
    if (factor.level === "high" || factor.level === "critical") {
      if (factor.category === "third_party" && !usedMitigations.has("third_party_audit")) {
        usedMitigations.add("third_party_audit");
        const template = STANDARD_MITIGATIONS.third_party_audit;
        if (template) {
          mitigations.push({ ...template, riskFactorId: factor.id, status: "planned" });
        }
      }
      if (!usedMitigations.has("breach_response")) {
        usedMitigations.add("breach_response");
        const template = STANDARD_MITIGATIONS.breach_response;
        if (template) {
          mitigations.push({ ...template, riskFactorId: factor.id, status: "implemented" });
        }
      }
    }
  }

  // Retention policy
  if (!usedMitigations.has("retention_policy")) {
    const template = STANDARD_MITIGATIONS.retention_policy;
    if (template) {
      mitigations.push({
        ...template,
        riskFactorId: "general",
        status: "implemented",
      });
    }
  }

  return mitigations;
}

/**
 * Create a full Privacy Impact Assessment.
 *
 * @param input - Assessment parameters
 * @returns Complete PIA assessment
 */
export function createAssessment(input: {
  name: string;
  dataCategories: DataCategory[];
  processingActivities: ProcessingActivity[];
  assessor?: string;
  dataFlows?: DataFlow[];
}): PIAAssessment {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // JST
  const date = now.toISOString().split("T")[0];

  const { required: dpiaRequired, reasons: dpiaReasons } = checkDPIARequired(
    input.dataCategories,
    input.processingActivities
  );

  const riskFactors = identifyRiskFactors(input.dataCategories, input.processingActivities);
  const mitigations = suggestMitigations(riskFactors, input.dataCategories);

  // Calculate overall risk (highest unmitigated risk)
  const maxScore = riskFactors.length > 0
    ? Math.max(...riskFactors.map((f) => f.score))
    : 0;
  const overallRisk: RiskLevel =
    maxScore >= 20 ? "critical" :
    maxScore >= 12 ? "high" :
    maxScore >= 6 ? "medium" :
    "low";

  // Generate recommendations
  const recommendations: string[] = [];
  if (dpiaRequired) {
    recommendations.push("DPIA is required — document this assessment formally");
  }
  if (riskFactors.some((f) => f.level === "critical")) {
    recommendations.push("Critical risks identified — consult with DPO before proceeding");
  }
  if (input.dataCategories.includes("children")) {
    recommendations.push("Implement age verification and parental consent mechanisms");
  }
  if (input.processingActivities.includes("profiling")) {
    recommendations.push("Provide opt-out mechanism for profiling activities");
  }
  if (input.processingActivities.includes("cross_border_transfer")) {
    recommendations.push("Ensure Standard Contractual Clauses (SCCs) are in place");
  }
  if (mitigations.some((m) => m.status === "not_started")) {
    recommendations.push("Prioritize implementation of planned mitigations before launch");
  }
  recommendations.push("Schedule periodic review (at least annually or after significant changes)");

  return {
    name: input.name,
    date,
    assessor: input.assessor ?? "BJJ App Inc.",
    dataCategories: input.dataCategories,
    processingActivities: input.processingActivities,
    riskFactors,
    mitigations,
    dataFlows: input.dataFlows ?? [],
    overallRisk,
    dpiaRequired,
    dpiaReason: dpiaReasons.length > 0 ? dpiaReasons.join("; ") : "No DPIA triggers identified",
    recommendations,
  };
}

/**
 * Generate a formatted PIA report string.
 */
export function generatePIAReport(assessment: PIAAssessment): string {
  const lines: string[] = [
    `=== Privacy Impact Assessment ===`,
    `Name: ${assessment.name}`,
    `Date: ${assessment.date}`,
    `Assessor: ${assessment.assessor}`,
    `Overall Risk: ${assessment.overallRisk.toUpperCase()}`,
    `DPIA Required: ${assessment.dpiaRequired ? "YES" : "NO"}`,
    assessment.dpiaRequired ? `  Reason: ${assessment.dpiaReason}` : "",
    "",
    `Data Categories: ${assessment.dataCategories.join(", ")}`,
    `Processing Activities: ${assessment.processingActivities.join(", ")}`,
    "",
    `--- Risk Factors (${assessment.riskFactors.length}) ---`,
  ];

  for (const f of assessment.riskFactors) {
    lines.push(`  [${f.level.toUpperCase()}] ${f.description} (score: ${f.score})`);
  }

  lines.push("", `--- Mitigations (${assessment.mitigations.length}) ---`);
  for (const m of assessment.mitigations) {
    lines.push(`  [${m.status}] ${m.description} → residual: ${m.residualRisk}`);
  }

  if (assessment.recommendations.length > 0) {
    lines.push("", `--- Recommendations ---`);
    for (const r of assessment.recommendations) {
      lines.push(`  - ${r}`);
    }
  }

  return lines.filter((l) => l !== undefined).join("\n");
}

/**
 * Get a quick risk summary for a set of data categories.
 * Useful for inline checks before adding new features.
 */
export function quickRiskCheck(
  dataCategories: DataCategory[],
  processingActivities: ProcessingActivity[]
): { overallRisk: RiskLevel; dpiaRequired: boolean; topRisks: string[] } {
  const factors = identifyRiskFactors(dataCategories, processingActivities);
  const { required: dpiaRequired } = checkDPIARequired(dataCategories, processingActivities);

  const maxScore = factors.length > 0 ? Math.max(...factors.map((f) => f.score)) : 0;
  const overallRisk: RiskLevel =
    maxScore >= 20 ? "critical" : maxScore >= 12 ? "high" : maxScore >= 6 ? "medium" : "low";

  const topRisks = factors
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((f) => f.description);

  return { overallRisk, dpiaRequired, topRisks };
}
