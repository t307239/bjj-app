/**
 * weightCutPlan.ts — Pure milestone calculation for weight cuts.
 *
 * Extracted from WeightCutPlanner.tsx so the math can be unit-tested
 * independent of React. The component still owns phase advice text +
 * UI rendering; this module owns the maths.
 *
 * Key behavior (verified by tests):
 *  - Weekly milestones are LINEAR INTERPOLATION from current weight
 *    to target weight over the REMAINING weeks.
 *  - On every new weight log (`currentWeight` changes), milestones
 *    recompute against the new starting point + remaining timeline.
 *    This is what makes the "interim target" feel dynamic to the user.
 *  - If already at/below target → no milestones (alreadyDone = true).
 *  - If target date passed → returns null (caller should hide UI).
 */

export type Milestone = {
  weekNum: number;
  date: string; // YYYY-MM-DD
  targetKg: number;
};

export type WeightCutPlan = {
  totalDays: number;
  totalWeeks: number;
  weightDiff: number;
  weeklyRate: number;
  pctCut: number;
  isAggressive: boolean;
  milestones: Milestone[];
  alreadyDone: boolean;
};

/** Returns null when target date has already passed. */
export function computeWeightCutPlan(
  currentWeight: number,
  targetWeight: number,
  targetDateIso: string, // YYYY-MM-DD
  now: Date = new Date(),
): WeightCutPlan | null {
  const compDate = new Date(targetDateIso + "T00:00:00");
  const rawDays = Math.ceil((compDate.getTime() - now.getTime()) / 86_400_000);
  if (rawDays <= 0) return null;

  const totalDays = Math.max(1, rawDays);
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const weightDiff = currentWeight - targetWeight;

  if (weightDiff <= 0) {
    // Already at or below target
    return {
      totalDays,
      totalWeeks,
      weightDiff,
      weeklyRate: 0,
      pctCut: 0,
      isAggressive: false,
      milestones: [],
      alreadyDone: true,
    };
  }

  const weeklyRate = weightDiff / totalWeeks;
  const pctCut = (weightDiff / currentWeight) * 100;
  const isAggressive = weeklyRate > 1.0 || pctCut > 10;

  const milestones: Milestone[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const progress = w / totalWeeks;
    milestones.push({
      weekNum: w,
      date: new Date(now.getTime() + w * 7 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      targetKg: Math.round((currentWeight - weightDiff * progress) * 10) / 10,
    });
  }

  return {
    totalDays,
    totalWeeks,
    weightDiff,
    weeklyRate,
    pctCut,
    isAggressive,
    milestones,
    alreadyDone: false,
  };
}
