/**
 * lib/adminMetrics.ts — Q-127: Admin metrics aggregation
 *
 * Pure utility functions for computing admin dashboard metrics.
 * Separates business logic from API route handlers.
 */

export interface BeltDistribution {
  white: number;
  blue: number;
  purple: number;
  brown: number;
  black: number;
}

export interface PlatformMetrics {
  total_users: number;
  pro_users: number;
  free_users: number;
  pro_rate_percent: number;
  belt_distribution: BeltDistribution;
  active_users_7d: number;
  active_users_30d: number;
  total_sessions: number;
  avg_sessions_per_user_30d: number;
  push_subscribers: number;
}

/**
 * Calculate belt distribution from profile records.
 */
export function calcBeltDistribution(
  profiles: Array<{ belt: string }>
): BeltDistribution {
  const dist: BeltDistribution = { white: 0, blue: 0, purple: 0, brown: 0, black: 0 };
  for (const p of profiles) {
    const belt = p.belt?.toLowerCase() ?? "white";
    if (belt in dist) {
      dist[belt as keyof BeltDistribution] += 1;
    } else {
      dist.white += 1; // default to white for unknown values
    }
  }
  return dist;
}

/**
 * Calculate Pro conversion rate.
 */
export function calcProRate(totalUsers: number, proUsers: number): number {
  if (totalUsers === 0) return 0;
  return Math.round((proUsers / totalUsers) * 1000) / 10; // 1 decimal
}

/**
 * Count unique active users from training log dates.
 * @param logs - Array of { user_id, date } records
 * @param days - Lookback period in days
 */
export function countActiveUsers(
  logs: Array<{ user_id: string; date: string }>,
  days: number
): number {
  const cutoff = new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];
  const uniqueUsers = new Set<string>();
  for (const log of logs) {
    if (log.date >= cutoff) {
      uniqueUsers.add(log.user_id);
    }
  }
  return uniqueUsers.size;
}

/**
 * Calculate average sessions per user in a period.
 */
export function calcAvgSessionsPerUser(
  totalSessions: number,
  activeUsers: number
): number {
  if (activeUsers === 0) return 0;
  return Math.round((totalSessions / activeUsers) * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────
// z255kk: PMF metrics — D7 retention / signup velocity / source attribution
// 「アプリの品質を磨いた結果ユーザーは増えてるか?」を初めて測れる装置
// ─────────────────────────────────────────────────────────────────

export interface SignupCohort {
  user_id: string;
  created_at: string; // ISO timestamp
  signup_source?: string | null;
  paid_ref?: string | null;
}

export interface PmfMetrics {
  /** signups in last 7 / 30 / 90 days */
  signups_last_7d: number;
  signups_last_30d: number;
  signups_last_90d: number;
  /** week-over-week change (last 7d vs prev 7d) */
  signup_wow_percent: number;
  /** D7 retention: of users who signed up 7-30 days ago, what % had a training_log within 7 days of signup */
  d7_retention_percent: number;
  d7_retention_cohort_size: number;
  /** Signup source breakdown for last 90 days */
  source_breakdown: Record<string, number>;
  /** Weekly active users trend — last 4 weeks (oldest first, current last) */
  weekly_active_trend: number[];
}

/**
 * Count signups within last N days.
 */
export function countSignupsLastDays(
  cohorts: SignupCohort[],
  days: number,
  now: Date = new Date()
): number {
  const cutoff = now.getTime() - days * 86400000;
  return cohorts.filter((c) => new Date(c.created_at).getTime() >= cutoff).length;
}

/**
 * Calculate week-over-week signup change %.
 * Returns 0 if previous week had 0 (avoid Infinity).
 */
export function calcSignupWow(
  cohorts: SignupCohort[],
  now: Date = new Date()
): number {
  const last7 = countSignupsLastDays(cohorts, 7, now);
  const prev7 = cohorts.filter((c) => {
    const t = new Date(c.created_at).getTime();
    const nowT = now.getTime();
    return t >= nowT - 14 * 86400000 && t < nowT - 7 * 86400000;
  }).length;
  if (prev7 === 0) return last7 > 0 ? 100 : 0;
  return Math.round(((last7 - prev7) / prev7) * 1000) / 10;
}

/**
 * D7 retention: of users who signed up 7-30 days ago, what % had a training_log
 * within 7 days of their signup date.
 *
 * @param cohorts - Users who signed up (with created_at)
 * @param logs - Training logs (with user_id and date)
 */
export function calcD7Retention(
  cohorts: SignupCohort[],
  logs: Array<{ user_id: string; date: string }>,
  now: Date = new Date()
): { percent: number; cohort_size: number } {
  const nowT = now.getTime();
  const eligibleCohort = cohorts.filter((c) => {
    const t = new Date(c.created_at).getTime();
    return t >= nowT - 30 * 86400000 && t <= nowT - 7 * 86400000;
  });
  if (eligibleCohort.length === 0) return { percent: 0, cohort_size: 0 };

  // Index logs by user_id with their dates
  const logsByUser = new Map<string, string[]>();
  for (const l of logs) {
    if (!logsByUser.has(l.user_id)) logsByUser.set(l.user_id, []);
    logsByUser.get(l.user_id)!.push(l.date);
  }

  let retained = 0;
  for (const c of eligibleCohort) {
    const userLogs = logsByUser.get(c.user_id) ?? [];
    const signupT = new Date(c.created_at).getTime();
    const d7End = signupT + 7 * 86400000;
    // Has any log within first 7 days post signup?
    const hasD7Log = userLogs.some((d) => {
      const lt = new Date(d).getTime();
      return lt >= signupT && lt <= d7End;
    });
    if (hasD7Log) retained++;
  }
  return {
    percent: Math.round((retained / eligibleCohort.length) * 1000) / 10,
    cohort_size: eligibleCohort.length,
  };
}

/**
 * Source breakdown: count signups per signup_source / paid_ref (last 90 days).
 */
export function calcSourceBreakdown(
  cohorts: SignupCohort[],
  now: Date = new Date()
): Record<string, number> {
  const cutoff = now.getTime() - 90 * 86400000;
  const breakdown: Record<string, number> = {};
  for (const c of cohorts) {
    if (new Date(c.created_at).getTime() < cutoff) continue;
    const source = c.signup_source || c.paid_ref || "direct";
    breakdown[source] = (breakdown[source] || 0) + 1;
  }
  return breakdown;
}

/**
 * Weekly active users for last 4 weeks (week 0 = oldest, week 3 = current).
 * Each value = unique user_id count with a log in that week.
 */
export function calcWeeklyActiveTrend(
  logs: Array<{ user_id: string; date: string }>,
  now: Date = new Date()
): number[] {
  const trend: number[] = [];
  for (let weekOffset = 3; weekOffset >= 0; weekOffset--) {
    const weekEnd = new Date(now.getTime() - weekOffset * 7 * 86400000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
    const startStr = weekStart.toISOString().split("T")[0];
    const endStr = weekEnd.toISOString().split("T")[0];
    const users = new Set<string>();
    for (const l of logs) {
      if (l.date >= startStr && l.date < endStr) users.add(l.user_id);
    }
    trend.push(users.size);
  }
  return trend;
}
