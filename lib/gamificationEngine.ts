/**
 * lib/gamificationEngine.ts — Gamification & badge system utilities
 *
 * Q-146: Retention pillar — provides XP scoring, level calculation,
 * badge/achievement definitions, and progress tracking to increase
 * training motivation and app engagement.
 *
 * Pure utility layer — no DB access, no UI. Consumers pass data in,
 * get computed results back.
 *
 * @example
 *   import { calculateXP, getLevel, checkBadges, BADGES } from "@/lib/gamificationEngine";
 *   const xp = calculateXP({ sessions: 28, streakDays: 7, techniques: 15 });
 *   const level = getLevel(xp);
 *   const earned = checkBadges(stats);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface UserStats {
  /** Total training sessions logged */
  totalSessions: number;
  /** Current streak in days */
  currentStreak: number;
  /** Longest streak ever */
  longestStreak: number;
  /** Unique techniques logged */
  uniqueTechniques: number;
  /** Total mat time in minutes */
  totalMinutes: number;
  /** Competition sessions */
  competitionCount: number;
  /** Days since first session */
  daysSinceFirstSession: number;
  /** Number of training partners logged */
  uniquePartners: number;
}

export interface Badge {
  /** Unique badge ID */
  id: string;
  /** Display name */
  name: string;
  /** Description of how to earn */
  description: string;
  /** Category */
  category: BadgeCategory;
  /** Tier (bronze/silver/gold/platinum) */
  tier: BadgeTier;
  /** XP reward for earning */
  xpReward: number;
  /** Check function — returns true if badge is earned */
  check: (stats: UserStats) => boolean;
}

export type BadgeCategory = "consistency" | "volume" | "technique" | "competition" | "social" | "milestone";
export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

export interface LevelInfo {
  /** Current level number (1-based) */
  level: number;
  /** Level title */
  title: string;
  /** XP at start of current level */
  xpFloor: number;
  /** XP needed for next level */
  xpCeiling: number;
  /** Progress within current level (0-100) */
  progressPercent: number;
  /** Total XP */
  totalXP: number;
}

export interface BadgeProgress {
  /** Badge definition */
  badge: Badge;
  /** Whether earned */
  earned: boolean;
}

export interface GamificationSummary {
  /** Total XP */
  totalXP: number;
  /** Level info */
  level: LevelInfo;
  /** Earned badges */
  earnedBadges: Badge[];
  /** Next closest unearned badges (up to 3) */
  nextBadges: Badge[];
  /** Total badges available */
  totalBadges: number;
}

// ── Constants ────────────────────────────────────────────────────────────

/** XP multipliers for different activities */
export const XP_RATES = {
  /** XP per training session */
  perSession: 100,
  /** XP per day of active streak */
  perStreakDay: 20,
  /** XP per unique technique */
  perTechnique: 50,
  /** XP per competition session */
  perCompetition: 200,
  /** XP per 60 minutes of mat time */
  perHour: 30,
  /** XP per unique training partner */
  perPartner: 25,
} as const;

/** Level thresholds — XP required for each level */
export const LEVEL_THRESHOLDS = [
  0,      // Level 1: White Belt Beginner
  500,    // Level 2
  1200,   // Level 3
  2500,   // Level 4
  4500,   // Level 5
  7500,   // Level 6
  11500,  // Level 7
  17000,  // Level 8
  24000,  // Level 9
  33000,  // Level 10: Black Belt Master
] as const;

/** Level titles */
export const LEVEL_TITLES = [
  "White Belt Beginner",
  "Eager Learner",
  "Mat Regular",
  "Technique Explorer",
  "Dedicated Practitioner",
  "Seasoned Grappler",
  "Advanced Student",
  "Competition Ready",
  "Elite Practitioner",
  "Black Belt Master",
] as const;

// ── Badge Definitions ────────────────────────────────────────────────────

