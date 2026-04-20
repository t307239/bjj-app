/**
 * seoPerformanceBridge.ts
 *
 * Bridges Core Web Vitals metrics to SEO impact assessment.
 * Maps CWV scores to ranking factor weights using Google's official
 * thresholds, estimates traffic impact, and generates actionable
 * recommendations for improving organic search performance.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Core Web Vitals metrics (all values in their native units). */
export type CWVMetrics = {
  /** Largest Contentful Paint (ms) */
  lcp: number;
  /** First Input Delay (ms) */
  fid: number;
  /** Cumulative Layout Shift (unitless) */
  cls: number;
  /** Interaction to Next Paint (ms) */
  inp: number;
  /** Time to First Byte (ms) */
  ttfb: number;
  /** First Contentful Paint (ms) */
  fcp: number;
};

export type MetricGrade = 'good' | 'needs-improvement' | 'poor';

export type SEOImpact = {
  /** Weighted score 0-100 */
  score: number;
  /** Letter grade A-F */
  grade: string;
  /** Ranking factors negatively affected */
  affectedRankingFactors: string[];
  /** Actionable recommendations sorted by priority */
  recommendations: Recommendation[];
};

export type TrafficEstimate = {
  /** Estimated organic traffic change as a percentage (-100 to +100) */
  changePercent: number;
  /** Human-readable summary */
  summary: string;
};

export type Bottleneck = {
  metric: keyof CWVMetrics;
  value: number;
  grade: MetricGrade;
  /** SEO weight contribution lost (0-25) */
  impactPoints: number;
  suggestion: string;
};

export type Recommendation = {
  priority: 'critical' | 'high' | 'medium' | 'low';
  metric: keyof CWVMetrics;
  title: string;
  description: string;
};

export type PageMetrics = {
  url: string;
  metrics: CWVMetrics;
};

