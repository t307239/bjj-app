/**
 * Q-225: Retention Intervention Engine — automated retention action triggers
 *
 * Determines optimal timing and type of retention interventions
 * based on user behavior patterns. Complements churnPredictor.ts
 * (risk scoring) with actionable intervention orchestration.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InterventionType =
  | "push_reminder"
  | "email_recap"
  | "in_app_prompt"
  | "streak_rescue"
  | "milestone_celebration"
  | "feature_discovery"
  | "social_proof"
  | "goal_nudge";

export type InterventionPriority = "low" | "medium" | "high" | "urgent";

export interface UserBehavior {
  daysSinceLastSession: number;
  sessionsLast7d: number;
  sessionsLast30d: number;
  currentStreak: number;
  longestStreak: number;
  totalSessions: number;
  pushEnabled: boolean;
  emailEnabled: boolean;
  lastInterventionDaysAgo: number;
  interventionResponseRate: number; // 0-1
}

export interface Intervention {
  type: InterventionType;
  priority: InterventionPriority;
  channel: "push" | "email" | "in_app";
  message: string;
  /** Recommended delay before sending (hours) */
  delayHours: number;
  /** Why this intervention was chosen */
  reason: string;
  /** Confidence score 0-1 */
  confidence: number;
}

export interface InterventionPlan {
  userId: string;
  interventions: Intervention[];
  /** Next check time */
  nextCheckHours: number;
  /** Whether to suppress (fatigue prevention) */
  suppressed: boolean;
  suppressReason?: string;
}

export interface InterventionAudit {
  totalUsersAnalyzed: number;
  interventionsGenerated: number;
  suppressed: number;
  byType: Record<InterventionType, number>;
  byPriority: Record<InterventionPriority, number>;
  avgConfidence: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_INTERVENTION_GAP_DAYS = 2;
const MAX_INTERVENTIONS_PER_WEEK = 3;
const FATIGUE_RESPONSE_THRESHOLD = 0.1; // Below 10% response = suppressed

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Determine interventions for a user based on their behavior.
 */
export function planInterventions(
  userId: string,
  behavior: UserBehavior
): InterventionPlan {
  // Fatigue check
  if (
    behavior.lastInterventionDaysAgo < MIN_INTERVENTION_GAP_DAYS
  ) {
    return {
      userId,
      interventions: [],
      nextCheckHours: (MIN_INTERVENTION_GAP_DAYS - behavior.lastInterventionDaysAgo) * 24,
      suppressed: true,
      suppressReason: "Too soon since last intervention",
    };
  }

  if (behavior.interventionResponseRate < FATIGUE_RESPONSE_THRESHOLD &&
      behavior.lastInterventionDaysAgo < 14) {
    return {
      userId,
      interventions: [],
      nextCheckHours: 168, // 1 week
      suppressed: true,
      suppressReason: "Low response rate — fatigue prevention",
    };
  }

  const interventions: Intervention[] = [];

  // Streak rescue (about to lose streak)
  if (behavior.currentStreak >= 3 && behavior.daysSinceLastSession >= 1) {
    interventions.push({
      type: "streak_rescue",
      priority: "urgent",
      channel: behavior.pushEnabled ? "push" : "in_app",
      message: `${behavior.currentStreak}日連続記録を守ろう！今日練習を記録しよう`,
      delayHours: 0,
      reason: `Streak ${behavior.currentStreak} at risk (${behavior.daysSinceLastSession}d inactive)`,
      confidence: 0.9,
    });
  }

  // Milestone celebration
  const milestones = [10, 25, 50, 100, 200, 500, 1000];
  for (const m of milestones) {
    if (behavior.totalSessions === m) {
      interventions.push({
        type: "milestone_celebration",
        priority: "high",
        channel: behavior.pushEnabled ? "push" : "in_app",
        message: `${m}回の練習達成おめでとう！`,
        delayHours: 0,
        reason: `Reached ${m} sessions milestone`,
        confidence: 1.0,
      });
      break;
    }
  }

  // Re-engagement based on inactivity
  if (behavior.daysSinceLastSession >= 3 && behavior.daysSinceLastSession < 7) {
    interventions.push({
      type: "push_reminder",
      priority: "medium",
      channel: behavior.pushEnabled ? "push" : "in_app",
      message: "最近練習してないみたい。今週の目標を確認しよう",
      delayHours: 2,
      reason: `${behavior.daysSinceLastSession} days inactive`,
      confidence: 0.7,
    });
  }

  if (behavior.daysSinceLastSession >= 7 && behavior.daysSinceLastSession < 14) {
    interventions.push({
      type: "email_recap",
      priority: "high",
      channel: behavior.emailEnabled ? "email" : "in_app",
      message: "練習まとめを見て、次の練習計画を立てよう",
      delayHours: 4,
      reason: `${behavior.daysSinceLastSession} days inactive — email recap`,
      confidence: 0.6,
    });
  }

  if (behavior.daysSinceLastSession >= 14) {
    interventions.push({
      type: "social_proof",
      priority: "urgent",
      channel: behavior.emailEnabled ? "email" : "in_app",
      message: "他のユーザーは今週平均3回練習しています。一緒に始めよう！",
      delayHours: 0,
      reason: `${behavior.daysSinceLastSession} days inactive — win-back with social proof`,
      confidence: 0.5,
    });
  }

  // Goal nudge for users without weekly goals
  if (behavior.sessionsLast7d === 0 && behavior.sessionsLast30d > 0) {
    interventions.push({
      type: "goal_nudge",
      priority: "low",
      channel: "in_app",
      message: "今週の目標を設定して練習を習慣化しよう",
      delayHours: 24,
      reason: "Active last month but no sessions this week",
      confidence: 0.6,
    });
  }

  // Limit interventions
  const limited = interventions
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))
    .slice(0, MAX_INTERVENTIONS_PER_WEEK);

  return {
    userId,
    interventions: limited,
    nextCheckHours: 24,
    suppressed: false,
  };
}