export const BADGES: Badge[] = [
  // Consistency badges
  { id: "streak_7", name: "Week Warrior", description: "7-day training streak", category: "consistency", tier: "bronze", xpReward: 100, check: (s) => s.currentStreak >= 7 || s.longestStreak >= 7 },
  { id: "streak_30", name: "Monthly Machine", description: "30-day training streak", category: "consistency", tier: "silver", xpReward: 300, check: (s) => s.currentStreak >= 30 || s.longestStreak >= 30 },
  { id: "streak_90", name: "Quarter Champion", description: "90-day training streak", category: "consistency", tier: "gold", xpReward: 500, check: (s) => s.currentStreak >= 90 || s.longestStreak >= 90 },
  { id: "streak_365", name: "Year of Iron Will", description: "365-day training streak", category: "consistency", tier: "platinum", xpReward: 1000, check: (s) => s.currentStreak >= 365 || s.longestStreak >= 365 },

  // Volume badges
  { id: "sessions_10", name: "Getting Started", description: "Log 10 sessions", category: "volume", tier: "bronze", xpReward: 50, check: (s) => s.totalSessions >= 10 },
  { id: "sessions_50", name: "Half Century", description: "Log 50 sessions", category: "volume", tier: "silver", xpReward: 200, check: (s) => s.totalSessions >= 50 },
  { id: "sessions_100", name: "Centurion", description: "Log 100 sessions", category: "volume", tier: "gold", xpReward: 400, check: (s) => s.totalSessions >= 100 },
  { id: "sessions_500", name: "Mat Legend", description: "Log 500 sessions", category: "volume", tier: "platinum", xpReward: 800, check: (s) => s.totalSessions >= 500 },

  // Technique badges
  { id: "techniques_5", name: "Curious Mind", description: "Log 5 unique techniques", category: "technique", tier: "bronze", xpReward: 75, check: (s) => s.uniqueTechniques >= 5 },
  { id: "techniques_20", name: "Technique Collector", description: "Log 20 unique techniques", category: "technique", tier: "silver", xpReward: 250, check: (s) => s.uniqueTechniques >= 20 },
  { id: "techniques_50", name: "Encyclopedia", description: "Log 50 unique techniques", category: "technique", tier: "gold", xpReward: 500, check: (s) => s.uniqueTechniques >= 50 },

  // Competition badges
  { id: "comp_1", name: "Competitor", description: "Log first competition", category: "competition", tier: "bronze", xpReward: 150, check: (s) => s.competitionCount >= 1 },
  { id: "comp_5", name: "Tournament Regular", description: "Log 5 competitions", category: "competition", tier: "silver", xpReward: 400, check: (s) => s.competitionCount >= 5 },
  { id: "comp_10", name: "Competition Veteran", description: "Log 10 competitions", category: "competition", tier: "gold", xpReward: 700, check: (s) => s.competitionCount >= 10 },

  // Social badges
  { id: "partners_5", name: "Social Roller", description: "Train with 5 different partners", category: "social", tier: "bronze", xpReward: 100, check: (s) => s.uniquePartners >= 5 },
  { id: "partners_20", name: "Community Pillar", description: "Train with 20 different partners", category: "social", tier: "silver", xpReward: 300, check: (s) => s.uniquePartners >= 20 },

  // Milestone badges
  { id: "hours_100", name: "100 Hour Club", description: "100 hours of mat time", category: "milestone", tier: "gold", xpReward: 500, check: (s) => s.totalMinutes >= 6000 },
  { id: "hours_500", name: "500 Hour Master", description: "500 hours of mat time", category: "milestone", tier: "platinum", xpReward: 1000, check: (s) => s.totalMinutes >= 30000 },
  { id: "year_1", name: "First Anniversary", description: "1 year of training", category: "milestone", tier: "silver", xpReward: 300, check: (s) => s.daysSinceFirstSession >= 365 },
];

// ── XP Calculation ──────────────────────────────────────────────────────

/**
 * Calculate total XP from user stats.
 * Does NOT include badge bonus XP — call addBadgeXP separately.
 */
export function calculateXP(stats: UserStats): number {
  return (
    stats.totalSessions * XP_RATES.perSession +
    stats.longestStreak * XP_RATES.perStreakDay +
    stats.uniqueTechniques * XP_RATES.perTechnique +
    stats.competitionCount * XP_RATES.perCompetition +
    Math.floor(stats.totalMinutes / 60) * XP_RATES.perHour +
    stats.uniquePartners * XP_RATES.perPartner
  );
}

/**
 * Calculate bonus XP from earned badges.
 */
export function calculateBadgeXP(stats: UserStats): number {
  return BADGES.filter((b) => b.check(stats)).reduce((sum, b) => sum + b.xpReward, 0);
}

// ── Level System ────────────────────────────────────────────────────────

/**
 * Get level info from total XP.
 */
export function getLevel(totalXP: number): LevelInfo {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  const maxLevel = LEVEL_THRESHOLDS.length;
  const clampedLevel = Math.min(level, maxLevel);
  const xpFloor = LEVEL_THRESHOLDS[clampedLevel - 1] ?? 0;
  const xpCeiling = clampedLevel < maxLevel
    ? (LEVEL_THRESHOLDS[clampedLevel] ?? xpFloor)
    : xpFloor;

  const range = xpCeiling - xpFloor;
  const progressPercent = range > 0
    ? Math.min(100, Math.round(((totalXP - xpFloor) / range) * 100))
    : 100;

  return {
    level: clampedLevel,
    title: LEVEL_TITLES[clampedLevel - 1] ?? LEVEL_TITLES[LEVEL_TITLES.length - 1],
    xpFloor,
    xpCeiling,
    progressPercent,
    totalXP,
  };
}

// ── Badge Checking ──────────────────────────────────────────────────────

/**
 * Check which badges a user has earned.
 */
export function checkBadges(stats: UserStats): BadgeProgress[] {
  return BADGES.map((badge) => ({
    badge,
    earned: badge.check(stats),
  }));
}

/**
 * Get only earned badges.
 */
export function getEarnedBadges(stats: UserStats): Badge[] {
  return BADGES.filter((b) => b.check(stats));
}

/**
 * Get next closest unearned badges (for motivation).
 * Returns up to `limit` badges sorted by tier (easiest first).
 */
export function getNextBadges(stats: UserStats, limit: number = 3): Badge[] {
  const tierOrder: Record<BadgeTier, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
  return BADGES
    .filter((b) => !b.check(stats))
    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier])
    .slice(0, limit);
}

// ── Summary ─────────────────────────────────────────────────────────────

/**
 * Build a complete gamification summary for a user.
 */
export function buildGamificationSummary(stats: UserStats): GamificationSummary {
  const baseXP = calculateXP(stats);
  const badgeXP = calculateBadgeXP(stats);
  const totalXP = baseXP + badgeXP;
  const level = getLevel(totalXP);
  const earnedBadges = getEarnedBadges(stats);
  const nextBadges = getNextBadges(stats, 3);

  return {
    totalXP,
    level,
    earnedBadges,
    nextBadges,
    totalBadges: BADGES.length,
  };
}

/**
 * Format a gamification summary as a human-readable string.
 */
export function formatGamificationSummary(summary: GamificationSummary): string {
  return [
    `Level ${summary.level.level}: ${summary.level.title} (${summary.totalXP} XP)`,
    `Badges: ${summary.earnedBadges.length}/${summary.totalBadges}`,
    `Progress: ${summary.level.progressPercent}% to next level`,
  ].join(" | ");
}
