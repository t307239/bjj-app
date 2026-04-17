/**
 * lib/funnelAnalytics.ts — Conversion funnel analysis utilities
 *
 * Q-149: Conversion pillar — provides funnel step tracking,
 * drop-off analysis, and conversion rate calculations for
 * user acquisition and feature adoption flows.
 *
 * Pure utility layer — no DB access, no UI. Consumers pass data in,
 * get computed results back.
 *
 * @example
 *   import { analyzeFunnel, buildFunnelReport, FUNNELS } from "@/lib/funnelAnalytics";
 *   const analysis = analyzeFunnel(stepCounts);
 *   const report = buildFunnelReport("signup", stepCounts);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface FunnelStep {
  /** Step identifier */
  id: string;
  /** Display name */
  name: string;
  /** Order in funnel (0-based) */
  order: number;
}

export interface FunnelDefinition {
  /** Funnel identifier */
  id: string;
  /** Display name */
  name: string;
  /** Ordered steps */
  steps: FunnelStep[];
  /** Target conversion rate (0-1) */
  targetRate: number;
}

export interface StepMetrics {
  /** Step ID */
  stepId: string;
  /** Step name */
  stepName: string;
  /** Users who reached this step */
  count: number;
  /** Conversion rate from previous step (0-1), null for first step */
  conversionRate: number | null;
  /** Drop-off rate from previous step (0-1), null for first step */
  dropOffRate: number | null;
  /** Drop-off count from previous step */
  dropOffCount: number;
  /** Overall conversion from first step (0-1) */
  overallRate: number;
}

export interface FunnelAnalysis {
  /** Funnel ID */
  funnelId: string;
  /** Funnel name */
  funnelName: string;
  /** Per-step metrics */
  steps: StepMetrics[];
  /** Overall conversion rate (first to last step) */
  overallConversion: number;
  /** Biggest drop-off step */
  biggestDropOff: { stepId: string; stepName: string; dropOffRate: number } | null;
  /** Whether target rate is met */
  targetMet: boolean;
  /** Target rate */
  targetRate: number;
  /** Total users who entered funnel */
  totalEntrants: number;
  /** Total users who completed funnel */
  totalCompletions: number;
}

export interface FunnelComparison {
  /** Period A label */
  periodA: string;
  /** Period B label */
  periodB: string;
  /** Overall conversion change (positive = improved) */
  conversionDelta: number;
  /** Per-step conversion changes */
  stepDeltas: Array<{ stepId: string; stepName: string; delta: number }>;
  /** Assessment */
  assessment: "improved" | "stable" | "declined";
}

// ── Constants ────────────────────────────────────────────────────────────

/** Predefined funnel definitions */
export const FUNNELS: Record<string, FunnelDefinition> = {
  signup: {
    id: "signup",
    name: "User Signup",
    steps: [
      { id: "landing_visit", name: "Landing Page Visit", order: 0 },
      { id: "cta_click", name: "CTA Click", order: 1 },
      { id: "auth_start", name: "Auth Started", order: 2 },
      { id: "auth_complete", name: "Auth Completed", order: 3 },
      { id: "onboarding_complete", name: "Onboarding Complete", order: 4 },
    ],
    targetRate: 0.05,
  },
  pro_upgrade: {
    id: "pro_upgrade",
    name: "Pro Upgrade",
    steps: [
      { id: "pro_gate_view", name: "Pro Gate Viewed", order: 0 },
      { id: "pricing_view", name: "Pricing Viewed", order: 1 },
      { id: "checkout_start", name: "Checkout Started", order: 2 },
      { id: "payment_complete", name: "Payment Complete", order: 3 },
    ],
    targetRate: 0.03,
  },
  feature_adoption: {
    id: "feature_adoption",
    name: "Feature Adoption",
    steps: [
      { id: "first_login", name: "First Login", order: 0 },
      { id: "first_record", name: "First Record Logged", order: 1 },
      { id: "first_week_active", name: "Active in First Week", order: 2 },
      { id: "first_month_active", name: "Active in First Month", order: 3 },
      { id: "retained_3m", name: "Retained at 3 Months", order: 4 },
    ],
    targetRate: 0.20,
  },
  technique_exploration: {
    id: "technique_exploration",
    name: "Technique Exploration",
    steps: [
      { id: "skill_map_view", name: "Skill Map Viewed", order: 0 },
      { id: "technique_click", name: "Technique Clicked", order: 1 },
      { id: "technique_logged", name: "Technique Logged", order: 2 },
      { id: "return_visit", name: "Return Visit to Skill Map", order: 3 },
    ],
    targetRate: 0.15,
  },
} as const;

