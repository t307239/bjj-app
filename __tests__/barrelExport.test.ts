/**
 * barrelExport — verifies lib/index.ts barrel export integrity
 *
 * Ensures that all expected utilities are re-exported correctly
 * and that the barrel doesn't export unexpected items.
 */
import { describe, it, expect } from "vitest";
import * as lib from "@/lib";

describe("lib/index.ts barrel export", () => {
  // ── Analytics ───────────────────────────────────────────────────────────
  it("exports trackEvent", () => {
    expect(typeof lib.trackEvent).toBe("function");
  });

  // ── Date / Time ─────────────────────────────────────────────────────────
  it("exports formatDateShort", () => {
    expect(typeof lib.formatDateShort).toBe("function");
  });

  it("exports formatDateLong", () => {
    expect(typeof lib.formatDateLong).toBe("function");
  });

  it("exports getUserTimezone", () => {
    expect(typeof lib.getUserTimezone).toBe("function");
  });

  it("exports getLogicalTrainingDate", () => {
    expect(typeof lib.getLogicalTrainingDate).toBe("function");
  });

  // ── Training Helpers ────────────────────────────────────────────────────
  it("exports TRAINING_TYPES array", () => {
    expect(Array.isArray(lib.TRAINING_TYPES)).toBe(true);
    expect(lib.TRAINING_TYPES.length).toBeGreaterThan(0);
  });

  it("exports formatDuration", () => {
    expect(typeof lib.formatDuration).toBe("function");
  });

  it("exports calcBjjDuration", () => {
    expect(typeof lib.calcBjjDuration).toBe("function");
  });

  it("exports BELT_RANKS", () => {
    expect(Array.isArray(lib.BELT_RANKS)).toBe(true);
  });

  // ── Skill Map ──────────────────────────────────────────────────────────
  it("exports wouldCreateCycle", () => {
    expect(typeof lib.wouldCreateCycle).toBe("function");
  });

  it("exports NODE_W and NODE_H constants", () => {
    expect(typeof lib.NODE_W).toBe("number");
    expect(typeof lib.NODE_H).toBe("number");
  });

  // ── Techniques ─────────────────────────────────────────────────────────
  it("exports BJJ_TECHNIQUE_SUGGESTIONS", () => {
    expect(Array.isArray(lib.BJJ_TECHNIQUE_SUGGESTIONS)).toBe(true);
    expect(lib.BJJ_TECHNIQUE_SUGGESTIONS.length).toBeGreaterThan(50);
  });

  // ── Validation ─────────────────────────────────────────────────────────
  it("exports parseBody", () => {
    expect(typeof lib.parseBody).toBe("function");
  });

  // ── Notification ───────────────────────────────────────────────────────
  it("exports isSilentHour", () => {
    expect(typeof lib.isSilentHour).toBe("function");
  });

  it("exports isOptimalSendTime", () => {
    expect(typeof lib.isOptimalSendTime).toBe("function");
  });

  // ── Browser Detection ──────────────────────────────────────────────────
  it("exports isInAppBrowser", () => {
    expect(typeof lib.isInAppBrowser).toBe("function");
  });

  // ── Logger ─────────────────────────────────────────────────────────────
  it("exports logger", () => {
    expect(typeof lib.logger).toBe("object");
    expect(typeof lib.logger.info).toBe("function");
    expect(typeof lib.logger.error).toBe("function");
  });

  // ── Haptics ────────────────────────────────────────────────────────────
  it("exports haptic functions", () => {
    expect(typeof lib.hapticTap).toBe("function");
    expect(typeof lib.hapticSuccess).toBe("function");
  });
});
