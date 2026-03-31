/**
 * Integration tests: lib/trainingTypes.ts × lib/compNotes.ts (内結テスト)
 *
 * Tests cross-module interactions:
 *   - TRAINING_TYPES.competition value aligns with CompData result expectations
 *   - Filter simulation: filtering log arrays by TrainingTypeValue
 *   - TrainingTypeValue type safety used with simulated log objects
 *   - TRAINING_TYPES color classes are compatible with Tailwind bg+text pattern
 *   - TRAINING_TYPES uniqueness invariants
 *
 * Run:  npx vitest run __tests__/integration/trainingTypes.integration.test.ts
 */

import { describe, it, expect } from "vitest";
import { TRAINING_TYPES, type TrainingTypeValue } from "@/lib/trainingTypes";
import { encodeCompNotes, decodeCompNotes, emptyCompData } from "@/lib/trainingLogHelpers";

// ── Simulated training log entry (mirrors Supabase schema) ────────────────
type SimLog = {
  id: string;
  date: string;
  type: TrainingTypeValue;
  duration_min: number;
  notes: string;
};

function makeLog(
  type: TrainingTypeValue,
  durationMin = 60,
  notes = ""
): SimLog {
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(36),
    date: "2026-03-19",
    type,
    duration_min: durationMin,
    notes,
  };
}

