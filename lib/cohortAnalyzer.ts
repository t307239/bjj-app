/**
 * lib/cohortAnalyzer.ts — Cohort retention analysis
 *
 * Q-167: Retention pillar 93→94 — Groups users by signup period,
 * calculates N-day/N-week retention rates, identifies best/worst
 * cohorts, and generates intervention recommendations.
 *
 * Pure utility layer — operates on arrays of user activity data.
 *
 * @example
 *   import { buildCohortMatrix, analyzeCohort } from "@/lib/cohortAnalyzer";
 *
 *   const matrix = buildCohortMatrix(users, "month");
 *   // → { cohorts: [{ period: "2026-01", size: 42, retentionByWeek: [100, 78, 65, ...] }] }
 *
 *   const analysis = analyzeCohort(matrix);
 *   // → { bestCohort: "2026-03", worstCohort: "2026-01", ... }
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface UserActivity {
  /** Unique user ID */
  userId: string;
  /** Signup date (ISO string) */
  signupDate: string;
  /** Array of activity dates (ISO strings) */
  activityDates: string[];
}

export interface CohortBucket {
  /** Period label (e.g., "2026-01" for month, "2026-W05" for week) */
  period: string;
  /** Number of users who signed up in this period */
  size: number;
  /** Retention percentage at each period offset [100, 78, 65, ...] */
  retentionByPeriod: number[];
  /** Raw retained user counts at each period offset */
  retainedCounts: number[];
}

export interface CohortMatrix {
  /** Granularity of the cohort grouping */
  granularity: "week" | "month";
  /** Retention measurement periods (days for week, weeks for month) */
  periodOffsets: number[];
  /** Period labels for the offsets (e.g., "Week 1", "Week 2" or "Month 1") */
  periodLabels: string[];
  /** Cohort buckets sorted chronologically */
  cohorts: CohortBucket[];
  /** Total unique users across all cohorts */
  totalUsers: number;
}

export interface CohortAnalysis {
  /** Best performing cohort (highest avg retention) */
  bestCohort: { period: string; avgRetention: number } | null;
  /** Worst performing cohort (lowest avg retention) */
  worstCohort: { period: string; avgRetention: number } | null;
  /** Overall average retention at each period offset */
  overallRetention: number[];
  /** Week-over-week / period-over-period retention drop rates */
  dropRates: number[];
  /** Critical drop point (period with largest drop) */
  criticalDropPeriod: number;
  /** Suggested interventions */
  interventions: CohortIntervention[];
  /** Health assessment */
  health: "strong" | "moderate" | "weak";
}

export interface CohortIntervention {
  /** Target period offset */
  period: number;
  /** Type of intervention */
  type: "onboarding" | "engagement" | "reactivation" | "loyalty";
  /** Description */
  description: string;
  /** Priority */
  priority: "high" | "medium" | "low";
}

// ── Constants ──────────────────────────────────────────────────────────

/** Default retention measurement periods (in days from signup) */
export const RETENTION_DAYS = [1, 3, 7, 14, 30, 60, 90] as const;

/** Retention health thresholds (Day 30 retention) */
export const RETENTION_THRESHOLDS = {
  strong: 40,   // ≥40% D30 = strong
  moderate: 20, // ≥20% D30 = moderate
  weak: 0,      // <20% D30 = weak
} as const;

/** Intervention templates keyed by drop point */
export const INTERVENTION_TEMPLATES: Record<string, CohortIntervention> = {
  day1_drop: {
    period: 0,
    type: "onboarding",
    description: "High Day-1 churn: Simplify onboarding flow, add welcome push notification, show immediate value",
    priority: "high",
  },
  week1_drop: {
    period: 1,
    type: "onboarding",
    description: "Week-1 drop: Add guided setup checklist, first-session celebration, beginner tips push",
    priority: "high",
  },
  week2_drop: {
    period: 2,
    type: "engagement",
    description: "Week-2 drop: Introduce streak mechanics, training reminders, technique suggestions",
    priority: "medium",
  },
  month1_drop: {
    period: 3,
    type: "engagement",
    description: "Month-1 drop: Trigger progress insights, belt milestone preview, social features",
    priority: "medium",
  },
  month2_drop: {
    period: 4,
    type: "reactivation",
    description: "Month-2 drop: Send win-back email, show training gap analysis, offer Pro trial",
    priority: "medium",
  },
  month3_drop: {
    period: 5,
    type: "loyalty",
    description: "Month-3+ retention: Reward loyal users, unlock advanced features, community recognition",
    priority: "low",
  },
};

// ── Helper Functions ───────────────────────────────────────────────────

