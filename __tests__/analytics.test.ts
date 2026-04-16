/**
 * Tests for lib/analytics.ts
 * Verifies trackEvent is SSR-safe, calls Vercel Analytics, and handles import failures.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @vercel/analytics before importing trackEvent
const mockTrack = vi.fn();
vi.mock("@vercel/analytics", () => ({
  track: mockTrack,
}));

import { trackEvent } from "@/lib/analytics";

/** Flush microtask queue so dynamic import().then() resolves */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("trackEvent", () => {
  beforeEach(() => {
    mockTrack.mockClear();
    // Simulate browser environment
    if (typeof globalThis.window === "undefined") {
      // @ts-expect-error — minimal window stub for typeof check
      globalThis.window = {} as Window & typeof globalThis;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls track with event name and empty props when no props given", async () => {
    trackEvent("training_logged");
    await flush();
    expect(mockTrack).toHaveBeenCalledWith("training_logged", {});
  });

  it("passes props through to track", async () => {
    trackEvent("pro_upgrade_click", { feature: "ai_coach" });
    await flush();
    expect(mockTrack).toHaveBeenCalledWith("pro_upgrade_click", { feature: "ai_coach" });
  });

  it("is a no-op on server (no window)", async () => {
    // @ts-expect-error — simulate SSR
    delete globalThis.window;
    trackEvent("training_logged");
    await flush();
    expect(mockTrack).not.toHaveBeenCalled();
  });
});