// ── TRAINING_TYPES structural invariants ─────────────────────────────────
describe("TRAINING_TYPES structural invariants", () => {
  it("all values are unique", () => {
    const values = TRAINING_TYPES.map((t) => t.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("all labels are unique", () => {
    const labels = TRAINING_TYPES.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("all icons are unique emoji", () => {
    const icons = TRAINING_TYPES.map((t) => t.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("all color strings contain both bg- and text- Tailwind classes", () => {
    for (const t of TRAINING_TYPES) {
      expect(t.color).toMatch(/bg-/);
      expect(t.color).toMatch(/text-/);
    }
  });

  it("competition type exists and has red color", () => {
    const comp = TRAINING_TYPES.find((t) => t.value === "competition");
    expect(comp).toBeDefined();
    expect(comp!.color).toContain("red");
  });
});

// ── Filter simulation: log array filtering by type ────────────────────────
describe("log array filtering by TrainingTypeValue", () => {
  const logs: SimLog[] = [
    makeLog("gi", 90),
    makeLog("gi", 60),
    makeLog("nogi", 75),
    makeLog("drilling", 30),
    makeLog("competition", 120),
    makeLog("open_mat", 60),
    makeLog("gi", 45),
    makeLog("competition", 90),
  ];

  it("filter by 'gi' returns correct count", () => {
    const gi = logs.filter((l) => l.type === "gi");
    expect(gi).toHaveLength(3);
  });

  it("filter by 'competition' returns correct count", () => {
    const comp = logs.filter((l) => l.type === "competition");
    expect(comp).toHaveLength(2);
  });

  it("filtering by each TRAINING_TYPES value covers all logs", () => {
    const allTypeValues = TRAINING_TYPES.map((t) => t.value);
    const covered = allTypeValues.flatMap((v) => logs.filter((l) => l.type === v));
    expect(covered).toHaveLength(logs.length);
  });

  it("sum of durations per type adds up to total", () => {
    const totalAll = logs.reduce((sum, l) => sum + l.duration_min, 0);
    const totalByType = TRAINING_TYPES.reduce((sum, t) => {
      const typeTotal = logs
        .filter((l) => l.type === t.value)
        .reduce((s, l) => s + l.duration_min, 0);
      return sum + typeTotal;
    }, 0);
    expect(totalByType).toBe(totalAll);
  });
});

// ── competition type × CompData integration ──────────────────────────────
describe("competition TrainingType × compNotes integration", () => {
  it("a competition log entry can hold encoded comp notes", () => {
    const comp = { ...emptyCompData(), result: "win", opponent: "Smith", finish: "submission" };
    const encoded = encodeCompNotes(comp, "Tough match");
    const log = makeLog("competition", 120, encoded);

    expect(log.type).toBe("competition");
    const { comp: decoded } = decodeCompNotes(log.notes);
    expect(decoded?.result).toBe("win");
    expect(decoded?.opponent).toBe("Smith");
  });

  it("non-competition log type with comp notes decodes correctly too", () => {
    // Edge case: someone stored comp notes on a gi log (shouldn't happen, but should not crash)
    const comp = { ...emptyCompData(), result: "win", opponent: "Jones" };
    const encoded = encodeCompNotes(comp, "");
    const log = makeLog("gi", 60, encoded);

    expect(log.type).toBe("gi");
    const { comp: decoded } = decodeCompNotes(log.notes);
    expect(decoded?.result).toBe("win");
  });

  it("competition type label matches expected value", () => {
    const compType = TRAINING_TYPES.find((t) => t.value === "competition");
    expect(compType?.label).toBe("Competition");
  });

  it("competition icon is a trophy", () => {
    const compType = TRAINING_TYPES.find((t) => t.value === "competition");
    expect(compType?.icon).toBe("🏆");
  });
});

// ── Type distribution calculation (used in TrainingTypeChart) ─────────────
describe("type distribution calculation (TrainingTypeChart pattern)", () => {
  const logs: SimLog[] = [
    makeLog("gi", 60),
    makeLog("gi", 90),
    makeLog("nogi", 45),
    makeLog("drilling", 30),
    makeLog("drilling", 30),
    makeLog("competition", 120),
    makeLog("open_mat", 60),
  ];

  it("type count map sums to total logs", () => {
    const countMap: Record<string, number> = {};
    for (const t of TRAINING_TYPES) countMap[t.value] = 0;
    for (const log of logs) countMap[log.type]++;

    const total = Object.values(countMap).reduce((a, b) => a + b, 0);
    expect(total).toBe(logs.length);
  });

  it("percentage shares sum to 100 (within floating point tolerance)", () => {
    const countMap: Record<string, number> = {};
    for (const t of TRAINING_TYPES) countMap[t.value] = 0;
    for (const log of logs) countMap[log.type]++;

    const percentages = Object.values(countMap).map((c) => (c / logs.length) * 100);
    const sum = percentages.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 5);
  });

  it("most common type in sample is 'gi'", () => {
    const countMap: Record<string, number> = {};
    for (const t of TRAINING_TYPES) countMap[t.value] = 0;
    for (const log of logs) countMap[log.type]++;

    const mostCommon = Object.entries(countMap).sort((a, b) => b[1] - a[1])[0];
    expect(mostCommon[0]).toBe("gi");
    expect(mostCommon[1]).toBe(2);
  });

  it("TRAINING_TYPES lookup finds label for any log type", () => {
    for (const log of logs) {
      const typeInfo = TRAINING_TYPES.find((t) => t.value === log.type);
      expect(typeInfo, `No TRAINING_TYPE found for "${log.type}"`).toBeDefined();
      expect(typeInfo!.label).toBeTruthy();
      expect(typeInfo!.icon).toBeTruthy();
    }
  });
});

// ── Month aggregation pattern (used in TrainingBarChart) ──────────────────
describe("monthly aggregation by type (TrainingBarChart pattern)", () => {
  const logsMultiMonth: SimLog[] = [
    { ...makeLog("gi", 60),  date: "2026-02-01" },
    { ...makeLog("gi", 60),  date: "2026-02-15" },
    { ...makeLog("nogi", 45), date: "2026-02-20" },
    { ...makeLog("gi", 90),  date: "2026-03-01" },
    { ...makeLog("competition", 120), date: "2026-03-15" },
    { ...makeLog("drilling", 30), date: "2026-03-19" },
  ];

  type MonthBucket = { count: number; byType: Record<string, number> };

  function aggregateByMonth(logs: SimLog[]): Record<string, MonthBucket> {
    const result: Record<string, MonthBucket> = {};
    for (const log of logs) {
      const ym = log.date.slice(0, 7);
      if (!result[ym]) {
        result[ym] = { count: 0, byType: {} };
      }
      result[ym].count++;
      result[ym].byType[log.type] = (result[ym].byType[log.type] ?? 0) + 1;
    }
    return result;
  }

  it("aggregates logs into correct month buckets", () => {
    const buckets = aggregateByMonth(logsMultiMonth);
    expect(Object.keys(buckets)).toHaveLength(2);
    expect(buckets["2026-02"].count).toBe(3);
    expect(buckets["2026-03"].count).toBe(3);
  });

  it("byType breakdown per month is correct", () => {
    const buckets = aggregateByMonth(logsMultiMonth);
    expect(buckets["2026-02"].byType["gi"]).toBe(2);
    expect(buckets["2026-02"].byType["nogi"]).toBe(1);
    expect(buckets["2026-03"].byType["competition"]).toBe(1);
    expect(buckets["2026-03"].byType["gi"]).toBe(1);
  });

  it("each byType key is a valid TRAINING_TYPES value", () => {
    const validValues = TRAINING_TYPES.map((t) => t.value);
    const buckets = aggregateByMonth(logsMultiMonth);
    for (const bucket of Object.values(buckets)) {
      for (const typeKey of Object.keys(bucket.byType)) {
        expect(validValues, `"${typeKey}" is not a valid TrainingTypeValue`).toContain(typeKey);
      }
    }
  });
});
