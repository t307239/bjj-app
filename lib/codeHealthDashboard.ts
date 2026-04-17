/**
 * lib/codeHealthDashboard.ts — Aggregate code health scoring
 *
 * Q-147: DX pillar — provides a unified code health score by
 * aggregating results from all quality check tools (tsc, linter,
 * tests, bundle size, barrel exports, unused exports, type strictness).
 *
 * @example
 *   import { calculateHealthScore, classifyHealth, HEALTH_WEIGHTS } from "@/lib/codeHealthDashboard";
 *   const score = calculateHealthScore(metrics);
 *   const health = classifyHealth(score);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface CodeHealthMetrics {
  /** TypeScript compiler — number of errors */
  tscErrors: number;
  /** Custom linter — number of CRITICAL issues */
  linterCritical: number;
  /** Custom linter — number of WARNING issues */
  linterWarning: number;
  /** Test results — total tests */
  testsTotal: number;
  /** Test results — passed tests */
  testsPassed: number;
  /** Test results — test files */
  testFiles: number;
  /** Bundle size — pages exceeding budget */
  bundleOverBudget: number;
  /** Unused exports count */
  unusedExports: number;
  /** Type strictness violations (as_any, ts_ignore, etc.) */
  typeEscapes: number;
  /** Barrel export coverage — missing exports */
  barrelMissing: number;
  /** ESLint errors */
  eslintErrors: number;
}

export type HealthGrade = "A+" | "A" | "B" | "C" | "D" | "F";

export interface HealthCategory {
  /** Category name */
  name: string;
  /** Score (0-100) */
  score: number;
  /** Weight in overall calculation */
  weight: number;
  /** Issues found */
  issues: number;
  /** Status icon */
  status: "✅" | "⚠️" | "🔴";
}