export type Report = {
  generatedAt: number;
  pageCount: number;
  averageScore: number;
  worstPage: PageMetrics & { score: number } | null;
  bestPage: PageMetrics & { score: number } | null;
  pages: Array<PageMetrics & { score: number; grade: string }>;
  overallRecommendations: Recommendation[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** SEO weight per metric (sums to 1.0). */
export const CWV_SEO_WEIGHTS: Record<keyof CWVMetrics, number> = {
  lcp: 0.25,
  cls: 0.25,
  inp: 0.20,
  fid: 0.10,
  ttfb: 0.10,
  fcp: 0.10,
};

/**
 * Google's official CWV thresholds.
 * [good_upper, needs_improvement_upper] — anything above is poor.
 */
export const CWV_THRESHOLDS: Record<keyof CWVMetrics, [number, number]> = {
  lcp: [2500, 4000],
  fid: [100, 300],
  cls: [0.1, 0.25],
  inp: [200, 500],
  ttfb: [800, 1800],
  fcp: [1800, 3000],
};

const GRADE_TABLE: Array<[number, string]> = [
  [90, 'A'],
  [80, 'B'],
  [70, 'C'],
  [50, 'D'],
  [0, 'F'],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Grade a single metric against its threshold. */
function gradeMetric(metric: keyof CWVMetrics, value: number): MetricGrade {
  const [good, mid] = CWV_THRESHOLDS[metric];
  if (value <= good) return 'good';
  if (value <= mid) return 'needs-improvement';
  return 'poor';
}

/** Convert a metric grade to a 0-1 score. */
function gradeToScore(grade: MetricGrade): number {
  if (grade === 'good') return 1;
  if (grade === 'needs-improvement') return 0.5;
  return 0;
}

function letterGrade(score: number): string {
  for (const [threshold, grade] of GRADE_TABLE) {
    if (score >= threshold) return grade;
  }
  return 'F';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assess the SEO impact of the given Core Web Vitals metrics.
 * Returns a weighted score (0-100), letter grade, affected ranking
 * factors, and prioritised recommendations.
 */
export function assessSEOImpact(metrics: CWVMetrics): SEOImpact {
  let score = 0;
  const affectedRankingFactors: string[] = [];

  for (const key of Object.keys(CWV_SEO_WEIGHTS) as Array<keyof CWVMetrics>) {
    const grade = gradeMetric(key, metrics[key]);
    score += gradeToScore(grade) * CWV_SEO_WEIGHTS[key] * 100;
    if (grade !== 'good') {
      affectedRankingFactors.push(`${key.toUpperCase()} (${grade})`);
    }
  }

  const rounded = Math.round(score * 100) / 100;
  return {
    score: rounded,
    grade: letterGrade(rounded),
    affectedRankingFactors,
    recommendations: generatePageSpeedRecommendations(metrics),
  };
}

/**
 * Estimate the organic traffic impact of improving from one score to another.
 * Based on empirical studies showing ~1 % traffic change per CWV score point
 * in the 50-90 range, with diminishing returns above 90.
 */
export function estimateTrafficImpact(
  currentScore: number,
  improvedScore: number,
): TrafficEstimate {
  const delta = improvedScore - currentScore;
  const midpoint = (currentScore + improvedScore) / 2;
  const multiplier = midpoint < 50 ? 1.5 : midpoint < 90 ? 1.0 : 0.5;
  const changePercent = Math.round(delta * multiplier * 100) / 100;

  const direction = changePercent >= 0 ? 'increase' : 'decrease';
  return {
    changePercent,
    summary: `Estimated ${Math.abs(changePercent).toFixed(1)}% organic traffic ${direction} (score ${currentScore} -> ${improvedScore}).`,
  };
}

/**
 * Identify SEO bottlenecks ranked by their weighted impact on rankings.
 */
export function identifySEOBottlenecks(metrics: CWVMetrics): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];

  for (const key of Object.keys(CWV_SEO_WEIGHTS) as Array<keyof CWVMetrics>) {
    const grade = gradeMetric(key, metrics[key]);
    if (grade === 'good') continue;

    const lost = (1 - gradeToScore(grade)) * CWV_SEO_WEIGHTS[key] * 100;
    bottlenecks.push({
      metric: key,
      value: metrics[key],
      grade,
      impactPoints: Math.round(lost * 100) / 100,
      suggestion: recommendationForMetric(key, grade).description,
    });
  }

  return bottlenecks.sort((a, b) => b.impactPoints - a.impactPoints);
}

/** Generate actionable PageSpeed recommendations for the given metrics. */
export function generatePageSpeedRecommendations(
  metrics: CWVMetrics,
): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const key of Object.keys(CWV_SEO_WEIGHTS) as Array<keyof CWVMetrics>) {
    const grade = gradeMetric(key, metrics[key]);
    if (grade === 'good') continue;
    recs.push(recommendationForMetric(key, grade));
  }
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/** Build a multi-page SEO performance report. */
export function buildSEOPerformanceReport(pages: PageMetrics[]): Report {
  const scored = pages.map((p) => {
    const impact = assessSEOImpact(p.metrics);
    return { ...p, score: impact.score, grade: impact.grade };
  });

  const sorted = [...scored].sort((a, b) => a.score - b.score);
  const avg = scored.length
    ? Math.round((scored.reduce((s, p) => s + p.score, 0) / scored.length) * 100) / 100
    : 0;

  const allRecs = pages.flatMap((p) => generatePageSpeedRecommendations(p.metrics));
  const uniqueRecs = allRecs.filter(
    (r, i, arr) => arr.findIndex((x) => x.title === r.title) === i,
  );

  return {
    generatedAt: Date.now(),
    pageCount: pages.length,
    averageScore: avg,
    worstPage: sorted[0] ?? null,
    bestPage: sorted[sorted.length - 1] ?? null,
    pages: scored,
    overallRecommendations: uniqueRecs,
  };
}

/** Format a report as a human-readable string. */
export function formatSEOPerformanceReport(report: Report): string {
  const lines: string[] = [
    '=== SEO Performance Report ===',
    `Generated: ${new Date(report.generatedAt).toISOString()}`,
    `Pages analysed: ${report.pageCount}`,
    `Average score: ${report.averageScore}`,
    '',
  ];

  if (report.worstPage) {
    lines.push(`Worst: ${report.worstPage.url} (${report.worstPage.score})`);
  }
  if (report.bestPage) {
    lines.push(`Best:  ${report.bestPage.url} (${report.bestPage.score})`);
  }

  lines.push('', '--- Per-page ---');
  for (const p of report.pages) {
    lines.push(`  ${p.grade} ${p.score.toString().padStart(6)} | ${p.url}`);
  }

  if (report.overallRecommendations.length) {
    lines.push('', '--- Recommendations ---');
    for (const r of report.overallRecommendations) {
      lines.push(`  [${r.priority.toUpperCase()}] ${r.title}: ${r.description}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Internal recommendation builder
// ---------------------------------------------------------------------------

function recommendationForMetric(
  metric: keyof CWVMetrics,
  grade: MetricGrade,
): Recommendation {
  const priority = grade === 'poor' ? 'critical' : 'high';
  const map: Record<keyof CWVMetrics, { title: string; description: string }> = {
    lcp: {
      title: 'Optimise Largest Contentful Paint',
      description:
        'Preload hero images, use responsive srcset, inline critical CSS, and consider a CDN for static assets.',
    },
    cls: {
      title: 'Reduce Cumulative Layout Shift',
      description:
        'Set explicit width/height on images and embeds, avoid injecting content above the fold after load.',
    },
    inp: {
      title: 'Improve Interaction to Next Paint',
      description:
        'Break long tasks with `requestIdleCallback`, reduce main-thread JS, defer non-critical handlers.',
    },
    fid: {
      title: 'Reduce First Input Delay',
      description:
        'Minimise main-thread blocking by code-splitting, deferring third-party scripts, and using web workers.',
    },
    ttfb: {
      title: 'Lower Time to First Byte',
      description:
        'Enable edge caching, optimise server-side queries, use stale-while-revalidate headers.',
    },
    fcp: {
      title: 'Speed up First Contentful Paint',
      description:
        'Inline critical CSS, eliminate render-blocking resources, preconnect to required origins.',
    },
  };

  return { priority, metric, ...map[metric] };
}
