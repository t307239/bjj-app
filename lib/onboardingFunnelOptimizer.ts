/**
 * onboardingFunnelOptimizer.ts — Onboarding funnel analysis and optimization
 *
 * Pure-function utility for analyzing user onboarding funnels, identifying
 * drop-off points, suggesting improvements, calculating time-to-value,
 * and benchmarking against industry standards.
 *
 * @module Q-202
 * @since Q-202
 */

/* ---------- Types ---------- */

export type OnboardingStep =
  | "signup"
  | "profile_setup"
  | "first_training"
  | "feature_discovery"
  | "pro_trial";

export interface StepMetrics {
  readonly step: OnboardingStep;
  readonly entered: number;
  readonly completed: number;
  readonly avgTimeToCompleteSec: number;
  readonly dropOffCount: number;
}

export interface DropOffReason {
  readonly category: "complexity" | "confusion" | "lack_of_value" | "technical_error" | "time_constraint" | "trust_concern";
  readonly likelihood: number;
  readonly description: string;
}

export interface Improvement {
  readonly step: OnboardingStep;
  readonly recommendation: string;
  readonly expectedLift: number;
  readonly effort: "low" | "medium" | "high";
  readonly priority: "critical" | "high" | "medium" | "low";
}

export interface BenchmarkComparison {
  readonly step: OnboardingStep;
  readonly actual: number;
  readonly benchmark: number;
  readonly difference: number;
  readonly status: "above" | "at" | "below";
}

export interface OnboardingReport {
  readonly score: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly totalEntered: number;
  readonly totalCompleted: number;
  readonly overallConversionRate: number;
  readonly biggestDropOff: { readonly step: OnboardingStep; readonly rate: number } | null;
  readonly timeToValue: { readonly totalSec: number; readonly formatted: string };
  readonly stepAnalysis: readonly {
    readonly step: OnboardingStep;
    readonly conversionRate: number;
    readonly dropOffRate: number;
    readonly avgTimeSec: number;
  }[];
  readonly improvements: readonly Improvement[];
  readonly benchmarkComparisons: readonly BenchmarkComparison[];
  readonly recommendations: readonly string[];
}

/* ---------- Constants ---------- */

/** Onboarding steps with display order and target completion rates */
export const ONBOARDING_STEPS: Record<
  OnboardingStep,
  { readonly order: number; readonly label: string; readonly targetRate: number }
> = {
  signup: { order: 1, label: "Sign Up", targetRate: 0.95 },
  profile_setup: { order: 2, label: "Profile Setup", targetRate: 0.80 },
  first_training: { order: 3, label: "First Training Log", targetRate: 0.60 },
  feature_discovery: { order: 4, label: "Feature Discovery", targetRate: 0.45 },
  pro_trial: { order: 5, label: "Pro Trial", targetRate: 0.25 },
} as const;

/** Drop-off thresholds for severity classification */
export const DROP_OFF_THRESHOLDS = {
  critical: 0.50,
  high: 0.35,
  medium: 0.20,
  low: 0.10,
} as const;

/** Industry benchmark completion rates for SaaS onboarding */
export const BENCHMARK_RATES: Record<OnboardingStep, number> = {
  signup: 0.90,
  profile_setup: 0.70,
  first_training: 0.50,
  feature_discovery: 0.35,
  pro_trial: 0.15,
} as const;