/** Conversion rate thresholds for classification */
export const CONVERSION_THRESHOLDS = {
  /** Excellent step conversion */
  excellent: 0.80,
  /** Good step conversion */
  good: 0.50,
  /** Poor step conversion — needs attention */
  poor: 0.20,
  /** Critical — major drop-off */
  critical: 0.10,
} as const;

// ── Analysis ─────────────────────────────────────────────────────────────

/**
 * Analyze a funnel given step counts.
 * @param funnel - Funnel definition
 * @param counts - Map of stepId → user count
 */
export function analyzeFunnel(
  funnel: FunnelDefinition,
  counts: Record<string, number>,
): FunnelAnalysis {
  const sortedSteps = [...funnel.steps].sort((a, b) => a.order - b.order);
  const firstCount = counts[sortedSteps[0]?.id ?? ""] ?? 0;

  const steps: StepMetrics[] = sortedSteps.map((step, i) => {
    const count = counts[step.id] ?? 0;
    const prevCount = i > 0 ? (counts[sortedSteps[i - 1].id] ?? 0) : null;

    const conversionRate = prevCount !== null && prevCount > 0
      ? count / prevCount
      : null;
    const dropOffRate = conversionRate !== null
      ? 1 - conversionRate
      : null;
    const dropOffCount = prevCount !== null
      ? Math.max(0, prevCount - count)
      : 0;
    const overallRate = firstCount > 0 ? count / firstCount : 0;

    return {
      stepId: step.id,
      stepName: step.name,
      count,
      conversionRate,
      dropOffRate,
      dropOffCount,
      overallRate,
    };
  });

  const lastStep = steps[steps.length - 1];
  const overallConversion = firstCount > 0 && lastStep
    ? lastStep.count / firstCount
    : 0;

  // Find biggest drop-off
  let biggestDropOff: FunnelAnalysis["biggestDropOff"] = null;
  let maxDropOff = 0;
  for (const step of steps) {
    if (step.dropOffRate !== null && step.dropOffRate > maxDropOff) {
      maxDropOff = step.dropOffRate;
      biggestDropOff = {
        stepId: step.stepId,
        stepName: step.stepName,
        dropOffRate: step.dropOffRate,
      };
    }
  }

  return {
    funnelId: funnel.id,
    funnelName: funnel.name,
    steps,
    overallConversion,
    biggestDropOff,
    targetMet: overallConversion >= funnel.targetRate,
    targetRate: funnel.targetRate,
    totalEntrants: firstCount,
    totalCompletions: lastStep?.count ?? 0,
  };
}

/**
 * Classify a conversion rate.
 */
export function classifyConversion(
  rate: number,
): "excellent" | "good" | "fair" | "poor" | "critical" {
  if (rate >= CONVERSION_THRESHOLDS.excellent) return "excellent";
  if (rate >= CONVERSION_THRESHOLDS.good) return "good";
  if (rate >= CONVERSION_THRESHOLDS.poor) return "fair";
  if (rate >= CONVERSION_THRESHOLDS.critical) return "poor";
  return "critical";
}

/**
 * Compare two funnel analyses (e.g. week-over-week).
 */
