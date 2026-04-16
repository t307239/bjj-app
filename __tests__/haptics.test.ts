/**
 * Tests for lib/haptics.ts
 * Verifies vibration patterns and SSR safety (no-op when navigator unavailable).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { hapticTap, hapticDouble, hapticSuccess, hapticNudge } from "@/lib/haptics";

describe("haptics", () => {
  let vibrateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vibrateSpy = vi.fn();
    Object.defineProperty(globalThis, "navigator", {
      value: { vibrate: vibrateSpy },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hapticTap fires [50] pattern", () => {
    hapticTap();
    expect(vibrateSpy).toHaveBeenCalledWith([50]);
  });

  it("hapticDouble fires [30, 20, 30] pattern", () => {
    hapticDouble();
    expect(vibrateSpy).toHaveBeenCalledWith([30, 20, 30]);
  });

  it("hapticSuccess fires [50, 100, 50] pattern", () => {
    hapticSuccess();
    expect(vibrateSpy).toHaveBeenCalledWith([50, 100, 50]);
  });

  it("hapticNudge fires [20] pattern", () => {
    hapticNudge();
    expect(vibrateSpy).toHaveBeenCalledWith([20]);
  });

  it("does not throw when navigator.vibrate is undefined", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });
    expect(() => hapticTap()).not.toThrow();
    expect(() => hapticDouble()).not.toThrow();
    expect(() => hapticSuccess()).not.toThrow();
    expect(() => hapticNudge()).not.toThrow();
  });

  it("does not throw when navigator is undefined (SSR)", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => hapticTap()).not.toThrow();
  });
});
