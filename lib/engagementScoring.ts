/**
 * lib/engagementScoring.ts — Q-122: User engagement scoring
 *
 * Provides a holistic engagement score combining multiple signals:
 * - Training frequency (sessions per month)
 * - Streak consistency (current + longest)
 * - Feature breadth (techniques, competitions, weight tracking)
 * - Recency (days since last training)
 *
 * Used for:
 * - Targeted re-engagement messaging
 * - Admin dashboard user health overview
 * - Conversion optimization (Free→Pro upsell timing)
 *
 * Score range: 0–100 (higher = more engaged)
 */

export interface EngagementInput {
  /** Sessions in the last 30 days */
  sessions30d: number;
  /** Current streak (consecutive days) */
  currentStreak: number;
  /** Longest ever streak */
  longestStreak: number;
  /** Days since last training session */
  daysSinceLastSession: number;
  /** Number of unique techniques logged */
  techniquesCount: number;
  /** Number of competitions logged */
  competitionsCount: number;
  /** Whether user has set a weekly goal */
  hasWeeklyGoal: boolean;
  /** Whether user has enabled push notifications */
  hasPushEnabled: boolean;
  /** Whether user tracks weight */
  tracksWeight: boolean;
  /** Whether user has a profile photo / completed profile */
  profileComplete: boolean;
}

export interface EngagementResult {
  /** Overall score 0–100 */
  score: number;
  /** Human-readable tier */
  tier: "churning" | "at_risk" | "casual" | "engaged" | "champion";
  /** Individual dimension scores (0–100 each) */
  dimensions: {
    frequency: number;
    consistency: number;
    recency: number;
    breadth: number;
    investment: number;
  };
  /** Suggested action for this user */
  suggestedAction: string;
}

/** Weight each dimension contributes to the final score */
const WEIGHTS = {
  frequency: 0.30,
  consistency: 0.20,
  recency: 0.25,
  breadth: 0.15,
  investment: 0.10,
} as const;

/**
 * Calculate a normalized frequency score (0–100).
 * 0 sessions = 0, 12+ sessions/month = 100 (3x/week).
 */
function frequencyScore(sessions30d: number): number {
  return Math.min(100, Math.round((sessions30d / 12) * 100));
}

/**
 * Consistency score based on streak behavior.
 * Current streak matters more than historical longest.
 */
function consistencyScore(currentStreak: number, longestStreak: number): number {
  const currentPart = Math.min(50, Math.round((currentStreak / 7) * 50));
  const longestPart = Math.min(50, Math.round((longestStreak / 30) * 50));
  return currentPart + longestPart;
}

/**
 * Recency score — how recently the user trained.
 * 0 days ago = 100, 30+ days = 0.
 */
function recencyScore(daysSinceLastSession: number): number {
  if (daysSinceLastSession <= 0) return 100;
  if (daysSinceLastSession >= 30) return 0;
  return Math.round(100 * (1 - daysSinceLastSession / 30));
}

/**
 * Feature breadth — how many different features the user leverages.
 */
function breadthScore(techniquesCount: number, competitionsCount: number, tracksWeight: boolean): number {
  let score = 0;
  // Techniques: up to 40 points
  score += Math.min(40, techniquesCount * 4);
  // Competitions: up to 30 points
  score += Math.min(30, competitionsCount * 10);
  // Weight tracking: 30 points
  if (tracksWeight) score += 30;
  return Math.min(100, score);
}

/**
 * Investment — how much the user has invested in setup.
 */
function investmentScore(hasWeeklyGoal: boolean, hasPushEnabled: boolean, profileComplete: boolean): number {
  let score = 0;
  if (hasWeeklyGoal) score += 35;
  if (hasPushEnabled) score += 35;
  if (profileComplete) score += 30;
  return score;
}

/**
 * Determine tier from overall score.
 */
function determineTier(score: number): EngagementResult["tier"] {
  if (score >= 80) return "champion";
  if (score >= 60) return "engaged";
  if (score >= 35) return "casual";
  if (score >= 15) return "at_risk";
  return "churning";
}

/**
 * Suggest the best action for a user based on their engagement profile.
 */
function suggestAction(tier: EngagementResult["tier"], dimensions: EngagementResult["dimensions"]): string {
  if (tier === "churning") {
    return "Send win-back email with personalized training plan suggestion";
  }
  if (tier === "at_risk") {
    if (dimensions.recency < 30) {
      return "Send re-engagement push highlighting streak recovery";
    }
    return "Show achievement progress to motivate return";
  }
  if (tier === "casual") {
    if (dimensions.breadth < 30) {
      return "Introduce underused features (techniques, competitions)";
    }
    if (dimensions.investment < 50) {
      return "Prompt to set weekly goal and enable push notifications";
    }
    return "Encourage consistency with streak challenges";
  }
  if (tier === "engaged") {
    if (dimensions.investment < 70) {
      return "Upsell Pro with personalized benefit pitch";
    }
    return "Celebrate milestones and share social proof";
  }
  // champion
  return "Invite to referral program or beta features";
}

/**
 * Calculate comprehensive engagement score for a user.
 */
export function calculateEngagement(input: EngagementInput): EngagementResult {
  const dimensions = {
    frequency: frequencyScore(input.sessions30d),
    consistency: consistencyScore(input.currentStreak, input.longestStreak),
    recency: recencyScore(input.daysSinceLastSession),
    breadth: breadthScore(input.techniquesCount, input.competitionsCount, input.tracksWeight),
    investment: investmentScore(input.hasWeeklyGoal, input.hasPushEnabled, input.profileComplete),
  };

  const score = Math.round(
    dimensions.frequency * WEIGHTS.frequency +
    dimensions.consistency * WEIGHTS.consistency +
    dimensions.recency * WEIGHTS.recency +
    dimensions.breadth * WEIGHTS.breadth +
    dimensions.investment * WEIGHTS.investment
  );

  const tier = determineTier(score);
  const action = suggestAction(tier, dimensions);

  return {
    score,
    tier,
    dimensions,
    suggestedAction: action,
  };
}

/**
 * Batch score multiple users for admin dashboard sorting.
 */
export function batchEngagementScores(
  users: Array<{ id: string } & EngagementInput>
): Array<{ id: string; engagement: EngagementResult }> {
  return users
    .map((user) => ({
      id: user.id,
      engagement: calculateEngagement(user),
    }))
    .sort((a, b) => b.engagement.score - a.engagement.score);
}
