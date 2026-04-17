/**
 * lib/streakUtils.ts — Streak calculation utilities with grace period support
 *
 * Q-115: Retention pillar — streak grace period + comeback detection.
 *
 * Grace period: If a user misses exactly 1 day but trained the day before
 * and after, the streak is preserved (Pro feature via streak_shields).
 *
 * Comeback detection: Identifies users returning after 7+ day absence
 * to trigger celebration UI.
 *
 * @example
 *   import { calcStreak, detectComeback } from "@/lib/streakUtils";
 *   const streak = calcStreak(logDates, today);
 *   const comeback = detectComeback(logDates, today);
 */

/**
 * Calculate current training streak from sorted log dates.
 * Counts consecutive days backward from `logicalToday`.
 *
 * @param recentLogDates - Array of date strings (YYYY-MM-DD), may contain duplicates
 * @param logicalToday - The logical "today" date (YYYY-MM-DD), accounting for -4h shift
 * @returns Current streak count (0 if no logs match today)
 */
export function calcStreak(recentLogDates: string[], logicalToday: string): number {
  if (recentLogDates.length === 0) return 0;
  const uniqueDates = [...new Set(recentLogDates)].sort().reverse();
  let checkDateMs = new Date(logicalToday + "T00:00:00Z").getTime();
  let streak = 0;
  for (const dateStr of uniqueDates) {
    const check = new Date(checkDateMs).toISOString().slice(0, 10);
    if (dateStr === check) {
      streak++;
      checkDateMs -= 86400000;
    } else if (dateStr < check) {
      break;
    }
  }
  return streak;
}

/**
 * Calculate streak with 1-day grace period (Pro feature).
 * If a single day is missed between two training days, the streak continues.
 *
 * @param recentLogDates - Array of date strings (YYYY-MM-DD)
 * @param logicalToday - The logical "today" date (YYYY-MM-DD)
 * @param graceDays - Number of grace days allowed (default: 1, max: 2)
 * @returns Streak count with grace applied
 */
export function calcStreakWithGrace(
  recentLogDates: string[],
  logicalToday: string,
  graceDays: number = 1
): number {
  if (recentLogDates.length === 0) return 0;
  const clampedGrace = Math.min(Math.max(graceDays, 0), 2);
  const uniqueDates = new Set(recentLogDates);
  const sortedDates = [...uniqueDates].sort().reverse();

  let checkDateMs = new Date(logicalToday + "T00:00:00Z").getTime();
  let streak = 0;
  let missedConsecutive = 0;

  // Start from today and walk backward
  const oldestDate = sortedDates[sortedDates.length - 1];
  const oldestMs = new Date(oldestDate + "T00:00:00Z").getTime();

  while (checkDateMs >= oldestMs) {
    const checkDate = new Date(checkDateMs).toISOString().slice(0, 10);

    if (uniqueDates.has(checkDate)) {
      streak++;
      missedConsecutive = 0;
    } else {
      missedConsecutive++;
      if (missedConsecutive > clampedGrace) break;
    }

    checkDateMs -= 86400000;
  }

  return streak;
}

/**
 * Detect if user is making a comeback after a break.
 *
 * @param recentLogDates - Array of date strings (YYYY-MM-DD)
 * @param logicalToday - The logical "today" date
 * @returns Object with comeback info, or null if no comeback
 */
export function detectComeback(
  recentLogDates: string[],
  logicalToday: string
): { daysAway: number; previousStreak: number } | null {
  if (recentLogDates.length === 0) return null;

  const uniqueDates = [...new Set(recentLogDates)].sort().reverse();

  // Check if user trained today
  if (uniqueDates[0] !== logicalToday) return null;

  // Find the gap before today's session
  if (uniqueDates.length < 2) return null;

  const todayMs = new Date(logicalToday + "T00:00:00Z").getTime();
  const prevSessionMs = new Date(uniqueDates[1] + "T00:00:00Z").getTime();
  const daysAway = Math.round((todayMs - prevSessionMs) / 86400000);

  // Only trigger comeback for 7+ day absence
  if (daysAway < 7) return null;

  // Calculate what their streak was before the break
  const previousStreak = calcStreak(
    uniqueDates.slice(1),
    uniqueDates[1]
  );

  return { daysAway, previousStreak };
}

/**
 * Classify user engagement level based on recent training frequency.
 *
 * @param sessionsLast30Days - Number of sessions in last 30 days
 * @returns Engagement level category
 */
export function classifyEngagement(sessionsLast30Days: number): "inactive" | "casual" | "regular" | "dedicated" | "elite" {
  if (sessionsLast30Days === 0) return "inactive";
  if (sessionsLast30Days <= 4) return "casual";      // ~1x/week
  if (sessionsLast30Days <= 12) return "regular";     // ~3x/week
  if (sessionsLast30Days <= 20) return "dedicated";   // ~5x/week
  return "elite";                                      // 5+/week
}