/** Typical reasons for drop-off per step */
const STEP_DROP_OFF_PATTERNS: Record<OnboardingStep, readonly { readonly category: DropOffReason["category"]; readonly weight: number; readonly description: string }[]> = {
  signup: [
    { category: "complexity", weight: 0.3, description: "Too many fields in signup form" },
    { category: "trust_concern", weight: 0.35, description: "Users hesitant to provide email/personal data" },
    { category: "technical_error", weight: 0.2, description: "OAuth or email verification failures" },
    { category: "time_constraint", weight: 0.15, description: "Signup process takes too long" },
  ],
  profile_setup: [
    { category: "complexity", weight: 0.35, description: "Too many profile fields to fill" },
    { category: "lack_of_value", weight: 0.25, description: "Unclear why profile info is needed" },
    { category: "time_constraint", weight: 0.25, description: "Users want to skip to core features" },
    { category: "confusion", weight: 0.15, description: "Belt/experience level selection confusing" },
  ],
  first_training: [
    { category: "lack_of_value", weight: 0.3, description: "Not clear how to log first training" },
    { category: "confusion", weight: 0.3, description: "Complex form with too many options" },
    { category: "time_constraint", weight: 0.2, description: "Users haven't trained yet" },
    { category: "technical_error", weight: 0.2, description: "Form submission errors" },
  ],
  feature_discovery: [
    { category: "lack_of_value", weight: 0.35, description: "Users don't see value in additional features" },
    { category: "confusion", weight: 0.3, description: "Feature navigation unclear" },
    { category: "time_constraint", weight: 0.25, description: "Information overload — too many features at once" },
    { category: "complexity", weight: 0.1, description: "Advanced features too complex for beginners" },
  ],
  pro_trial: [
    { category: "trust_concern", weight: 0.35, description: "Concern about billing after trial" },
    { category: "lack_of_value", weight: 0.3, description: "Free tier sufficient for current needs" },
    { category: "time_constraint", weight: 0.2, description: "Not ready to evaluate Pro features" },
    { category: "complexity", weight: 0.15, description: "Unclear what Pro offers over Free" },
  ],
};

/* ---------- Functions ---------- */

/**
 * Analyze onboarding funnel metrics for conversion rates and biggest drop-off.
 */
export function analyzeOnboardingFunnel(
  stepMetrics: readonly StepMetrics[]
): readonly {
  readonly step: OnboardingStep;
  readonly conversionRate: number;
  readonly dropOffRate: number;
  readonly avgTimeSec: number;
}[] {
  return stepMetrics.map((m) => {
    const conversionRate = m.entered > 0
      ? Math.round((m.completed / m.entered) * 10000) / 10000
      : 0;
    const dropOffRate = m.entered > 0
      ? Math.round((m.dropOffCount / m.entered) * 10000) / 10000
      : 0;
    return {
      step: m.step,
      conversionRate,
      dropOffRate,
      avgTimeSec: m.avgTimeToCompleteSec,
    };
  });
}

/**
 * Identify likely drop-off reasons for a specific step based on metrics.
 */
export function identifyDropOffReasons(
  step: OnboardingStep,
  metrics: StepMetrics
): readonly DropOffReason[] {
  const patterns = STEP_DROP_OFF_PATTERNS[step] ?? [];
  const dropOffRate = metrics.entered > 0 ? metrics.dropOffCount / metrics.entered : 0;

  return patterns.map((pattern) => ({
    category: pattern.category,
    likelihood: Math.round(pattern.weight * dropOffRate * 10000) / 10000,
    description: pattern.description,
  })).sort((a, b) => b.likelihood - a.likelihood);
}

/**
 * Suggest onboarding improvements based on funnel analysis.
 */
