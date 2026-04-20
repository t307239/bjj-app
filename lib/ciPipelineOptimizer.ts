/**
 * ciPipelineOptimizer.ts
 *
 * Analyses CI pipeline runs for bottlenecks, flakiness, and
 * parallelisation opportunities.  Produces health scores and
 * actionable optimisation suggestions (caching, step reordering,
 * conditional execution).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single step inside a pipeline run. */
export type PipelineStep = {
  name: string;
  /** Duration in ms */
  durationMs: number;
  /** Whether the step passed */
  passed: boolean;
  /** Steps this step depends on (by name) */
  dependsOn: string[];
  /** Whether the step is cacheable (e.g. `npm install`) */
  cacheable: boolean;
};

/** One complete pipeline run. */
export type PipelineRun = {
  id: string;
  /** Unix epoch ms */
  startedAt: number;
  /** Total duration ms */
  totalDurationMs: number;
  steps: PipelineStep[];
  /** Overall pass/fail */
  passed: boolean;
  /** Time spent waiting in queue before starting (ms) */
  queueTimeMs: number;
};

/** Bottleneck analysis for a single run. */
export type BottleneckAnalysis = {
  /** Slowest step */
  slowest: PipelineStep;
  /** Critical path: longest chain of dependent steps */
  criticalPath: string[];
  criticalPathDurationMs: number;
  /** Steps that could run in parallel but currently don't */
  parallelisable: string[][];
  /** Steps exceeding their benchmarks */
  overBenchmark: Array<{ step: string; actual: number; benchmark: number }>;
};

/** Flakiness report for a step. */
export type StepFlakiness = {
  name: string;
  totalRuns: number;
  failures: number;
  failureRate: number;
  /** Consecutive pass/fail flips */
  flips: number;
};

export type FlakinessReport = {
  steps: StepFlakiness[];
  overallFlakinessPercent: number;
};

/** Plan for running steps in parallel. */
export type ParallelPlan = {
  /** Groups of steps that can execute concurrently */
  groups: string[][];
  estimatedDurationMs: number;
  savingsMs: number;
  savingsPercent: number;
};

/** Aggregate CI health score. */
export type CIHealthScore = {
  /** 0-100 */
  score: number;
  grade: string;
  successRate: number;
  avgDurationMs: number;
  flakinessPercent: number;
  avgQueueTimeMs: number;
  breakdown: Record<string, number>;
};

export type Optimization = {
  type: 'caching' | 'parallelisation' | 'conditional' | 'split' | 'reorder';
  target: string;
  description: string;
  estimatedSavingsMs: number;
};

