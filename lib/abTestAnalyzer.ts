/**
 * Q-186: A/B Test Analyzer (Conversion 94→95)
 *
 * Statistical significance testing, conversion lift calculation,
 * sample size estimation, and experiment reporting for SaaS-grade conversion optimization.
 */

// ── Types & Constants ──────────────────────────────────────

export interface ABVariant {
  name: string;
  visitors: number;
  conversions: number;
  revenue?: number;
}

export interface ABTestConfig {
  name: string;
  hypothesis: string;
  primaryMetric: string;
  control: ABVariant;
  treatment: ABVariant;
  startDate: string;
  endDate?: string;
  confidenceLevel: number; // e.g. 0.95
}

export interface ABTestResult {
  testName: string;
  controlRate: number;
  treatmentRate: number;
  absoluteLift: number;
  relativeLift: number;
  zScore: number;
  pValue: number;
  isSignificant: boolean;
  confidenceLevel: number;
  confidenceInterval: { lower: number; upper: number };
  recommendation: "deploy" | "iterate" | "stop" | "continue";
  summary: string;
}

export interface SampleSizeEstimate {
  samplePerVariant: number;
  totalSample: number;
  estimatedDays: number;
  parameters: {
    baselineRate: number;
    minimumDetectableEffect: number;
    confidenceLevel: number;
    power: number;
  };
}

export const CONFIDENCE_LEVELS = {
  low: 0.9,
  standard: 0.95,
  high: 0.99,
} as const;

export const MIN_SAMPLE_SIZE = 100;

// ── Statistical Functions ──────────────────────────────────

/**
 * Standard normal CDF approximation (Abramowitz & Stegun)
 */
export function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Inverse normal CDF approximation (rational approximation)
 */
export function normalInvCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Rational approximation for central region
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];

  const q = p < 0.5 ? p : 1 - p;
  const r = Math.sqrt(-2 * Math.log(q));
  let x: number;

  if (r <= 5) {
    const s = r - 1.6;
    x =
      (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) /
      ((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4] * s + 1);
  } else {
    const s = r - 5;
    x =
      (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) /
      ((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4] * s + 1);
  }

  return p < 0.5 ? -x : x;
}

/**
 * Calculate conversion rate
 */
export function conversionRate(variant: ABVariant): number {
  if (variant.visitors === 0) return 0;
  return variant.conversions / variant.visitors;
}

/**
 * Calculate pooled standard error for two proportions
 */
export function pooledStandardError(
  control: ABVariant,
  treatment: ABVariant
): number {
  const p1 = conversionRate(control);
  const p2 = conversionRate(treatment);
  const pooled =
    (control.conversions + treatment.conversions) /
    (control.visitors + treatment.visitors);
  return Math.sqrt(
    pooled * (1 - pooled) * (1 / control.visitors + 1 / treatment.visitors)
  );
}

/**
 * Calculate Z-score for two-proportion z-test
 */
export function calculateZScore(
  control: ABVariant,
  treatment: ABVariant
): number {
  const se = pooledStandardError(control, treatment);
  if (se === 0) return 0;
  const p1 = conversionRate(control);
  const p2 = conversionRate(treatment);
  return (p2 - p1) / se;
}

/**
 * Calculate p-value (two-tailed) from z-score
 */
export function calculatePValue(zScore: number): number {
  return 2 * (1 - normalCDF(Math.abs(zScore)));
}

// ── Analysis ───────────────────────────────────────────────

/**
 * Run full A/B test analysis
 */
