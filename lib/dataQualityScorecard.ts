/**
 * dataQualityScorecard.ts
 *
 * Unified data quality scorecard built on the six standard dimensions:
 * completeness, accuracy, consistency, timeliness, uniqueness, and
 * validity.  Each dimension is scored independently and weighted into
 * an aggregate quality grade.  Supports trend detection via previous-
 * scorecard comparison.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The six standard data quality dimensions. */
export type QualityDimension =
  | 'completeness'
  | 'accuracy'
  | 'consistency'
  | 'timeliness'
  | 'uniqueness'
  | 'validity';

/** Score for a single dimension. */
export type DimensionScore = {
  dimension: QualityDimension;
  /** 0-100 */
  score: number;
  grade: string;
  /** Number of checks that passed */
  passed: number;
  /** Number of checks that failed */
  failed: number;
  details: string[];
};

/** Input check for completeness dimension. */
export type CompletenessCheck = {
  field: string;
  totalRecords: number;
  nullOrMissing: number;
};

/** Input check for accuracy dimension. */
export type AccuracyCheck = {
  field: string;
  totalRecords: number;
  outOfRange: number;
  /** Optional human-readable domain rule */
  rule?: string;
};

/** Input check for consistency dimension. */
export type ConsistencyCheck = {
  relation: string;
  totalRecords: number;
  integrityFailures: number;
};

/** Input check for timeliness dimension. */
export type TimelinessCheck = {
  source: string;
  /** Last update timestamp (epoch ms) */
  lastUpdatedAt: number;
  /** Maximum acceptable staleness (ms) */
  stalenessThresholdMs: number;
};

/** Input check for uniqueness dimension. */
export type UniquenessCheck = {
  field: string;
  totalRecords: number;
  duplicates: number;
};

/** Input check for validity dimension. */
export type ValidityCheck = {
  field: string;
  totalRecords: number;
  formatViolations: number;
  constraintViolations: number;
};

/** Aggregated scorecard. */
export type QualityScorecard = {
  generatedAt: number;
  /** Weighted aggregate score 0-100 */
  overallScore: number;
  /** Letter grade A+ to F */
  overallGrade: string;
  dimensions: DimensionScore[];
  /** Change vs previous scorecard (if provided) */
  trend: TrendEntry[] | null;
};

export type TrendEntry = {
  dimension: QualityDimension;
  previousScore: number;
  currentScore: number;
  delta: number;
  direction: 'improved' | 'stable' | 'degraded';
};