/**
 * Build an audit report from multiple intervention plans.
 */
export function buildInterventionAudit(
  plans: InterventionPlan[]
): InterventionAudit {
  const byType: Record<InterventionType, number> = {
    push_reminder: 0,
    email_recap: 0,
    in_app_prompt: 0,
    streak_rescue: 0,
    milestone_celebration: 0,
    feature_discovery: 0,
    social_proof: 0,
    goal_nudge: 0,
  };

  const byPriority: Record<InterventionPriority, number> = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  };

  let totalConfidence = 0;
  let totalInterventions = 0;

  for (const plan of plans) {
    for (const i of plan.interventions) {
      byType[i.type]++;
      byPriority[i.priority]++;
      totalConfidence += i.confidence;
      totalInterventions++;
    }
  }

  return {
    totalUsersAnalyzed: plans.length,
    interventionsGenerated: totalInterventions,
    suppressed: plans.filter((p) => p.suppressed).length,
    byType,
    byPriority,
    avgConfidence:
      totalInterventions > 0 ? totalConfidence / totalInterventions : 0,
  };
}

/**
 * Format intervention plan as human-readable string.
 */
export function formatInterventionPlan(plan: InterventionPlan): string {
  const lines = [
    `User: ${plan.userId}`,
    `Suppressed: ${plan.suppressed ? `YES (${plan.suppressReason})` : "NO"}`,
    `Next check: ${plan.nextCheckHours}h`,
  ];

  if (plan.interventions.length > 0) {
    lines.push("", "Interventions:");
    for (const i of plan.interventions) {
      lines.push(
        `  [${i.priority}] ${i.type} via ${i.channel} (${Math.round(i.confidence * 100)}%)`
      );
      lines.push(`    ${i.reason}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityWeight(p: InterventionPriority): number {
  switch (p) {
    case "urgent": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
  }
}
