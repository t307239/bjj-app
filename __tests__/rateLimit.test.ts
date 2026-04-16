/**
 * rateLimit — unit tests for lib/rateLimit.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter } from "@/lib/rateLimit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows first request", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
    expect(limiter.check("1.2.3.4")).toBe(true);
  });

  it("allows requests up to max", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.check("ip1")).toBe(true); // 1
    expect(limiter.check("ip1")).toBe(true); // 2
    expect(limiter.check("ip1")).toBe(true); // 3
  });

  it("blocks request exceeding max", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    limiter.check("ip1"); // 1
    limiter.check("ip1"); // 2
    limiter.check("ip1"); // 3
    expect(limiter.check("ip1")).toBe(false); // 4 → blocked
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.check("ipA")).toBe(true);
    expect(limiter.check("ipA")).toBe(false); // ipA exhausted
    expect(limiter.check("ipB")).toBe(true);  // ipB still fresh
  });

  it("resets after window expires", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip1")).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(60_001);
    expect(limiter.check("ip1")).toBe(true);
  });

  it("does not reset before window expires", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.check("ip1");
    limiter.check("ip1"); // blocked

    vi.advanceTimersByTime(59_999);
    expect(limiter.check("ip1")).toBe(false); // still blocked
  });

  it("separate instances have independent counters", () => {
    const limiterA = createRateLimiter({ windowMs: 60_000, max: 1 });
    const limiterB = createRateLimiter({ windowMs: 60_000, max: 1 });

    limiterA.check("ip1");
    limiterA.check("ip1"); // exhausted on A

    expect(limiterB.check("ip1")).toBe(true); // B is independent
  });

  it("handles max=1 — blocks on second request", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip1")).toBe(false);
  });

  it("handles high throughput scenario", () => {
    const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 20 });
    for (let i = 0; i < 20; i++) {
      expect(limiter.check("ip1")).toBe(true);
    }
    expect(limiter.check("ip1")).toBe(false);
  });

  it("resets counter fully after window — allows max again", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    limiter.check("ip1"); // 1
    limiter.check("ip1"); // 2
    expect(limiter.check("ip1")).toBe(false); // blocked

    vi.advanceTimersByTime(60_001);
    expect(limiter.check("ip1")).toBe(true);  // 1 (reset)
    expect(limiter.check("ip1")).toBe(true);  // 2
    expect(limiter.check("ip1")).toBe(false); // blocked again
  });
});
