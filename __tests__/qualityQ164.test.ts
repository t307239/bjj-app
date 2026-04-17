/**
 * Tests for Q-164: gestureManager (UX 93→94)
 */
import { describe, it, expect } from "vitest";
import {
  detectSwipe,
  detectLongPress,
  detectPinch,
  classifyPinch,
  resolveGesture,
  getSwipeAxis,
  getDistance,
  createGestureConfig,
  createVelocityTracker,
  formatGestureDebug,
  DEFAULT_GESTURE_CONFIG,
} from "@/lib/gestureManager";

describe("Q-164: gestureManager", () => {
  describe("DEFAULT_GESTURE_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_GESTURE_CONFIG.minSwipeDistance).toBe(50);
      expect(DEFAULT_GESTURE_CONFIG.maxSwipeTime).toBe(300);
      expect(DEFAULT_GESTURE_CONFIG.longPressDuration).toBe(500);
      expect(DEFAULT_GESTURE_CONFIG.reducedMotion).toBe(false);
    });
  });

  describe("createGestureConfig", () => {
    it("merges overrides with defaults", () => {
      const config = createGestureConfig({ minSwipeDistance: 100 });
      expect(config.minSwipeDistance).toBe(100);
      expect(config.maxSwipeTime).toBe(300);
    });
  });

  describe("detectSwipe", () => {
    it("detects right swipe", () => {
      const r = detectSwipe({ x: 100, y: 200, time: 0 }, { x: 300, y: 200, time: 150 });
      expect(r.direction).toBe("right");
      expect(r.valid).toBe(true);
    });

    it("detects left swipe", () => {
      const r = detectSwipe({ x: 300, y: 200, time: 0 }, { x: 50, y: 200, time: 150 });
      expect(r.direction).toBe("left");
      expect(r.valid).toBe(true);
    });

    it("detects up swipe", () => {
      const r = detectSwipe({ x: 200, y: 300, time: 0 }, { x: 200, y: 50, time: 150 });
      expect(r.direction).toBe("up");
      expect(r.valid).toBe(true);
    });

    it("detects down swipe", () => {
      const r = detectSwipe({ x: 200, y: 50, time: 0 }, { x: 200, y: 300, time: 150 });
      expect(r.direction).toBe("down");
      expect(r.valid).toBe(true);
    });

    it("rejects short distance", () => {
      const r = detectSwipe({ x: 100, y: 200, time: 0 }, { x: 120, y: 200, time: 50 });
      expect(r.valid).toBe(false);
    });

    it("rejects slow swipe", () => {
      const r = detectSwipe({ x: 100, y: 200, time: 0 }, { x: 300, y: 200, time: 5000 });
      expect(r.valid).toBe(false);
    });

    it("rejects when reducedMotion is true", () => {
      const config = createGestureConfig({ reducedMotion: true });
      const r = detectSwipe({ x: 100, y: 200, time: 0 }, { x: 300, y: 200, time: 150 }, config);
      expect(r.valid).toBe(false);
    });

    it("provides deltaX and deltaY", () => {
      const r = detectSwipe({ x: 100, y: 200, time: 0 }, { x: 300, y: 250, time: 150 });
      expect(r.deltaX).toBe(200);
      expect(r.deltaY).toBe(50);
    });
  });

  describe("getSwipeAxis", () => {
    it("horizontal for mostly-x", () => {
      expect(getSwipeAxis({ x: 0, y: 0 }, { x: 100, y: 20 })).toBe("horizontal");
    });
    it("vertical for mostly-y", () => {
      expect(getSwipeAxis({ x: 0, y: 0 }, { x: 20, y: 100 })).toBe("vertical");
    });
  });

  describe("detectLongPress", () => {
    it("triggers after sufficient hold time", () => {
      const r = detectLongPress({ x: 100, y: 200, time: 0 }, { x: 102, y: 201, time: 600 });
      expect(r.triggered).toBe(true);
      expect(r.elapsed).toBe(600);
    });

    it("rejects if finger moved too much", () => {
      const r = detectLongPress({ x: 100, y: 200, time: 0 }, { x: 200, y: 300, time: 600 });
      expect(r.triggered).toBe(false);
    });

    it("rejects if too short", () => {
      const r = detectLongPress({ x: 100, y: 200, time: 0 }, { x: 101, y: 200, time: 200 });
      expect(r.triggered).toBe(false);
    });

    it("rejects when reducedMotion is true", () => {
      const config = createGestureConfig({ reducedMotion: true });
      const r = detectLongPress({ x: 100, y: 200, time: 0 }, { x: 100, y: 200, time: 600 }, config);
      expect(r.triggered).toBe(false);
    });
  });

  describe("detectPinch", () => {
    it("detects zoom-in", () => {
      const r = detectPinch({ x: 100, y: 200 }, { x: 200, y: 200 }, { x: 50, y: 200 }, { x: 250, y: 200 });
      expect(r.scale).toBe(2);
      expect(r.valid).toBe(true);
    });

    it("detects zoom-out", () => {
      const r = detectPinch({ x: 0, y: 200 }, { x: 200, y: 200 }, { x: 75, y: 200 }, { x: 125, y: 200 });
      expect(r.scale).toBe(0.25);
      expect(r.valid).toBe(true);
    });

    it("reports center point", () => {
      const r = detectPinch({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 50, y: 100 }, { x: 150, y: 100 });
      expect(r.center.x).toBe(100);
      expect(r.center.y).toBe(100);
    });

    it("handles zero initial distance", () => {
      const r = detectPinch({ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 50, y: 100 }, { x: 150, y: 100 });
      expect(r.scale).toBe(1);
    });
  });

  describe("classifyPinch", () => {
    it("zoom-in for scale > 1", () => {
      const r = detectPinch({ x: 100, y: 200 }, { x: 200, y: 200 }, { x: 50, y: 200 }, { x: 250, y: 200 });
      expect(classifyPinch(r)).toBe("zoom-in");
    });

    it("zoom-out for scale < 1", () => {
      const r = detectPinch({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 75, y: 0 }, { x: 125, y: 0 });
      expect(classifyPinch(r)).toBe("zoom-out");
    });

    it("none for invalid", () => {
      const config = createGestureConfig({ reducedMotion: true });
      const r = detectPinch({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 50, y: 0 }, { x: 250, y: 0 }, config);
      expect(classifyPinch(r)).toBe("none");
    });
  });

  describe("resolveGesture", () => {
    it("pinch for 2+ touches", () => {
      expect(resolveGesture(2, 100, 50).type).toBe("pinch");
    });
    it("long-press for still hold", () => {
      expect(resolveGesture(1, 600, 5).type).toBe("long-press");
    });
    it("swipe for quick movement", () => {
      expect(resolveGesture(1, 150, 100).type).toBe("swipe");
    });
    it("tap for brief still touch", () => {
      expect(resolveGesture(1, 100, 3).type).toBe("tap");
    });
    it("none for reducedMotion", () => {
      const config = createGestureConfig({ reducedMotion: true });
      expect(resolveGesture(1, 150, 100, config).type).toBe("none");
    });
  });

  describe("getDistance", () => {
    it("calculates Euclidean distance", () => {
      expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });
    it("returns 0 for same point", () => {
      expect(getDistance({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0);
    });
  });

  describe("createVelocityTracker", () => {
    it("tracks velocity", () => {
      const t = createVelocityTracker(5);
      t.addPoint({ x: 0, y: 0, time: 0 });
      t.addPoint({ x: 100, y: 0, time: 100 });
      expect(t.getVelocity().x).toBe(1);
    });
    it("returns zero with < 2 points", () => {
      const t = createVelocityTracker();
      t.addPoint({ x: 0, y: 0, time: 0 });
      expect(t.getVelocity().x).toBe(0);
    });
    it("resets correctly", () => {
      const t = createVelocityTracker();
      t.addPoint({ x: 0, y: 0, time: 0 });
      t.addPoint({ x: 100, y: 0, time: 100 });
      t.reset();
      expect(t.getVelocity().x).toBe(0);
    });
  });

  describe("formatGestureDebug", () => {
    it("formats with percentage", () => {
      const text = formatGestureDebug({ type: "swipe", confidence: 0.85 });
      expect(text).toContain("swipe");
      expect(text).toContain("85%");
    });
  });

  it("barrel: lib/index.ts exports gestureManager symbols", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(content).toContain("detectSwipe");
    expect(content).toContain("DEFAULT_GESTURE_CONFIG");
  });
});