export interface CodeHealthReport {
  /** Overall score (0-100) */
  overallScore: number;
  /** Letter grade */
  grade: HealthGrade;
  /** Individual category scores */
  categories: HealthCategory[];
  /** Top issues to fix (prioritized) */
  topIssues: string[];
  /** Report timestamp */
  timestamp: string;
  /** Human-readable summary */
  summary: string;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Weight for each health category (must sum to 1.0) */
export const HEALTH_WEIGHTS = {
  typeCheck: 0.20,
  linter: 0.15,
  tests: 0.25,
  bundleSize: 0.10,
  codeQuality: 0.15,
  exports: 0.05,
  eslint: 0.10,
} as const;

/** Grade thresholds */
export const GRADE_THRESHOLDS: Array<{ min: number; grade: HealthGrade }> = [
  { min: 97, grade: "A+" },
  { min: 90, grade: "A" },
  { min: 80, grade: "B" },
  { min: 70, grade: "C" },
  { min: 60, grade: "D" },
  { min: 0, grade: "F" },
];

/** Penalty amounts per issue type */
export const PENALTIES = {
  tscError: 25,
  linterCritical: 20,
  linterWarning: 5,
  testFailure: 10,
  bundleOverBudget: 15,
  unusedExport: 2,
  typeEscape: 3,
  barrelMissing: 5,
  eslintError: 8,
} as const;

// ── Score Calculation ───────────────────────────────────────────────────

/**
 * Calculate individual category scores from metrics.
 */
export function calculateCategoryScores(metrics: CodeHealthMetrics): HealthCategory[] {
  const testPassRate = metrics.testsTotal > 0
    ? (metrics.testsPassed / metrics.testsTotal) * 100
    : 0;

  const categories: HealthCategory[] = [
    {
      name: "Type Safety",
      score: Math.max(0, 100 - metrics.tscErrors * PENALTIES.tscError),
      weight: HEALTH_WEIGHTS.typeCheck,
      issues: metrics.tscErrors,
      status: metrics.tscErrors === 0 ? "✅" : "🔴",
    },
    {
      name: "Code Quality (Linter)",
      score: Math.max(0, 100 - metrics.linterCritical * PENALTIES.linterCritical - metrics.linterWarning * PENALTIES.linterWarning),
      weight: HEALTH_WEIGHTS.linter,
      issues: metrics.linterCritical + metrics.linterWarning,
      status: metrics.linterCritical === 0 ? (metrics.linterWarning === 0 ? "✅" : "⚠️") : "🔴",
    },
    {
      name: "Test Coverage",
      score: Math.round(testPassRate),
      weight: HEALTH_WEIGHTS.tests,
      issues: metrics.testsTotal - metrics.testsPassed,
      status: testPassRate === 100 ? "✅" : testPassRate >= 95 ? "⚠️" : "🔴",
    },
    {
      name: "Bundle Size",
      score: Math.max(0, 100 - metrics.bundleOverBudget * PENALTIES.bundleOverBudget),
      weight: HEALTH_WEIGHTS.bundleSize,
      issues: metrics.bundleOverBudget,
      status: metrics.bundleOverBudget === 0 ? "✅" : "⚠️",
    },
    {
      name: "Type Strictness",
      score: Math.max(0, 100 - metrics.typeEscapes * PENALTIES.typeEscape),
      weight: HEALTH_WEIGHTS.codeQuality,
      issues: metrics.typeEscapes,
      status: metrics.typeEscapes === 0 ? "✅" : metrics.typeEscapes <= 5 ? "⚠️" : "🔴",
    },
    {
      name: "Export Hygiene",
      score: Math.max(0, 100 - metrics.unusedExports * PENALTIES.unusedExport - metrics.barrelMissing * PENALTIES.barrelMissing),
      weight: HEALTH_WEIGHTS.exports,
      issues: metrics.unusedExports + metrics.barrelMissing,
      status: metrics.unusedExports + metrics.barrelMissing === 0 ? "✅" : "⚠️",
    },
    {
      name: "ESLint",
      score: Math.max(0, 100 - metrics.eslintErrors * PENALTIES.eslintError),
      weight: HEALTH_WEIGHTS.eslint,
      issues: metrics.eslintErrors,
      status: metrics.eslintErrors === 0 ? "✅" : "🔴",
    },
  ];

  return categories;
}

/**
 * Calculate the overall weighted health score.
 */
export function calculateHealthScore(metrics: CodeHealthMetrics): number {
  const categories = calculateCategoryScores(metrics);
  const weighted = categories.reduce((sum, c) => sum + c.score * c.weight, 0);
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

/**
 * Classify health score into a letter grade.
 */
export function classifyHealth(score: number): HealthGrade {
  for (const { min, grade } of GRADE_THRESHOLDS) {
    if (score >= min) return grade;
  }
  return "F";
}

/**
 * Identify the top issues to fix, prioritized by impact.
 */
export function identifyTopIssues(metrics: CodeHealthMetrics, limit: number = 5): string[] {
  const issues: Array<{ message: string; impact: number }> = [];

  if (metrics.tscErrors > 0) {
    issues.push({ message: `${metrics.tscErrors} TypeScript error(s) — fix immediately`, impact: metrics.tscErrors * PENALTIES.tscError });
  }
  if (metrics.linterCritical > 0) {
    issues.push({ message: `${metrics.linterCritical} CRITICAL linter issue(s)`, impact: metrics.linterCritical * PENALTIES.linterCritical });
  }
  if (metrics.testsTotal > metrics.testsPassed) {
    const failing = metrics.testsTotal - metrics.testsPassed;
    issues.push({ message: `${failing} failing test(s)`, impact: failing * PENALTIES.testFailure });
  }
  if (metrics.eslintErrors > 0) {
    issues.push({ message: `${metrics.eslintErrors} ESLint error(s)`, impact: metrics.eslintErrors * PENALTIES.eslintError });
  }
  if (metrics.bundleOverBudget > 0) {
    issues.push({ message: `${metrics.bundleOverBudget} page(s) over bundle budget`, impact: metrics.bundleOverBudget * PENALTIES.bundleOverBudget });
  }
  if (metrics.linterWarning > 0) {
    issues.push({ message: `${metrics.linterWarning} linter warning(s)`, impact: metrics.linterWarning * PENALTIES.linterWarning });
  }
  if (metrics.typeEscapes > 0) {
    issues.push({ message: `${metrics.typeEscapes} type escape(s) (as any, ts-ignore)`, impact: metrics.typeEscapes * PENALTIES.typeEscape });
  }
  if (metrics.unusedExports > 0) {
    issues.push({ message: `${metrics.unusedExports} unused export(s)`, impact: metrics.unusedExports * PENALTIES.unusedExport });
  }

  return issues
    .sort((a, b) => b.impact - a.impact)
    .slice(0, limit)
    .map((i) => i.message);
}

/**
 * Build a complete code health report.
 */
export function buildHealthReport(metrics: CodeHealthMetrics): CodeHealthReport {
  const categories = calculateCategoryScores(metrics);
  const overallScore = calculateHealthScore(metrics);
  const grade = classifyHealth(overallScore);
  const topIssues = identifyTopIssues(metrics);

  const passedCategories = categories.filter((c) => c.status === "✅").length;
  const summary = `Code Health: ${grade} (${overallScore}/100) — ${passedCategories}/${categories.length} categories passing`;

  return {
    overallScore,
    grade,
    categories,
    topIssues,
    timestamp: new Date().toISOString(),
    summary,
  };
}

/**
 * Format a health report for terminal output.
 */
export function formatHealthReport(report: CodeHealthReport): string {
  const lines = [
    `═══ Code Health Dashboard ═══`,
    `Grade: ${report.grade} (${report.overallScore}/100)`,
    "",
    ...report.categories.map((c) => `  ${c.status} ${c.name}: ${c.score}/100 (${c.issues} issues)`),
  ];

  if (report.topIssues.length > 0) {
    lines.push("", "Priority fixes:");
    report.topIssues.forEach((issue, i) => lines.push(`  ${i + 1}. ${issue}`));
  }

  return lines.join("\n");
}