export type PipelineReport = {
  generatedAt: number;
  runCount: number;
  health: CIHealthScore;
  bottleneck: BottleneckAnalysis | null;
  flakiness: FlakinessReport;
  parallelPlan: ParallelPlan | null;
  optimizations: Optimization[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Expected duration benchmarks per step name (ms). */
export const STEP_BENCHMARKS: Record<string, number> = {
  lint: 30_000,
  tsc: 45_000,
  test: 60_000,
  build: 120_000,
  lighthouse: 90_000,
  bug_scan: 15_000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function letterGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function buildDependencyMap(steps: PipelineStep[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const s of steps) {
    map.set(s.name, new Set(s.dependsOn));
  }
  return map;
}

function findCriticalPath(steps: PipelineStep[]): { path: string[]; duration: number } {
  const durMap = new Map(steps.map((s) => [s.name, s.durationMs]));
  const depMap = buildDependencyMap(steps);
  const memo = new Map<string, { path: string[]; duration: number }>();

  function longest(name: string): { path: string[]; duration: number } {
    if (memo.has(name)) return memo.get(name)!;
    const deps = depMap.get(name) ?? new Set<string>();
    let best = { path: [] as string[], duration: 0 };
    for (const dep of deps) {
      const sub = longest(dep);
      if (sub.duration > best.duration) best = sub;
    }
    const result = {
      path: [...best.path, name],
      duration: best.duration + (durMap.get(name) ?? 0),
    };
    memo.set(name, result);
    return result;
  }

  let overall = { path: [] as string[], duration: 0 };
  for (const s of steps) {
    const candidate = longest(s.name);
    if (candidate.duration > overall.duration) overall = candidate;
  }
  return overall;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse a single pipeline run for bottlenecks.
 */
export function analyzePipelineRun(steps: PipelineStep[]): BottleneckAnalysis {
  const sorted = [...steps].sort((a, b) => b.durationMs - a.durationMs);
  const slowest = sorted[0];

  const { path: criticalPath, duration: criticalPathDurationMs } =
    findCriticalPath(steps);

  // Find parallelisable groups (steps with no mutual dependency)
  const depMap = buildDependencyMap(steps);
  const groups: string[][] = [];
  const roots = steps.filter((s) => s.dependsOn.length === 0).map((s) => s.name);
  if (roots.length > 1) groups.push(roots);

  // Steps exceeding benchmarks
  const overBenchmark = steps
    .filter((s) => {
      const bench = STEP_BENCHMARKS[s.name];
      return bench !== undefined && s.durationMs > bench;
    })
    .map((s) => ({
      step: s.name,
      actual: s.durationMs,
      benchmark: STEP_BENCHMARKS[s.name],
    }));

  return {
    slowest,
    criticalPath,
    criticalPathDurationMs,
    parallelisable: groups,
    overBenchmark,
  };
}

/**
 * Detect flaky steps across multiple runs.
 */
export function detectFlakiness(runs: PipelineRun[]): FlakinessReport {
  const stepRuns = new Map<string, boolean[]>();
  for (const run of runs) {
    for (const step of run.steps) {
      const history = stepRuns.get(step.name) ?? [];
      history.push(step.passed);
      stepRuns.set(step.name, history);
    }
  }

  const stepReports: StepFlakiness[] = [];
  for (const [name, results] of stepRuns) {
    const failures = results.filter((r) => !r).length;
    let flips = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i] !== results[i - 1]) flips++;
    }
    stepReports.push({
      name,
      totalRuns: results.length,
      failures,
      failureRate: Math.round((failures / results.length) * 100) / 100,
      flips,
    });
  }

  const totalFlaky = stepReports.filter((s) => s.flips >= 2).length;
  const overallPercent = stepReports.length > 0
    ? Math.round((totalFlaky / stepReports.length) * 100)
    : 0;

  return {
    steps: stepReports.sort((a, b) => b.failureRate - a.failureRate),
    overallFlakinessPercent: overallPercent,
  };
}

/**
 * Estimate which steps can run in parallel and the time savings.
 */
export function estimateParallelization(steps: PipelineStep[]): ParallelPlan {
  const depMap = buildDependencyMap(steps);
  const durMap = new Map(steps.map((s) => [s.name, s.durationMs]));
  const scheduled = new Set<string>();
  const groups: string[][] = [];
  let parallelDuration = 0;

  while (scheduled.size < steps.length) {
    const ready = steps
      .filter((s) => !scheduled.has(s.name))
      .filter((s) => s.dependsOn.every((d) => scheduled.has(d)));

    if (ready.length === 0) break; // circular dep guard

    const groupNames = ready.map((s) => s.name);
    groups.push(groupNames);
    parallelDuration += Math.max(...ready.map((s) => s.durationMs));
    for (const s of ready) scheduled.add(s.name);
  }

  const serialDuration = steps.reduce((s, st) => s + st.durationMs, 0);
  const savings = serialDuration - parallelDuration;

  return {
    groups,
    estimatedDurationMs: parallelDuration,
    savingsMs: Math.max(savings, 0),
    savingsPercent: serialDuration > 0 ? Math.round((savings / serialDuration) * 100) : 0,
  };
}

/**
 * Calculate an aggregate CI health score from multiple runs.
 */
export function calculateCIHealth(runs: PipelineRun[]): CIHealthScore {
  if (runs.length === 0) {
    return { score: 0, grade: 'F', successRate: 0, avgDurationMs: 0, flakinessPercent: 0, avgQueueTimeMs: 0, breakdown: {} };
  }

  const successRate = runs.filter((r) => r.passed).length / runs.length;
  const avgDuration = Math.round(
    runs.reduce((s, r) => s + r.totalDurationMs, 0) / runs.length,
  );
  const avgQueue = Math.round(
    runs.reduce((s, r) => s + r.queueTimeMs, 0) / runs.length,
  );
  const flakiness = detectFlakiness(runs).overallFlakinessPercent;

  const breakdown = {
    successRate: Math.round(successRate * 40),
    duration: avgDuration <= 120_000 ? 25 : avgDuration <= 300_000 ? 15 : 5,
    flakiness: Math.max(0, 20 - flakiness),
    queueTime: avgQueue <= 30_000 ? 15 : avgQueue <= 120_000 ? 10 : 5,
  };

  const score = Object.values(breakdown).reduce((s, v) => s + v, 0);

  return {
    score,
    grade: letterGrade(score),
    successRate: Math.round(successRate * 100),
    avgDurationMs: avgDuration,
    flakinessPercent: flakiness,
    avgQueueTimeMs: avgQueue,
    breakdown,
  };
}

/**
 * Suggest optimisations based on bottleneck analysis.
 */
export function suggestOptimizations(
  analysis: BottleneckAnalysis,
): Optimization[] {
  const opts: Optimization[] = [];

  for (const ob of analysis.overBenchmark) {
    opts.push({
      type: 'caching',
      target: ob.step,
      description: `${ob.step} took ${ob.actual}ms (benchmark ${ob.benchmark}ms). Consider caching dependencies or intermediate artefacts.`,
      estimatedSavingsMs: Math.round((ob.actual - ob.benchmark) * 0.6),
    });
  }

  for (const group of analysis.parallelisable) {
    if (group.length > 1) {
      opts.push({
        type: 'parallelisation',
        target: group.join(', '),
        description: `Steps [${group.join(', ')}] have no mutual dependencies and can run in parallel.`,
        estimatedSavingsMs: 0, // computed in ParallelPlan
      });
    }
  }

  return opts.sort((a, b) => b.estimatedSavingsMs - a.estimatedSavingsMs);
}

/**
 * Build a comprehensive pipeline report from a set of runs.
 */
export function buildPipelineReport(runs: PipelineRun[]): PipelineReport {
  const health = calculateCIHealth(runs);
  const flakiness = detectFlakiness(runs);
  const latestRun = runs.length > 0
    ? [...runs].sort((a, b) => b.startedAt - a.startedAt)[0]
    : null;
  const bottleneck = latestRun ? analyzePipelineRun(latestRun.steps) : null;
  const parallelPlan = latestRun ? estimateParallelization(latestRun.steps) : null;
  const optimizations = bottleneck ? suggestOptimizations(bottleneck) : [];

  return {
    generatedAt: Date.now(),
    runCount: runs.length,
    health,
    bottleneck,
    flakiness,
    parallelPlan,
    optimizations,
  };
}

/**
 * Format a pipeline report as a human-readable string.
 */
export function formatPipelineReport(report: PipelineReport): string {
  const lines: string[] = [
    '=== CI Pipeline Report ===',
    `Generated: ${new Date(report.generatedAt).toISOString()}`,
    `Runs analysed: ${report.runCount}`,
    `Health score: ${report.health.score}/100 (${report.health.grade})`,
    `Success rate: ${report.health.successRate}%`,
    `Avg duration: ${report.health.avgDurationMs}ms`,
    `Avg queue: ${report.health.avgQueueTimeMs}ms`,
    `Flakiness: ${report.health.flakinessPercent}%`,
    '',
  ];

  if (report.bottleneck) {
    lines.push('--- Bottleneck ---');
    lines.push(`  Slowest step: ${report.bottleneck.slowest.name} (${report.bottleneck.slowest.durationMs}ms)`);
    lines.push(`  Critical path: ${report.bottleneck.criticalPath.join(' -> ')} (${report.bottleneck.criticalPathDurationMs}ms)`);
    if (report.bottleneck.overBenchmark.length) {
      lines.push('  Over benchmark:');
      for (const ob of report.bottleneck.overBenchmark) {
        lines.push(`    ${ob.step}: ${ob.actual}ms (bench ${ob.benchmark}ms)`);
      }
    }
    lines.push('');
  }

  if (report.parallelPlan) {
    lines.push('--- Parallelisation plan ---');
    for (let i = 0; i < report.parallelPlan.groups.length; i++) {
      lines.push(`  Group ${i + 1}: [${report.parallelPlan.groups[i].join(', ')}]`);
    }
    lines.push(`  Estimated total: ${report.parallelPlan.estimatedDurationMs}ms (saves ${report.parallelPlan.savingsPercent}%)`);
    lines.push('');
  }

  if (report.flakiness.steps.length) {
    lines.push('--- Flaky steps ---');
    for (const s of report.flakiness.steps.filter((s) => s.failureRate > 0)) {
      lines.push(`  ${s.name}: ${(s.failureRate * 100).toFixed(0)}% failure rate, ${s.flips} flips`);
    }
    lines.push('');
  }

  if (report.optimizations.length) {
    lines.push('--- Optimisations ---');
    for (const opt of report.optimizations) {
      lines.push(`  [${opt.type}] ${opt.target}: ${opt.description}`);
    }
  }

  return lines.join('\n');
}
