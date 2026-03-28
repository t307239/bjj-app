/**
 * Integration tests: lib/compNotes.ts (内結テスト)
 *
 * Tests cross-function pipelines within compNotes:
 *   encodeCompNotes → decodeCompNotes → formatDuration
 *   RESULT_LABELS alignment with decoded results
 *   emptyCompData factory + encode/decode round-trip
 *
 * Run:  npx vitest run __tests__/integration/compNotes.integration.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  encodeCompNotes,
  decodeCompNotes,
  formatDuration,
  emptyCompData,
  RESULT_LABELS,
  COMP_PREFIX,
  type CompData,
} from "@/lib/trainingLogHelpers";

// ── Full encode → decode round-trip ──────────────────────────────────────────
describe("encode → decode round-trip", () => {
  const fullComp: CompData = {
    result: "win",
    opponent: "Tanaka",
    finish: "submission",
    event: "IBJJF Tokyo Open",
    opponent_rank: "blue",
    gi_type: "gi",
  };

  it("round-trips a fully populated CompData with no user notes", () => {
    const encoded = encodeCompNotes(fullComp, "");
    const { comp, userNotes } = decodeCompNotes(encoded);
    expect(comp).toEqual(fullComp);
    expect(userNotes).toBe("");
  });

  it("round-trips a fully populated CompData with user notes", () => {
    const encoded = encodeCompNotes(fullComp, "Great match overall");
    const { comp, userNotes } = decodeCompNotes(encoded);
    expect(comp).toEqual(fullComp);
    expect(userNotes).toBe("Great match overall");
  });

  it("round-trips a loss entry", () => {
    const lossComp: CompData = {
      result: "loss",
      opponent: "Garcia",
      finish: "points",
      event: "",
      opponent_rank: "purple",
      gi_type: "nogi",
    };
    const encoded = encodeCompNotes(lossComp, "");
    const { comp } = decodeCompNotes(encoded);
    expect(comp?.result).toBe("loss");
    expect(comp?.opponent).toBe("Garcia");
    expect(comp?.gi_type).toBe("nogi");
  });

  it("round-trips a draw entry", () => {
    const drawComp: CompData = {
      result: "draw",
      opponent: "Kim",
      finish: "",
      event: "Local Cup",
      opponent_rank: "",
      gi_type: "gi",
    };
    const encoded = encodeCompNotes(drawComp, "");
    const { comp } = decodeCompNotes(encoded);
    expect(comp?.result).toBe("draw");
  });

  it("round-trips multiline user notes correctly", () => {
    const encoded = encodeCompNotes(fullComp, "Line1\nLine2\nLine3");
    const { comp, userNotes } = decodeCompNotes(encoded);
    expect(comp).toEqual(fullComp);
    expect(userNotes).toBe("Line1\nLine2\nLine3");
  });

  it("round-trips user notes with special characters", () => {
    const encoded = encodeCompNotes(fullComp, "Notes: 試合前に水分補給 & rest 100%");
    const { comp, userNotes } = decodeCompNotes(encoded);
    expect(comp).toEqual(fullComp);
    expect(userNotes).toBe("Notes: 試合前に水分補給 & rest 100%");
  });

  it("preserves opponent names with special characters", () => {
    const specialComp: CompData = {
      ...emptyCompData(),
      result: "win",
      opponent: "O'Brien-Smith",
      finish: "submission",
    };
    const encoded = encodeCompNotes(specialComp, "");
    const { comp } = decodeCompNotes(encoded);
    expect(comp?.opponent).toBe("O'Brien-Smith");
  });

  it("preserves event names with commas and parentheses", () => {
    const eventComp: CompData = {
      ...emptyCompData(),
      result: "win",
      event: "BJJ Stars (2026), Absolute Division",
    };
    const encoded = encodeCompNotes(eventComp, "");
    const { comp } = decodeCompNotes(encoded);
    expect(comp?.event).toBe("BJJ Stars (2026), Absolute Division");
  });
});

// ── emptyCompData factory integration ────────────────────────────────────────
describe("emptyCompData + encode/decode", () => {
  it("emptyCompData encoded result is passed through as plain notes", () => {
    const empty = emptyCompData();
    const encoded = encodeCompNotes(empty, "plain note");
    // All fields are empty strings → treated as plain notes, not comp entry
    expect(encoded).toBe("plain note");
    const { comp, userNotes } = decodeCompNotes(encoded);
    expect(comp).toBeNull();
    expect(userNotes).toBe("plain note");
  });

  it("emptyCompData with one non-empty field encodes as comp entry", () => {
    const partialComp = { ...emptyCompData(), result: "win" };
    const encoded = encodeCompNotes(partialComp, "");
    expect(encoded.startsWith(COMP_PREFIX)).toBe(true);
    const { comp } = decodeCompNotes(encoded);
    expect(comp?.result).toBe("win");
    expect(comp?.opponent).toBe("");
  });

  it("emptyCompData all fields preserved through round-trip", () => {
    const partial = { ...emptyCompData(), event: "Test Event", finish: "submission" };
    const encoded = encodeCompNotes(partial, "note");
    const { comp, userNotes } = decodeCompNotes(encoded);
    expect(comp?.event).toBe("Test Event");
    expect(comp?.finish).toBe("submission");
    expect(comp?.result).toBe("");
    expect(userNotes).toBe("note");
  });
});

// ── RESULT_LABELS alignment with decoded result ────────────────────────────
describe("RESULT_LABELS integration with decoded comp result", () => {
  it("win result maps to RESULT_LABELS win entry", () => {
    const comp: CompData = { ...emptyCompData(), result: "win" };
    const encoded = encodeCompNotes(comp, "");
    const { comp: decoded } = decodeCompNotes(encoded);
    const label = RESULT_LABELS[decoded?.result ?? ""];
    expect(label).toBeDefined();
    expect(label.label).toContain("Win");
    expect(label.color).toContain("green");
  });

  it("loss result maps to RESULT_LABELS loss entry", () => {
    const comp: CompData = { ...emptyCompData(), result: "loss" };
    const { comp: decoded } = decodeCompNotes(encodeCompNotes(comp, ""));
    const label = RESULT_LABELS[decoded?.result ?? ""];
    expect(label.label).toContain("Loss");
    expect(label.color).toContain("red");
  });

  it("draw result maps to RESULT_LABELS draw entry", () => {
    const comp: CompData = { ...emptyCompData(), result: "draw" };
    const { comp: decoded } = decodeCompNotes(encodeCompNotes(comp, ""));
    const label = RESULT_LABELS[decoded?.result ?? ""];
    expect(label.label).toContain("Draw");
    expect(label.color).toContain("yellow");
  });

  it("unknown result (no label) does not crash lookup", () => {
    const comp: CompData = { ...emptyCompData(), result: "unknown_result" };
    const { comp: decoded } = decodeCompNotes(encodeCompNotes(comp, ""));
    const label = RESULT_LABELS[decoded?.result ?? ""];
    // Should be undefined — caller is responsible for guard
    expect(label).toBeUndefined();
  });

  it("all RESULT_LABELS keys have both label and color properties", () => {
    for (const [key, val] of Object.entries(RESULT_LABELS)) {
      expect(val.label, `${key} missing label`).toBeTruthy();
      expect(val.color, `${key} missing color`).toBeTruthy();
    }
  });
});

// ── formatDuration called on decoded session duration ─────────────────────
describe("formatDuration pipeline integration", () => {
  const durations = [
    { min: 45, expected: "45m" },
    { min: 60, expected: "1h" },
    { min: 90, expected: "1h30m" },
    { min: 120, expected: "2h" },
    { min: 135, expected: "2h15m" },
    { min: 0, expected: "0m" },
  ];

  it.each(durations)("formatDuration($min) === '$expected'", ({ min, expected }) => {
    expect(formatDuration(min)).toBe(expected);
  });

  it("formatDuration is consistent across multiple calls (no side effects)", () => {
    expect(formatDuration(90)).toBe("1h30m");
    expect(formatDuration(90)).toBe("1h30m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(45)).toBe("45m");
  });

  it("total session time from multiple comp entries sums correctly", () => {
    // Simulate two competition sessions
    const durations = [90, 120, 45];
    const total = durations.reduce((a, b) => a + b, 0);
    expect(formatDuration(total)).toBe("4h15m");
  });
});

// ── Idempotency: encode is NOT idempotent by design ───────────────────────
describe("encode idempotency guard", () => {
  it("encoding an already-encoded string does not double-wrap", () => {
    const comp: CompData = { ...emptyCompData(), result: "win", opponent: "Test" };
    const encoded = encodeCompNotes(comp, "note");
    const { comp: decoded, userNotes } = decodeCompNotes(encoded);

    // Re-encoding decoded result with decoded userNotes reproduces the original
    const reEncoded = encodeCompNotes(decoded!, userNotes);
    expect(reEncoded).toBe(encoded);
  });
});