export function analyzeABTest(config: ABTestConfig): ABTestResult {
  const controlRate = conversionRate(config.control);
  const treatmentRate = conversionRate(config.treatment);
  const absoluteLift = treatmentRate - controlRate;
  const relativeLift = controlRate > 0 ? absoluteLift / controlRate : 0;

  const zScore = calculateZScore(config.control, config.treatment);
  const pValue = calculatePValue(zScore);
  const isSignificant = pValue < (1 - config.confidenceLevel);

  // Confidence interval for the difference
  const se = pooledStandardError(config.control, config.treatment);
  const zCritical = normalInvCDF(1 - (1 - config.confidenceLevel) / 2);
  const margin = zCritical * se;
  const confidenceInterval = {
    lower: Math.round((absoluteLift - margin) * 10000) / 10000,
    upper: Math.round((absoluteLift + margin) * 10000) / 10000,
  };

  // Recommendation logic
  let recommendation: ABTestResult["recommendation"];
  const totalSample = config.control.visitors + config.treatment.visitors;
  if (totalSample < MIN_SAMPLE_SIZE * 2) {
    recommendation = "continue";
  } else if (isSignificant && absoluteLift > 0) {
    recommendation = "deploy";
  } else if (isSignificant && absoluteLift < 0) {
    recommendation = "stop";
  } else {
    recommendation = "iterate";
  }

  return {
    testName: config.name,
    controlRate: Math.round(controlRate * 10000) / 10000,
    treatmentRate: Math.round(treatmentRate * 10000) / 10000,
    absoluteLift: Math.round(absoluteLift * 10000) / 10000,
    relativeLift: Math.round(relativeLift * 10000) / 10000,
    zScore: Math.round(zScore * 1000) / 1000,
    pValue: Math.round(pValue * 10000) / 10000,
    isSignificant,
    confidenceLevel: config.confidenceLevel,
    confidenceInterval,
    recommendation,
    summary: `${config.name}: ${isSignificant ? "Significant" : "Not significant"} — ${Math.round(relativeLift * 100)}% lift (p=${Math.round(pValue * 1000) / 1000})`,
  };
}

/**
 * Estimate required sample size per variant
 */
export function estimateSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number,
  confidenceLevel: number = 0.95,
  power: number = 0.8,
  dailyVisitors?: number
): SampleSizeEstimate {
  const zAlpha = normalInvCDF(1 - (1 - confidenceLevel) / 2);
  const zBeta = normalInvCDF(power);
  const p1 = baselineRate;
  const p2 = baselineRate + minimumDetectableEffect;
  const pooledP = (p1 + p2) / 2;

  const numerator = Math.pow(
    zAlpha * Math.sqrt(2 * pooledP * (1 - pooledP)) +
      zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
    2
  );
  const denominator = Math.pow(p2 - p1, 2);
  const samplePerVariant = Math.ceil(numerator / denominator);
  const totalSample = samplePerVariant * 2;
  const estimatedDays = dailyVisitors
    ? Math.ceil(totalSample / dailyVisitors)
    : 0;

  return {
    samplePerVariant,
    totalSample,
    estimatedDays,
    parameters: {
      baselineRate,
      minimumDetectableEffect,
      confidenceLevel,
      power,
    },
  };
}

/**
 * Calculate revenue per visitor lift
 */
export function calculateRevenueLift(
  control: ABVariant,
  treatment: ABVariant
): { controlRPV: number; treatmentRPV: number; liftRPV: number; liftPercent: number } {
  const controlRPV = control.visitors > 0 ? (control.revenue ?? 0) / control.visitors : 0;
  const treatmentRPV = treatment.visitors > 0 ? (treatment.revenue ?? 0) / treatment.visitors : 0;
  const liftRPV = treatmentRPV - controlRPV;
  const liftPercent = controlRPV > 0 ? liftRPV / controlRPV : 0;
  return {
    controlRPV: Math.round(controlRPV * 100) / 100,
    treatmentRPV: Math.round(treatmentRPV * 100) / 100,
    liftRPV: Math.round(liftRPV * 100) / 100,
    liftPercent: Math.round(liftPercent * 10000) / 10000,
  };
}

/**
 * Format A/B test result as readable string
 */
export function formatABTestResult(result: ABTestResult): string {
  const lines = [
    `# A/B Test: ${result.testName}`,
    `Control: ${(result.controlRate * 100).toFixed(2)}% | Treatment: ${(result.treatmentRate * 100).toFixed(2)}%`,
    `Lift: ${result.absoluteLift > 0 ? "+" : ""}${(result.absoluteLift * 100).toFixed(2)}% (${result.relativeLift > 0 ? "+" : ""}${(result.relativeLift * 100).toFixed(1)}% relative)`,
    `Z-score: ${result.zScore} | p-value: ${result.pValue}`,
    `${result.confidenceLevel * 100}% CI: [${(result.confidenceInterval.lower * 100).toFixed(2)}%, ${(result.confidenceInterval.upper * 100).toFixed(2)}%]`,
    `Significant: ${result.isSignificant ? "Yes ✅" : "No"}`,
    `Recommendation: ${result.recommendation.toUpperCase()}`,
  ];
  return lines.join("\n");
}
