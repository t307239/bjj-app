/**
 * Unit tests: lib/compNotes.ts
 * 単体試験: 試合メモのエンコード/デコード関数
 *
 * Run:  npx vitest run __tests__/compNotes.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  encodeCompNotes,
  decodeCompNotes,
  formatDuration,
  emptyCompData,
  COMP_PREFIX,
  type CompData,
} from "../lib/compNotes";

// ── helpers ─────────────────────────────────────────────────────────────────

const fullComp = (): CompData => ({
  result: "win",
  opponent: "Tanaka",
  finish: "triangle",
  event: "IBJJF Tokyo Open",
  opponent_rank: "blue",
  gi_type: "gi",
});

// ── encodeCompNotes ──────────────────────────────────────────────────────────

describe("encodeCompNotes", () => {
  it("returns only userNotes when all comp fields are empty", () => {
    const encoded = encodeCompNotes(emptyCompData(), "good match");
    expect(encoded).toBe("good match");
  });

  it("returns only userNotes when comp is blank and userNotes is blank", () => {
    const encoded = encodeCompNotes(emptyCompData(), "");
    expect(encoded).toBe("");
  });

  it("encodes comp data without user notes", () => {
    const encoded = encodeCompNotes(fullComp(), "");
    expect(encoded.startsWith(COMP_PREFIX)).toBe(true);
    expect(encoded).not.toContain("\n");
    // the JSON payload must contain all fields
    const json = JSON.parse(encoded.slice(COMP_PREFIX.length));
    expect(json.result).toBe("win");
    expect(json.opponent).toBe("Tanaka");
    expect(json.finish).toBe("triangle");
    expect(json.event).toBe("IBJJF Tokyo Open");
  });

  it("encodes comp data WITH user notes separated by newline", () => {
    const encoded = encodeCompNotes(fullComp(), "felt good");
    const lines = encoded.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0].startsWith(COMP_PREFIX)).toBe(true);
    expect(lines[1]).toBe("felt good");
  });

  it("trims leading/trailing whitespace from userNotes before deciding separator", () => {
    // " " (spaces only) should be treated as empty → no newline
    const encoded = encodeCompNotes(fullComp(), "   ");
    expect(encoded).not.toContain("\n");
  });
});

// ── decodeCompNotes ──────────────────────────────────────────────────────────

describe("decodeCompNotes", () => {
  it("returns null comp for plain text (no prefix)", () => {
    const { comp, userNotes } = decodeCompNotes("regular training note");
    expect(comp).toBeNull();
    expect(userNotes).toBe("regular training note");
  });

  it("returns null comp for empty string", () => {
    const { comp, userNotes } = decodeCompNotes("");
    expect(comp).toBeNull();
    expect(userNotes).toBe("");
  });

  it("decodes comp data without user notes", () => {
    const encoded = encodeCompNotes(fullComp(), "");
    const { comp, userNotes } = decodeCompNotes(encoded);
    expect(comp).not.toBeNull();
    expect(comp!.result).toBe("win");
    expect(comp!.opponent).toBe("Tanaka");
    expect(userNotes).toBe("");
  });

  it("decodes comp data WITH user notes", () => {
    const encoded = encodeCompNotes(fullComp(), "felt great");
    const { comp, userNotes } = decodeCompNotes(encoded);
    expect(comp!.result).toBe("win");
    expect(userNotes).toBe("felt great");
  });

  it("returns null comp for malformed JSON", () => {
    const malformed = `${COMP_PREFIX}this is not json`;
    const { comp, userNotes } = decodeCompNotes(malformed);
    expect(comp).toBeNull();
    expect(userNotes).toBe(malformed); // falls back to raw notes
  });

  it("round-trips all fields faithfully", () => {
    const original = fullComp();
    const encoded = encodeCompNotes(original, "notes here");
    const { comp, userNotes } = decodeCompNotes(encoded);
    expect(comp).toEqual(original);
    expect(userNotes).toBe("notes here");
  });

  it("handles multi-line user notes correctly", () => {
    const encoded = encodeCompNotes(fullComp(), "line1\nline2\nline3");
    const { comp, userNotes } = decodeCompNotes(encoded);
    expect(comp!.result).toBe("win");
    expect(userNotes).toBe("line1\nline2\nline3");
  });
});

// ── formatDuration ───────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats sub-hour durations as Nm", () => {
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(1)).toBe("1m");
    expect(formatDuration(59)).toBe("59m");
  });

  it("formats exactly 60 minutes as 1h", () => {
    expect(formatDuration(60)).toBe("1h");
  });

  it("formats 90 minutes as 1h30m", () => {
    expect(formatDuration(90)).toBe("1h30m");
  });

  it("formats 120 minutes as 2h", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats 135 minutes as 2h15m", () => {
    expect(formatDuration(135)).toBe("2h15m");
  });
});