/** A dimension that is drifting negatively. */
export type Drift = {
  dimension: QualityDimension;
  previousScore: number;
  currentScore: number;
  delta: number;
  severity: 'critical' | 'warning' | 'minor';
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All six quality dimensions. */
export const QUALITY_DIMENSIONS: readonly QualityDimension[] = [
  'completeness',
  'accuracy',
  'consistency',
  'timeliness',
  'uniqueness',
  'validity',
];

/** Weights per dimension (sums to 1.0). */
export const DIMENSION_WEIGHTS: Record<QualityDimension, number> = {
  completeness: 0.20,
  accuracy: 0.25,
  consistency: 0.20,
  timeliness: 0.10,
  uniqueness: 0.15,
  validity: 0.10,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gradeFromScore(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function ratioToScore(passed: number, failed: number): number {
  const total = passed + failed;
  return total > 0 ? Math.round((passed / total) * 100 * 100) / 100 : 100;
}

// ---------------------------------------------------------------------------
// Dimension assessors
// ---------------------------------------------------------------------------

/**
 * Assess completeness: ratio of non-null / non-missing fields.
 */
export function assessCompleteness(checks: CompletenessCheck[]): DimensionScore {
  let totalPassed = 0;
  let totalFailed = 0;
  const details: string[] = [];

  for (const c of checks) {
    const missing = c.nullOrMissing;
    const present = c.totalRecords - missing;
    totalPassed += present;
    totalFailed += missing;
    if (missing > 0) {
      const pct = ((missing / c.totalRecords) * 100).toFixed(1);
      details.push(`${c.field}: ${missing}/${c.totalRecords} missing (${pct}%)`);
    }
  }

  const score = ratioToScore(totalPassed, totalFailed);
  return { dimension: 'completeness', score, grade: gradeFromScore(score), passed: totalPassed, failed: totalFailed, details };
}

/**
 * Assess accuracy: ratio of in-range values to total.
 */
export function assessAccuracy(checks: AccuracyCheck[]): DimensionScore {
  let totalPassed = 0;
  let totalFailed = 0;
  const details: string[] = [];

  for (const c of checks) {
    const good = c.totalRecords - c.outOfRange;
    totalPassed += good;
    totalFailed += c.outOfRange;
    if (c.outOfRange > 0) {
      details.push(
        `${c.field}: ${c.outOfRange} out-of-range${c.rule ? ` (rule: ${c.rule})` : ''}`,
      );
    }
  }

  const score = ratioToScore(totalPassed, totalFailed);
  return { dimension: 'accuracy', score, grade: gradeFromScore(score), passed: totalPassed, failed: totalFailed, details };
}

/**
 * Assess consistency: cross-table referential integrity.
 */
export function assessConsistency(checks: ConsistencyCheck[]): DimensionScore {
  let totalPassed = 0;
  let totalFailed = 0;
  const details: string[] = [];

  for (const c of checks) {
    const good = c.totalRecords - c.integrityFailures;
    totalPassed += good;
    totalFailed += c.integrityFailures;
    if (c.integrityFailures > 0) {
      details.push(`${c.relation}: ${c.integrityFailures} integrity failures`);
    }
  }

  const score = ratioToScore(totalPassed, totalFailed);
  return { dimension: 'consistency', score, grade: gradeFromScore(score), passed: totalPassed, failed: totalFailed, details };
}

/**
 * Assess timeliness: data freshness against staleness thresholds.
 */
export function assessTimeliness(checks: TimelinessCheck[]): DimensionScore {
  const now = Date.now();
  let passed = 0;
  let failed = 0;
  const details: string[] = [];

  for (const c of checks) {
    const age = now - c.lastUpdatedAt;
    if (age <= c.stalenessThresholdMs) {
      passed++;
    } else {
      failed++;
      const staleMinutes = Math.round(age / 60_000);
      const threshMinutes = Math.round(c.stalenessThresholdMs / 60_000);
      details.push(`${c.source}: ${staleMinutes}min old (threshold ${threshMinutes}min)`);
    }
  }

  const score = ratioToScore(passed, failed);
  return { dimension: 'timeliness', score, grade: gradeFromScore(score), passed, failed, details };
}

/**
 * Assess uniqueness: duplicate detection rate.
 */
export function assessUniqueness(checks: UniquenessCheck[]): DimensionScore {
  let totalPassed = 0;
  let totalFailed = 0;
  const details: string[] = [];

  for (const c of checks) {
    const unique = c.totalRecords - c.duplicates;
    totalPassed += unique;
    totalFailed += c.duplicates;
    if (c.duplicates > 0) {
      const pct = ((c.duplicates / c.totalRecords) * 100).toFixed(1);
      details.push(`${c.field}: ${c.duplicates} duplicates (${pct}%)`);
    }
  }

  const score = ratioToScore(totalPassed, totalFailed);
  return { dimension: 'uniqueness', score, grade: gradeFromScore(score), passed: totalPassed, failed: totalFailed, details };
}

/**
 * Assess validity: format and constraint violations.
 */
export function assessValidity(checks: ValidityCheck[]): DimensionScore {
  let totalPassed = 0;
  let totalFailed = 0;
  const details: string[] = [];

  for (const c of checks) {
    const violations = c.formatViolations + c.constraintViolations;
    const good = c.totalRecords - violations;
    totalPassed += Math.max(good, 0);
    totalFailed += violations;
    if (violations > 0) {
      details.push(
        `${c.field}: ${c.formatViolations} format + ${c.constraintViolations} constraint violations`,
      );
    }
  }

  const score = ratioToScore(totalPassed, totalFailed);
  return { dimension: 'validity', score, grade: gradeFromScore(score), passed: totalPassed, failed: totalFailed, details };
}

// ---------------------------------------------------------------------------
// Scorecard builder
// ---------------------------------------------------------------------------

/** Input bundle for building a scorecard. */
export type ScorecardChecks = {
  completeness: CompletenessCheck[];
  accuracy: AccuracyCheck[];
  consistency: ConsistencyCheck[];
  timeliness: TimelinessCheck[];
  uniqueness: UniquenessCheck[];
  validity: ValidityCheck[];
};

/**
 * Build a weighted quality scorecard from dimension checks.
 *
 * @param checks   - Check data for each dimension.
 * @param previous - Optional previous scorecard for trend detection.
 */
export function buildScorecard(
  checks: ScorecardChecks,
  previous?: QualityScorecard,
): QualityScorecard {
  const dimensions: DimensionScore[] = [
    assessCompleteness(checks.completeness),
    assessAccuracy(checks.accuracy),
    assessConsistency(checks.consistency),
    assessTimeliness(checks.timeliness),
    assessUniqueness(checks.uniqueness),
    assessValidity(checks.validity),
  ];

  let overallScore = 0;
  for (const d of dimensions) {
    overallScore += d.score * DIMENSION_WEIGHTS[d.dimension];
  }
  overallScore = Math.round(overallScore * 100) / 100;

  let trend: TrendEntry[] | null = null;
  if (previous) {
    trend = dimensions.map((d) => {
      const prev = previous.dimensions.find((p) => p.dimension === d.dimension);
      const prevScore = prev?.score ?? d.score;
      const delta = Math.round((d.score - prevScore) * 100) / 100;
      return {
        dimension: d.dimension,
        previousScore: prevScore,
        currentScore: d.score,
        delta,
        direction: delta > 1 ? 'improved' : delta < -1 ? 'degraded' : 'stable',
      } as TrendEntry;
    });
  }

  return {
    generatedAt: Date.now(),
    overallScore,
    overallGrade: gradeFromScore(overallScore),
    dimensions,
    trend,
  };
}

/**
 * Detect dimensions that are drifting negatively compared to a previous scorecard.
 */
export function detectQualityDrift(
  current: QualityScorecard,
  previous: QualityScorecard,
): Drift[] {
  const drifts: Drift[] = [];

  for (const dim of current.dimensions) {
    const prev = previous.dimensions.find((p) => p.dimension === dim.dimension);
    if (!prev) continue;
    const delta = dim.score - prev.score;
    if (delta >= 0) continue;

    let severity: 'critical' | 'warning' | 'minor';
    if (delta <= -10) severity = 'critical';
    else if (delta <= -5) severity = 'warning';
    else severity = 'minor';

    drifts.push({
      dimension: dim.dimension,
      previousScore: prev.score,
      currentScore: dim.score,
      delta: Math.round(delta * 100) / 100,
      severity,
    });
  }

  return drifts.sort((a, b) => a.delta - b.delta);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a quality scorecard as a human-readable string.
 */
export function formatScorecard(scorecard: QualityScorecard): string {
  const lines: string[] = [
    '=== Data Quality Scorecard ===',
    `Generated: ${new Date(scorecard.generatedAt).toISOString()}`,
    `Overall: ${scorecard.overallScore}/100 (${scorecard.overallGrade})`,
    '',
    '--- Dimensions ---',
  ];

  for (const d of scorecard.dimensions) {
    const weight = (DIMENSION_WEIGHTS[d.dimension] * 100).toFixed(0);
    lines.push(
      `  ${d.dimension.padEnd(14)} ${d.score.toString().padStart(6)}/100 (${d.grade}) [weight ${weight}%]`,
    );
    for (const detail of d.details) {
      lines.push(`    - ${detail}`);
    }
  }

  if (scorecard.trend) {
    lines.push('', '--- Trend ---');
    for (const t of scorecard.trend) {
      const arrow = t.direction === 'improved' ? '+' : t.direction === 'degraded' ? '-' : '=';
      lines.push(
        `  ${t.dimension.padEnd(14)} ${t.previousScore} -> ${t.currentScore} (${arrow}${Math.abs(t.delta).toFixed(1)})`,
      );
    }
  }

  return lines.join('\n');
}
