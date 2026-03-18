/**
 * Unit tests: lib/trainingTypes.ts
 * 単体試験: トレーニングタイプ定数
 *
 * Run:  npx vitest run __tests__/trainingTypes.test.ts
 */

import { describe, it, expect } from "vitest";
import { TRAINING_TYPES } from "../lib/trainingTypes";

describe("TRAINING_TYPES", () => {
  it("has exactly 5 types", () => {
    expect(TRAINING_TYPES).toHaveLength(5);
  });

  it("includes all expected type values", () => {
    const values = TRAINING_TYPES.map((t) => t.value);
    expect(values).toContain("gi");
    expect(values).toContain("nogi");
    expect(values).toContain("drilling");
    expect(values).toContain("competition");
    expect(values).toContain("open_mat");
  });

  it("every type has a non-empty label, color and icon", () => {
    for (const t of TRAINING_TYPES) {
      expect(t.label).toBeTruthy();
      expect(t.color).toBeTruthy();
      expect(t.icon).toBeTruthy();
    }
  });

  it("all color strings are valid Tailwind classes", () => {
    const twPattern = /^(bg|text|border)-/;
    for (const t of TRAINING_TYPES) {
      // color may be like "bg-blue-900/40 text-blue-300" — check at least one segment
      const firstSegment = t.color.split(" ")[0];
      expect(firstSegment).toMatch(twPattern);
    }
  });
});