export function compareFunnels(
  periodALabel: string,
  periodAAnalysis: FunnelAnalysis,
  periodBLabel: string,
  periodBAnalysis: FunnelAnalysis,
): FunnelComparison {
  const conversionDelta = periodBAnalysis.overallConversion - periodAAnalysis.overallConversion;

  const stepDeltas = periodBAnalysis.steps
    .filter((s) => s.conversionRate !== null)
    .map((stepB) => {
      const stepA = periodAAnalysis.steps.find((s) => s.stepId === stepB.stepId);
      const aRate = stepA?.conversionRate ?? 0;
      const bRate = stepB.conversionRate ?? 0;
      return {
        stepId: stepB.stepId,
        stepName: stepB.stepName,
        delta: bRate - aRate,
      };
    });

  let assessment: FunnelComparison["assessment"];
  if (conversionDelta > 0.005) {
    assessment = "improved";
  } else if (conversionDelta < -0.005) {
    assessment = "declined";
  } else {
    assessment = "stable";
  }

  return {
    periodA: periodALabel,
    periodB: periodBLabel,
    conversionDelta,
    stepDeltas,
    assessment,
  };
}

// ── Recommendations ──────────────────────────────────────────────────────

/**
 * Generate optimization recommendations based on funnel analysis.
 */
export function getRecommendations(analysis: FunnelAnalysis): string[] {
  const recs: string[] = [];

  if (!analysis.targetMet) {
    recs.push(
      `Overall conversion (${(analysis.overallConversion * 100).toFixed(1)}%) is below target (${(analysis.targetRate * 100).toFixed(1)}%)`,
    );
  }

  if (analysis.biggestDropOff && analysis.biggestDropOff.dropOffRate > 0.5) {
    recs.push(
      `Biggest drop-off at "${analysis.biggestDropOff.stepName}" (${(analysis.biggestDropOff.dropOffRate * 100).toFixed(1)}% drop) — prioritize improvement here`,
    );
  }

  for (const step of analysis.steps) {
    if (step.conversionRate !== null && step.conversionRate < CONVERSION_THRESHOLDS.critical) {
      recs.push(
        `Critical: "${step.stepName}" converts only ${(step.conversionRate * 100).toFixed(1)}% — investigate UX friction`,
      );
    }
  }

  if (analysis.totalEntrants === 0) {
    recs.push("No funnel entrants — check traffic source and landing page");
  }

  if (recs.length === 0) {
    recs.push("Funnel is performing well — continue monitoring");
  }

  return recs;
}

// ── Report ───────────────────────────────────────────────────────────────

/**
 * Build a complete funnel report.
 */
export function buildFunnelReport(
  funnelId: string,
  counts: Record<string, number>,
): FunnelAnalysis & { recommendations: string[] } {
  const funnel = FUNNELS[funnelId];
  if (!funnel) {
    throw new Error(`Unknown funnel: ${funnelId}`);
  }
  const analysis = analyzeFunnel(funnel, counts);
  const recommendations = getRecommendations(analysis);
  return { ...analysis, recommendations };
}

/**
 * Format a funnel analysis as a human-readable string.
 */
export function formatFunnelReport(analysis: FunnelAnalysis): string {
  const icon = analysis.targetMet ? "✅" : "⚠️";
  const lines = [
    `${icon} ${analysis.funnelName}: ${(analysis.overallConversion * 100).toFixed(1)}% conversion (target: ${(analysis.targetRate * 100).toFixed(1)}%)`,
    `   Entrants: ${analysis.totalEntrants} → Completions: ${analysis.totalCompletions}`,
    "",
    ...analysis.steps.map((s) => {
      const rate = s.conversionRate !== null
        ? `${(s.conversionRate * 100).toFixed(1)}%`
        : "—";
      const drop = s.dropOffCount > 0 ? ` (-${s.dropOffCount})` : "";
      return `  ${s.count > 0 ? "●" : "○"} ${s.stepName}: ${s.count} users (${rate} conv${drop})`;
    }),
  ];

  if (analysis.biggestDropOff) {
    lines.push("", `  ⚠️ Biggest drop-off: ${analysis.biggestDropOff.stepName} (${(analysis.biggestDropOff.dropOffRate * 100).toFixed(1)}%)`);
  }

  return lines.join("\n");
}