/** Convert date to period key */
export function dateToPeriodKey(dateStr: string, granularity: "week" | "month"): string {
  const dt = new Date(dateStr);
  if (granularity === "month") {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  }
  // Week
  const year = dt.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.ceil((dt.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Calculate days between two dates */
export function daysBetween(a: string, b: string): number {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.floor(Math.abs(msB - msA) / (24 * 60 * 60 * 1000));
}

/**
 * Check if a user was active within a window around a target day offset.
 * Uses a ±1 day window for daily precision.
 */
function wasActiveAtOffset(
  signupDate: string,
  activityDates: string[],
  targetDays: number
): boolean {
  const signupMs = new Date(signupDate).getTime();
  const targetMs = signupMs + targetDays * 24 * 60 * 60 * 1000;
  const windowMs = 24 * 60 * 60 * 1000; // ±1 day

  return activityDates.some((d) => {
    const actMs = new Date(d).getTime();
    return Math.abs(actMs - targetMs) <= windowMs;
  });
}

/**
 * Check if a user was active at any point during a period window.
 * E.g., for "Week 2" (days 8-14), check if any activity in that range.
 */
function wasActiveInPeriod(
  signupDate: string,
  activityDates: string[],
  periodStartDays: number,
  periodEndDays: number
): boolean {
  const signupMs = new Date(signupDate).getTime();
  const startMs = signupMs + periodStartDays * 24 * 60 * 60 * 1000;
  const endMs = signupMs + periodEndDays * 24 * 60 * 60 * 1000;

  return activityDates.some((d) => {
    const actMs = new Date(d).getTime();
    return actMs >= startMs && actMs <= endMs;
  });
}

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Build a cohort retention matrix from user activity data.
 *
 * @param users - Array of user activity records
 * @param granularity - "week" or "month" cohort grouping
 * @returns Cohort matrix with retention percentages
 */
export function buildCohortMatrix(
  users: UserActivity[],
  granularity: "week" | "month" = "month"
): CohortMatrix {
  if (users.length === 0) {
    return {
      granularity,
      periodOffsets: [],
      periodLabels: [],
      cohorts: [],
      totalUsers: 0,
    };
  }

  // Group users by signup period
  const groups = new Map<string, UserActivity[]>();
  for (const user of users) {
    const key = dateToPeriodKey(user.signupDate, granularity);
    const existing = groups.get(key);
    if (existing) {
      existing.push(user);
    } else {
      groups.set(key, [user]);
    }
  }

  // Define retention measurement periods
  const periodOffsets = granularity === "month"
    ? [7, 14, 30, 60, 90, 180]     // days for monthly cohorts
    : [1, 3, 7, 14, 21, 28];        // days for weekly cohorts

  const periodLabels = granularity === "month"
    ? ["Week 1", "Week 2", "Month 1", "Month 2", "Month 3", "Month 6"]
    : ["Day 1", "Day 3", "Week 1", "Week 2", "Week 3", "Week 4"];

  // Build cohort buckets
  const sortedKeys = [...groups.keys()].sort();
  const cohorts: CohortBucket[] = sortedKeys.map((period) => {
    const cohortUsers = groups.get(period) ?? [];
    const size = cohortUsers.length;

    const retainedCounts = periodOffsets.map((days, idx) => {
      const periodEnd = idx < periodOffsets.length - 1 ? periodOffsets[idx + 1] : days + 30;
      return cohortUsers.filter((u) =>
        wasActiveInPeriod(u.signupDate, u.activityDates, days, periodEnd)
      ).length;
    });

    const retentionByPeriod = retainedCounts.map((count) =>
      size > 0 ? Math.round((count / size) * 100 * 10) / 10 : 0
    );

    return { period, size, retentionByPeriod, retainedCounts };
  });

  return {
    granularity,
    periodOffsets,
    periodLabels,
    cohorts,
    totalUsers: users.length,
  };
}

/**
 * Analyze a cohort matrix to identify patterns and suggest interventions.
 *
 * @param matrix - Cohort matrix from buildCohortMatrix
 * @returns Analysis with best/worst cohorts, drop rates, and interventions
 */
export function analyzeCohort(matrix: CohortMatrix): CohortAnalysis {
  if (matrix.cohorts.length === 0) {
    return {
      bestCohort: null,
      worstCohort: null,
      overallRetention: [],
      dropRates: [],
      criticalDropPeriod: 0,
      interventions: [],
      health: "weak",
    };
  }

  // Calculate average retention per cohort
  const cohortAverages = matrix.cohorts.map((c) => ({
    period: c.period,
    avgRetention: c.retentionByPeriod.length > 0
      ? c.retentionByPeriod.reduce((s, v) => s + v, 0) / c.retentionByPeriod.length
      : 0,
  }));

  // Find best/worst
  const sorted = [...cohortAverages].sort((a, b) => b.avgRetention - a.avgRetention);
  const bestCohort = sorted[0] ?? null;
  const worstCohort = sorted[sorted.length - 1] ?? null;

  // Overall retention (weighted average across cohorts)
  const numPeriods = matrix.periodOffsets.length;
  const overallRetention: number[] = [];
  for (let p = 0; p < numPeriods; p++) {
    let totalRetained = 0;
    let totalUsers = 0;
    for (const c of matrix.cohorts) {
      if (p < c.retentionByPeriod.length) {
        totalRetained += c.retainedCounts[p];
        totalUsers += c.size;
      }
    }
    overallRetention.push(totalUsers > 0 ? Math.round((totalRetained / totalUsers) * 100 * 10) / 10 : 0);
  }

  // Drop rates (period-over-period)
  const dropRates: number[] = [];
  for (let i = 1; i < overallRetention.length; i++) {
    const prev = overallRetention[i - 1];
    const curr = overallRetention[i];
    dropRates.push(prev > 0 ? Math.round((prev - curr) * 10) / 10 : 0);
  }

  // Critical drop point (largest drop)
  const criticalDropPeriod = dropRates.length > 0
    ? dropRates.indexOf(Math.max(...dropRates)) + 1
    : 0;

  // Generate interventions
  const interventions: CohortIntervention[] = [];
  const templateKeys = Object.keys(INTERVENTION_TEMPLATES);

  for (let i = 0; i < dropRates.length && i < templateKeys.length; i++) {
    if (dropRates[i] > 15) { // More than 15pp drop
      const template = INTERVENTION_TEMPLATES[templateKeys[i]];
      if (template) {
        interventions.push({
          ...template,
          priority: dropRates[i] > 30 ? "high" : dropRates[i] > 20 ? "medium" : "low",
        });
      }
    }
  }

  // Health assessment based on latest available retention
  const latestRetention = overallRetention.length > 2 ? overallRetention[2] : 0; // ~Month 1
  const health: "strong" | "moderate" | "weak" =
    latestRetention >= RETENTION_THRESHOLDS.strong ? "strong" :
    latestRetention >= RETENTION_THRESHOLDS.moderate ? "moderate" :
    "weak";

  return {
    bestCohort,
    worstCohort,
    overallRetention,
    dropRates,
    criticalDropPeriod,
    interventions,
    health,
  };
}

/**
 * Calculate N-day retention for a specific cohort.
 *
 * @param users - Users in the cohort
 * @param day - Target day (e.g., 7 for D7 retention)
 * @returns Retention percentage (0-100)
 */
export function calculateNDayRetention(
  users: UserActivity[],
  day: number
): number {
  if (users.length === 0) return 0;
  const retained = users.filter((u) =>
    wasActiveAtOffset(u.signupDate, u.activityDates, day)
  ).length;
  return Math.round((retained / users.length) * 100 * 10) / 10;
}

/**
 * Compare two cohort periods side-by-side.
 *
 * @param matrix - Cohort matrix
 * @param periodA - First period to compare
 * @param periodB - Second period to compare
 * @returns Comparison data or null if periods not found
 */
export function compareCohorts(
  matrix: CohortMatrix,
  periodA: string,
  periodB: string
): { periodA: CohortBucket; periodB: CohortBucket; differences: number[] } | null {
  const a = matrix.cohorts.find((c) => c.period === periodA);
  const b = matrix.cohorts.find((c) => c.period === periodB);
  if (!a || !b) return null;

  const maxLen = Math.max(a.retentionByPeriod.length, b.retentionByPeriod.length);
  const differences: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    const retA = a.retentionByPeriod[i] ?? 0;
    const retB = b.retentionByPeriod[i] ?? 0;
    differences.push(Math.round((retA - retB) * 10) / 10);
  }

  return { periodA: a, periodB: b, differences };
}

/**
 * Format cohort matrix as a human-readable string.
 */
export function formatCohortMatrix(matrix: CohortMatrix): string {
  if (matrix.cohorts.length === 0) return "No cohort data available.";

  const lines: string[] = [
    `=== Cohort Retention Matrix (${matrix.granularity}) ===`,
    `Total users: ${matrix.totalUsers}`,
    "",
    `${"Cohort".padEnd(12)} ${"Size".padStart(6)} ${matrix.periodLabels.map((l) => l.padStart(10)).join("")}`,
  ];

  for (const c of matrix.cohorts) {
    const retention = c.retentionByPeriod.map((r) => `${r}%`.padStart(10)).join("");
    lines.push(`${c.period.padEnd(12)} ${String(c.size).padStart(6)} ${retention}`);
  }

  return lines.join("\n");
}
