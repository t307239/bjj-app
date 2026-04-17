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