export function suggestOnboardingImprovements(
  stepMetrics: readonly StepMetrics[]
): readonly Improvement[] {
  const improvements: Improvement[] = [];
  const analysis = analyzeOnboardingFunnel(stepMetrics);

  for (const step of analysis) {
    const target = ONBOARDING_STEPS[step.step].targetRate;
    const gap = target - step.conversionRate;

    if (gap <= 0) continue; // On target

    const severity = step.dropOffRate >= DROP_OFF_THRESHOLDS.critical
      ? "critical"
      : step.dropOffRate >= DROP_OFF_THRESHOLDS.high
        ? "high"
        : step.dropOffRate >= DROP_OFF_THRESHOLDS.medium
          ? "medium"
          : "low";

    switch (step.step) {
      case "signup":
        if (step.avgTimeSec > 60) {
          improvements.push({
            step: step.step,
            recommendation: "Reduce signup to email + password only — defer profile to next step",
            expectedLift: Math.round(gap * 0.4 * 10000) / 10000,
            effort: "low",
            priority: severity,
          });
        }
        improvements.push({
          step: step.step,
          recommendation: "Add social login (Google/Apple) to reduce friction",
          expectedLift: Math.round(gap * 0.3 * 10000) / 10000,
          effort: "medium",
          priority: severity,
        });
        break;

      case "profile_setup":
        improvements.push({
          step: step.step,
          recommendation: "Make profile setup optional — allow skip with reminder later",
          expectedLift: Math.round(gap * 0.5 * 10000) / 10000,
          effort: "low",
          priority: severity,
        });
        if (step.avgTimeSec > 120) {
          improvements.push({
            step: step.step,
            recommendation: "Reduce required fields — only ask belt and academy",
            expectedLift: Math.round(gap * 0.3 * 10000) / 10000,
            effort: "low",
            priority: severity,
          });
        }
        break;

      case "first_training":
        improvements.push({
          step: step.step,
          recommendation: "Add a guided first-log wizard with pre-filled defaults",
          expectedLift: Math.round(gap * 0.4 * 10000) / 10000,
          effort: "medium",
          priority: severity,
        });
        improvements.push({
          step: step.step,
          recommendation: "Send push reminder after first session to log training",
          expectedLift: Math.round(gap * 0.25 * 10000) / 10000,
          effort: "low",
          priority: severity,
        });
        break;

      case "feature_discovery":
        improvements.push({
          step: step.step,
          recommendation: "Add progressive disclosure — reveal features one by one",
          expectedLift: Math.round(gap * 0.35 * 10000) / 10000,
          effort: "medium",
          priority: severity,
        });
        improvements.push({
          step: step.step,
          recommendation: "Add tooltip tour highlighting 3 key features",
          expectedLift: Math.round(gap * 0.3 * 10000) / 10000,
          effort: "low",
          priority: severity,
        });
        break;

      case "pro_trial":
        improvements.push({
          step: step.step,
          recommendation: "Show Pro value comparison after user logs 3+ trainings",
          expectedLift: Math.round(gap * 0.4 * 10000) / 10000,
          effort: "low",
          priority: severity,
        });
        improvements.push({
          step: step.step,
          recommendation: "Add no-credit-card trial option to reduce trust barrier",
          expectedLift: Math.round(gap * 0.35 * 10000) / 10000,
          effort: "medium",
          priority: severity,
        });
        break;
    }
  }

  return improvements.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Calculate time-to-value — time from signup to first meaningful action.
 */
export function calculateTimeToValue(
  steps: readonly StepMetrics[]
): { readonly totalSec: number; readonly formatted: string } {
  // Time to value = time to complete first_training (the first meaningful action)
  let totalSec = 0;
  const orderedSteps = [...steps].sort(
    (a, b) => ONBOARDING_STEPS[a.step].order - ONBOARDING_STEPS[b.step].order
  );

  for (const step of orderedSteps) {
    totalSec += step.avgTimeToCompleteSec;
    if (step.step === "first_training") break;
  }

  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.round(totalSec % 60);
  const formatted = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return { totalSec, formatted };
}

/**
 * Compare actual metrics against industry benchmarks.
 */
export function compareWithBenchmarks(
  metrics: readonly StepMetrics[],
  benchmarks: Record<string, number> = BENCHMARK_RATES
): readonly BenchmarkComparison[] {
  return metrics.map((m) => {
    const actual = m.entered > 0 ? Math.round((m.completed / m.entered) * 10000) / 10000 : 0;
    const benchmark = benchmarks[m.step] ?? 0;
    const difference = Math.round((actual - benchmark) * 10000) / 10000;
    const status = difference > 0.05 ? "above" : difference < -0.05 ? "below" : "at";
    return { step: m.step, actual, benchmark, difference, status };
  });
}

/**
 * Build a comprehensive onboarding funnel report with score and recommendations.
 */
export function buildOnboardingReport(
  metrics: readonly StepMetrics[]
): OnboardingReport {
  const analysis = analyzeOnboardingFunnel(metrics);
  const improvements = suggestOnboardingImprovements(metrics);
  const timeToValue = calculateTimeToValue(metrics);
  const benchmarkComparisons = compareWithBenchmarks(metrics);
  const recommendations: string[] = [];

  const totalEntered = metrics.length > 0 ? metrics[0].entered : 0;
  const lastStep = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const totalCompleted = lastStep ? lastStep.completed : 0;
  const overallConversionRate = totalEntered > 0
    ? Math.round((totalCompleted / totalEntered) * 10000) / 10000
    : 0;

  // Find biggest drop-off
  let biggestDropOff: { step: OnboardingStep; rate: number } | null = null;
  for (const step of analysis) {
    if (!biggestDropOff || step.dropOffRate > biggestDropOff.rate) {
      biggestDropOff = { step: step.step, rate: step.dropOffRate };
    }
  }

  // Score calculation
  let score = 100;

  // Deduct for below-benchmark steps
  for (const bc of benchmarkComparisons) {
    if (bc.status === "below") {
      score -= Math.round(Math.abs(bc.difference) * 50);
    }
  }

  // Deduct for high drop-off
  for (const step of analysis) {
    if (step.dropOffRate > DROP_OFF_THRESHOLDS.critical) {
      score -= 15;
    } else if (step.dropOffRate > DROP_OFF_THRESHOLDS.high) {
      score -= 8;
    }
  }

  // Deduct for slow time-to-value
  if (timeToValue.totalSec > 600) {
    score -= 10;
    recommendations.push("Time-to-value exceeds 10 minutes — streamline early steps");
  } else if (timeToValue.totalSec > 300) {
    score -= 5;
    recommendations.push("Time-to-value is 5-10 minutes — consider reducing friction");
  }

  if (biggestDropOff && biggestDropOff.rate > DROP_OFF_THRESHOLDS.high) {
    recommendations.push(
      `Biggest drop-off at "${ONBOARDING_STEPS[biggestDropOff.step].label}" (${Math.round(biggestDropOff.rate * 100)}%) — prioritize this step`
    );
  }

  if (overallConversionRate < 0.15) {
    recommendations.push("Overall funnel conversion below 15% — consider a complete onboarding redesign");
  }

  const belowBenchmark = benchmarkComparisons.filter((bc) => bc.status === "below");
  if (belowBenchmark.length > 0) {
    recommendations.push(
      `${belowBenchmark.length} step(s) below industry benchmark: ${belowBenchmark.map((bc) => ONBOARDING_STEPS[bc.step].label).join(", ")}`
    );
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    grade: finalScore >= 90 ? "A" : finalScore >= 80 ? "B" : finalScore >= 70 ? "C" : finalScore >= 60 ? "D" : "F",
    totalEntered,
    totalCompleted,
    overallConversionRate,
    biggestDropOff,
    timeToValue,
    stepAnalysis: analysis,
    improvements,
    benchmarkComparisons,
    recommendations,
  };
}

/**
 * Format an onboarding report as a human-readable string.
 */
export function formatOnboardingReport(report: OnboardingReport): string {
  const lines: string[] = [
    "=== Onboarding Funnel Report ===",
    `Score: ${report.score}/100 (${report.grade})`,
    `Overall Conversion: ${Math.round(report.overallConversionRate * 100)}% (${report.totalCompleted}/${report.totalEntered})`,
    `Time to Value: ${report.timeToValue.formatted}`,
  ];

  if (report.biggestDropOff) {
    lines.push(
      `Biggest Drop-off: ${ONBOARDING_STEPS[report.biggestDropOff.step].label} (${Math.round(report.biggestDropOff.rate * 100)}%)`
    );
  }

  lines.push("", "Step Analysis:");
  for (const step of report.stepAnalysis) {
    const label = ONBOARDING_STEPS[step.step].label;
    lines.push(
      `  ${label}: ${Math.round(step.conversionRate * 100)}% conversion, ${Math.round(step.dropOffRate * 100)}% drop-off, ${Math.round(step.avgTimeSec)}s avg`
    );
  }

  if (report.benchmarkComparisons.length > 0) {
    lines.push("", "Benchmark Comparison:");
    for (const bc of report.benchmarkComparisons) {
      const label = ONBOARDING_STEPS[bc.step].label;
      const arrow = bc.status === "above" ? "+" : bc.status === "below" ? "" : "=";
      lines.push(
        `  ${label}: ${Math.round(bc.actual * 100)}% vs ${Math.round(bc.benchmark * 100)}% (${arrow}${Math.round(bc.difference * 100)}%)`
      );
    }
  }

  if (report.improvements.length > 0) {
    lines.push("", `Improvements (${report.improvements.length}):`);
    for (const imp of report.improvements) {
      const label = ONBOARDING_STEPS[imp.step].label;
      lines.push(
        `  [${imp.priority.toUpperCase()}] ${label}: ${imp.recommendation} (expected +${Math.round(imp.expectedLift * 100)}%, effort: ${imp.effort})`
      );
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
