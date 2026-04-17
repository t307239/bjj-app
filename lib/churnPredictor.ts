/**
 * lib/churnPredictor.ts — Q-132: Churn prediction & win-back utility
 *
 * Uses engagement scoring data to predict churn risk and suggest
 * targeted win-back actions. Builds on engagementScoring.ts (Q-122).
 *
 * Usage:
 *   import { predictChurnRisk, suggestWinBackAction, ChurnRisk } from "@/lib/churnPredictor";
 */

import type { EngagementResult } from "./engagementScoring";

export type ChurnRisk = "low" | "medium" | "high" | "critical";

export interface ChurnPrediction {
  risk: ChurnRisk;
  riskScore: number; // 0-100 (higher = more likely to churn)
  factors: string[];
  daysUntilLikelyChurn: number | null;
  suggestedAction: string;
  actionPriority: "immediate" | "soon" | "routine" | "none";
}

export interface WinBackAction {
  type: "push" | "email" | "in_app" | "none";
  message: string;
  urgency: "high" | "medium" | "low";
  cooldownDays: number;
}

/**
 * Predict churn risk based on engagement data.
 *
 * Risk factors:
 * - Low recency (haven't trained recently)
 * - Declining frequency (fewer sessions than before)
 * - Low investment (no weekly goal, no push, incomplete profile)
 * - Short streak (low consistency)
 */
export function predictChurnRisk(
  engagement: EngagementResult,
  daysSinceLastSession: number
): ChurnPrediction {
  const factors: string[] = [];
  let riskScore = 0;

  // Factor 1: Recency (strongest predictor)
  if (daysSinceLastSession >= 14) {
    riskScore += 40;
    factors.push("14日以上練習なし");
  } else if (daysSinceLastSession >= 7) {
    riskScore += 25;
    factors.push("7日以上練習なし");
  } else if (daysSinceLastSession >= 3) {
    riskScore += 10;
    factors.push("3日以上練習なし");
  }

  // Factor 2: Engagement tier
  if (engagement.tier === "churning") {
    riskScore += 30;
    factors.push("エンゲージメントスコアが非常に低い");
  } else if (engagement.tier === "at_risk") {
    riskScore += 20;
    factors.push("エンゲージメントスコアが低下傾向");
  } else if (engagement.tier === "casual") {
    riskScore += 5;
  }

  // Factor 3: Investment (push, goals, profile)
  if (engagement.dimensions.investment < 33) {
    riskScore += 15;
    factors.push("プッシュ通知/週間目標/プロフィール未設定");
  }

  // Factor 4: Consistency
  if (engagement.dimensions.consistency < 20) {
    riskScore += 10;
    factors.push("練習の一貫性が低い");
  }

  // Factor 5: Breadth
  if (engagement.dimensions.breadth < 20) {
    riskScore += 5;
    factors.push("テクニック/大会の活用が少ない");
  }

  // Cap at 100
  riskScore = Math.min(100, riskScore);

  // Determine risk level
  let risk: ChurnRisk;
  if (riskScore >= 70) risk = "critical";
  else if (riskScore >= 45) risk = "high";
  else if (riskScore >= 20) risk = "medium";
  else risk = "low";

  // Estimate days until likely churn
  let daysUntilLikelyChurn: number | null = null;
  if (risk === "critical") daysUntilLikelyChurn = 3;
  else if (risk === "high") daysUntilLikelyChurn = 7;
  else if (risk === "medium") daysUntilLikelyChurn = 14;

  // Suggest action
  const suggestedAction = getSuggestedAction(risk, factors);
  const actionPriority = risk === "critical" ? "immediate"
    : risk === "high" ? "soon"
    : risk === "medium" ? "routine"
    : "none";

  return {
    risk,
    riskScore,
    factors,
    daysUntilLikelyChurn,
    suggestedAction,
    actionPriority,
  };
}

function getSuggestedAction(risk: ChurnRisk, factors: string[]): string {
  if (risk === "critical") {
    return "即座に再エンゲージメントPush + パーソナライズメール送信";
  }
  if (risk === "high") {
    if (factors.some((f) => f.includes("プッシュ通知"))) {
      return "プッシュ通知の有効化を促すアプリ内メッセージ表示";
    }
    return "週間目標のリマインダーPush送信";
  }
  if (risk === "medium") {
    return "新テクニック提案やマイルストーン進捗のハイライト表示";
  }
  return "通常のエンゲージメント施策を継続";
}

/**
 * Suggest a specific win-back action based on churn prediction.
 */
export function suggestWinBackAction(prediction: ChurnPrediction): WinBackAction {
  if (prediction.risk === "critical") {
    return {
      type: "push",
      message: "久しぶりの練習はいかがですか？あなたのストリークを再開しましょう 💪",
      urgency: "high",
      cooldownDays: 2,
    };
  }
  if (prediction.risk === "high") {
    return {
      type: "push",
      message: "今週の目標まであと少し！マットに戻りましょう 🥋",
      urgency: "medium",
      cooldownDays: 3,
    };
  }
  if (prediction.risk === "medium") {
    return {
      type: "in_app",
      message: "新しいテクニックを試してみませんか？",
      urgency: "low",
      cooldownDays: 7,
    };
  }
  return {
    type: "none",
    message: "",
    urgency: "low",
    cooldownDays: 0,
  };
}

/**
 * Batch process users and sort by churn risk (highest first).
 */
export function batchChurnPredictions(
  users: Array<{
    id: string;
    engagement: EngagementResult;
    daysSinceLastSession: number;
  }>
): Array<{ id: string; prediction: ChurnPrediction }> {
  return users
    .map((u) => ({
      id: u.id,
      prediction: predictChurnRisk(u.engagement, u.daysSinceLastSession),
    }))
    .sort((a, b) => b.prediction.riskScore - a.prediction.riskScore);
}
