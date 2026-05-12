/**
 * Unit tests for computeWeightCutPlan() — the pure milestone calculation
 * that powers WeightCutPlanner's dynamic interim targets.
 *
 * Key scenarios:
 *  1. Initial plan: produces evenly-spaced weekly milestones.
 *  2. Dynamic re-calc: after a new weight log, milestones recompute from
 *     the new starting weight + remaining timeline (THIS is the behavior
 *     Toshiki requested — interim targets must feel dynamic).
 *  3. Already at target: alreadyDone=true, no milestones.
 *  4. Past comp date: returns null (caller hides UI).
 *  5. Aggressive cut detection: weeklyRate > 1kg or pctCut > 10%.
 */
import { describe, it, expect } from "vitest";
import { computeWeightCutPlan } from "@/lib/weightCutPlan";

// Helper: construct a "now" date in local time (matches how new Date(iso)
// parses iso strings without timezone suffix in modern JS engines).
const localDate = (iso: string) => new Date(iso + "T00:00:00");

// ─── 1. Initial plan ────────────────────────────────────────────────────────
describe("computeWeightCutPlan — initial plan", () => {
  it("produces 4 evenly-spaced weekly milestones over 28 days", () => {
    const plan = computeWeightCutPlan(
      75, // current
      73, // target
      "2026-06-09", // 28 days out
      localDate("2026-05-12"),
    );
    expect(plan).not.toBeNull();
    expect(plan!.totalDays).toBe(28);
    expect(plan!.totalWeeks).toBe(4);
    expect(plan!.weightDiff).toBeCloseTo(2.0, 5);
    expect(plan!.weeklyRate).toBeCloseTo(0.5, 5);
    expect(plan!.pctCut).toBeCloseTo(2.667, 2);
    expect(plan!.isAggressive).toBe(false);
    expect(plan!.alreadyDone).toBe(false);

    // Milestones: linear interp 75 → 73 over 4 weeks → 74.5, 74.0, 73.5, 73.0
    expect(plan!.milestones).toHaveLength(4);
    expect(plan!.milestones.map((m) => m.targetKg)).toEqual([
      74.5, 74.0, 73.5, 73.0,
    ]);
    expect(plan!.milestones.map((m) => m.weekNum)).toEqual([1, 2, 3, 4]);
  });

  it("rounds milestones to 1 decimal place", () => {
    const plan = computeWeightCutPlan(
      80.3,
      77.8,
      "2026-06-09",
      localDate("2026-05-12"),
    );
    expect(plan).not.toBeNull();
    // 80.3 → 77.8 over 4 weeks = 0.625 / week
    // w1: 80.3 - 0.625 = 79.675 → round → 79.7
    // w2: 80.3 - 1.25  = 79.05  → round → 79.1 (actually 79.05 rounds to 79.1 with *10 trick)
    // w3: 80.3 - 1.875 = 78.425 → round → 78.4
    // w4: 80.3 - 2.5   = 77.8   → 77.8
    const kgs = plan!.milestones.map((m) => m.targetKg);
    kgs.forEach((kg) => {
      // assert "1 decimal place" by checking *10 is integer
      expect(Math.round(kg * 10)).toBeCloseTo(kg * 10, 5);
    });
  });
});

// ─── 2. Dynamic re-calc (the requested behavior) ────────────────────────────
describe("computeWeightCutPlan — dynamic re-calc on new weight log", () => {
  it("produces DIFFERENT milestones when current weight changes mid-cut", () => {
    // Initial plan at day 0
    const initial = computeWeightCutPlan(
      75,
      73,
      "2026-06-09",
      localDate("2026-05-12"),
    );
    // Expected initial: 74.5, 74.0, 73.5, 73.0
    expect(initial!.milestones.map((m) => m.targetKg)).toEqual([
      74.5, 74.0, 73.5, 73.0,
    ]);

    // 7 days in, user weighs in at 74.7 (only lost 0.3kg, behind schedule)
    // → re-call with new currentWeight + new now date
    const after1Week = computeWeightCutPlan(
      74.7,
      73,
      "2026-06-09",
      localDate("2026-05-19"),
    );
    expect(after1Week).not.toBeNull();
    expect(after1Week!.totalDays).toBe(21);
    expect(after1Week!.totalWeeks).toBe(3);
    expect(after1Week!.weightDiff).toBeCloseTo(1.7, 5);

    // New milestones must recompute from 74.7 over remaining 3 weeks
    // w1: 74.7 - 1.7/3      = 74.133... → 74.1
    // w2: 74.7 - 2*(1.7/3)  = 73.566... → 73.6
    // w3: 74.7 - 1.7        = 73.0
    expect(after1Week!.milestones.map((m) => m.targetKg)).toEqual([
      74.1, 73.6, 73.0,
    ]);

    // Sanity: milestones differ from initial → user sees a fresh interim target
    expect(after1Week!.milestones[0].targetKg).not.toEqual(
      initial!.milestones[0].targetKg,
    );
  });

  it("re-computes when user is AHEAD of schedule (lost more weight)", () => {
    // 7 days in, user already at 73.5 (lost 1.5kg — ahead of pace)
    const ahead = computeWeightCutPlan(
      73.5,
      73,
      "2026-06-09",
      localDate("2026-05-19"),
    );
    expect(ahead!.weightDiff).toBeCloseTo(0.5, 5);
    expect(ahead!.weeklyRate).toBeCloseTo(0.5 / 3, 3);
    // Gentle slope: 73.5 → 73.3 → 73.2 → 73.0
    expect(ahead!.milestones.map((m) => m.targetKg)).toEqual([
      73.3, 73.2, 73.0,
    ]);
  });
});

