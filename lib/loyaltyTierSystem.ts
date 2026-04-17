/**
 * Q-182: Loyalty Tier System (Retention 94→95)
 *
 * Tier-based loyalty program with progression tracking, benefit management,
 * and churn-prevention incentives for SaaS-grade retention.
 */

// ── Types & Constants ──────────────────────────────────────

export interface LoyaltyTier {
  name: string;
  minPoints: number;
  maxPoints: number | null; // null = unlimited
  color: string;
  benefits: string[];
  retentionBonus: number; // multiplier, e.g. 1.2 = 20% bonus
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
  {
    name: "White",
    minPoints: 0,
    maxPoints: 99,
    color: "#E4E4E7", // zinc-200
    benefits: ["Basic features", "Community access"],
    retentionBonus: 1.0,
  },
  {
    name: "Blue",
    minPoints: 100,
    maxPoints: 499,
    color: "#3B82F6", // blue-500
    benefits: ["Priority support", "Monthly insights report"],
    retentionBonus: 1.1,
  },
  {
    name: "Purple",
    minPoints: 500,
    maxPoints: 1499,
    color: "#8B5CF6", // violet-500
    benefits: ["Advanced analytics", "Export data", "Custom goals"],
    retentionBonus: 1.25,
  },
  {
    name: "Brown",
    minPoints: 1500,
    maxPoints: 4999,
    color: "#92400E", // amber-800
    benefits: ["AI Coach premium", "Competition prep", "Video analysis"],
    retentionBonus: 1.5,
  },
  {
    name: "Black",
    minPoints: 5000,
    maxPoints: null,
    color: "#18181B", // zinc-900
    benefits: ["All features", "Beta access", "Dedicated support", "Lifetime discount"],
    retentionBonus: 2.0,
  },
];

export interface LoyaltyProfile {
  userId: string;
  points: number;
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNext: number;
  progressPercent: number;
  memberSinceDays: number;
  streakDays: number;
}

export interface LoyaltyAction {
  action: string;
  points: number;
  description: string;
  cooldownHours?: number;
}

export const LOYALTY_ACTIONS: LoyaltyAction[] = [
  { action: "training_logged", points: 10, description: "Log a training session" },
  { action: "technique_added", points: 5, description: "Add a technique" },
  { action: "goal_completed", points: 25, description: "Complete a goal" },
  { action: "streak_7", points: 50, description: "7-day training streak" },
  { action: "streak_30", points: 200, description: "30-day training streak" },
  { action: "competition_logged", points: 30, description: "Log a competition" },
  { action: "weight_logged", points: 5, description: "Log body weight", cooldownHours: 24 },
  { action: "profile_completed", points: 100, description: "Complete your profile" },
  { action: "referral", points: 500, description: "Refer a new user" },
  { action: "annual_renewal", points: 1000, description: "Renew annual subscription" },
];

// ── Core Functions ─────────────────────────────────────────

/**
 * Get tier for a given point total
 */
export function getTierForPoints(points: number): LoyaltyTier {
  for (let i = LOYALTY_TIERS.length - 1; i >= 0; i--) {
    if (points >= LOYALTY_TIERS[i].minPoints) {
      return LOYALTY_TIERS[i];
    }
  }
  return LOYALTY_TIERS[0];
}

/**
 * Get the next tier above current (null if at max)
 */
export function getNextTier(currentTier: LoyaltyTier): LoyaltyTier | null {
  const idx = LOYALTY_TIERS.findIndex((t) => t.name === currentTier.name);
  if (idx < 0 || idx >= LOYALTY_TIERS.length - 1) return null;
  return LOYALTY_TIERS[idx + 1];
}

/**
 * Calculate progress toward next tier
 */
export function calculateProgress(
  points: number,
  currentTier: LoyaltyTier,
  nextTier: LoyaltyTier | null
): { pointsToNext: number; progressPercent: number } {
  if (!nextTier) return { pointsToNext: 0, progressPercent: 100 };
  const range = nextTier.minPoints - currentTier.minPoints;
  const earned = points - currentTier.minPoints;
  const progressPercent = Math.min(100, Math.round((earned / range) * 100));
  const pointsToNext = Math.max(0, nextTier.minPoints - points);
  return { pointsToNext, progressPercent };
}

/**
 * Build full loyalty profile
 */
export function buildLoyaltyProfile(
  userId: string,
  points: number,
  memberSinceDays: number,
  streakDays: number
): LoyaltyProfile {
  const tier = getTierForPoints(points);
  const nextTier = getNextTier(tier);
  const { pointsToNext, progressPercent } = calculateProgress(points, tier, nextTier);
  return {
    userId,
    points,
    tier,
    nextTier,
    pointsToNext,
    progressPercent,
    memberSinceDays,
    streakDays,
  };
}

/**
 * Calculate points for an action (with cooldown check)
 */
export function calculateActionPoints(
  action: string,
  lastActionTimestamp?: string
): { points: number; eligible: boolean; reason?: string } {
  const actionDef = LOYALTY_ACTIONS.find((a) => a.action === action);
  if (!actionDef) return { points: 0, eligible: false, reason: "Unknown action" };

  if (actionDef.cooldownHours && lastActionTimestamp) {
    const lastTime = new Date(lastActionTimestamp).getTime();
    const now = Date.now();
    const hoursSince = (now - lastTime) / (1000 * 60 * 60);
    if (hoursSince < actionDef.cooldownHours) {
      return {
        points: 0,
        eligible: false,
        reason: `Cooldown: ${Math.ceil(actionDef.cooldownHours - hoursSince)}h remaining`,
      };
    }
  }

  return { points: actionDef.points, eligible: true };
}

/**
 * Suggest retention actions for a profile
 */
export function suggestRetentionActions(
  profile: LoyaltyProfile
): string[] {
  const suggestions: string[] = [];

  if (profile.pointsToNext > 0 && profile.pointsToNext <= 50) {
    suggestions.push(
      `You're only ${profile.pointsToNext} points from ${profile.nextTier?.name} tier!`
    );
  }

  if (profile.streakDays >= 5 && profile.streakDays < 7) {
    suggestions.push("Keep your streak going! 2 more days for a 7-day streak bonus (50 pts)");
  }

  if (profile.streakDays >= 25 && profile.streakDays < 30) {
    suggestions.push("Almost there! Hit 30-day streak for 200 bonus points");
  }

  if (profile.memberSinceDays > 300 && profile.memberSinceDays < 365) {
    suggestions.push("Your annual renewal is coming up — renew for 1,000 bonus points!");
  }

  if (suggestions.length === 0) {
    suggestions.push("Log a training session to earn 10 points");
  }

  return suggestions;
}

/**
 * Format loyalty profile as readable string
 */
export function formatLoyaltyProfile(profile: LoyaltyProfile): string {
  const lines = [
    `# Loyalty Profile`,
    `Tier: ${profile.tier.name} (${profile.points} pts)`,
    profile.nextTier
      ? `Next: ${profile.nextTier.name} — ${profile.pointsToNext} pts away (${profile.progressPercent}%)`
      : "Max tier reached!",
    `Member: ${profile.memberSinceDays} days | Streak: ${profile.streakDays} days`,
    `Benefits: ${profile.tier.benefits.join(", ")}`,
  ];
  return lines.join("\n");
}