// ─── 3. Already at target ───────────────────────────────────────────────────
describe("computeWeightCutPlan — already at or below target", () => {
  it("returns alreadyDone=true with no milestones when at target", () => {
    const plan = computeWeightCutPlan(
      73,
      73,
      "2026-06-09",
      localDate("2026-05-12"),
    );
    expect(plan).not.toBeNull();
    expect(plan!.alreadyDone).toBe(true);
    expect(plan!.milestones).toHaveLength(0);
    expect(plan!.weeklyRate).toBe(0);
    expect(plan!.isAggressive).toBe(false);
  });

  it("returns alreadyDone=true when user is already BELOW target", () => {
    const plan = computeWeightCutPlan(
      71,
      73,
      "2026-06-09",
      localDate("2026-05-12"),
    );
    expect(plan!.alreadyDone).toBe(true);
    expect(plan!.weightDiff).toBe(-2);
    expect(plan!.milestones).toHaveLength(0);
  });
});

// ─── 4. Past competition date ───────────────────────────────────────────────
describe("computeWeightCutPlan — past competition date", () => {
  it("returns null when targetDate is in the past", () => {
    const plan = computeWeightCutPlan(
      75,
      73,
      "2026-05-01", // 11 days ago
      localDate("2026-05-12"),
    );
    expect(plan).toBeNull();
  });

  it("returns null when targetDate is today (compDate <= now)", () => {
    const plan = computeWeightCutPlan(
      75,
      73,
      "2026-05-12",
      localDate("2026-05-12"),
    );
    expect(plan).toBeNull();
  });
});

// ─── 5. Aggressive cut detection ────────────────────────────────────────────
describe("computeWeightCutPlan — aggressive cut detection", () => {
  it("flags isAggressive=true when weeklyRate > 1.0 kg", () => {
    // 10kg in 4 weeks = 2.5kg/week → aggressive by weeklyRate
    const plan = computeWeightCutPlan(
      80,
      70,
      "2026-06-09",
      localDate("2026-05-12"),
    );
    expect(plan!.weeklyRate).toBeCloseTo(2.5, 5);
    expect(plan!.isAggressive).toBe(true);
  });

  it("flags isAggressive=true when pctCut > 10%", () => {
    // 8kg out of 70 = 11.4% → aggressive by percentage
    const plan = computeWeightCutPlan(
      70,
      62,
      "2026-08-04", // ~12 weeks → safe weekly rate (~0.67kg/wk)
      localDate("2026-05-12"),
    );
    expect(plan!.pctCut).toBeGreaterThan(10);
    expect(plan!.weeklyRate).toBeLessThan(1.0);
    expect(plan!.isAggressive).toBe(true);
  });

  it("does NOT flag isAggressive for safe cuts (<1kg/wk AND <10%)", () => {
    const plan = computeWeightCutPlan(
      75,
      73,
      "2026-06-09",
      localDate("2026-05-12"),
    );
    expect(plan!.isAggressive).toBe(false);
  });
});

// ─── 6. Date format on milestones ───────────────────────────────────────────
describe("computeWeightCutPlan — milestone date strings", () => {
  it("emits YYYY-MM-DD date strings spaced 7 days apart", () => {
    const plan = computeWeightCutPlan(
      75,
      73,
      "2026-06-09",
      localDate("2026-05-12"),
    );
    expect(plan!.milestones[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Each milestone is +7 days from the previous
    for (let i = 1; i < plan!.milestones.length; i++) {
      const prev = new Date(plan!.milestones[i - 1].date + "T00:00:00Z");
      const curr = new Date(plan!.milestones[i].date + "T00:00:00Z");
      const diffDays = (curr.getTime() - prev.getTime()) / 86_400_000;
      expect(diffDays).toBeCloseTo(7, 5);
    }
  });
});
