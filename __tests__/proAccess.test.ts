import { describe, it, expect } from "vitest";
import { hasProAccess, getTrialStatus, calculateTrialEnd } from "@/lib/proAccess";

describe("proAccess.hasProAccess", () => {
  const NOW = new Date("2026-05-07T12:00:00Z");

  it("returns false for null/undefined profile", () => {
    expect(hasProAccess(null, NOW)).toBe(false);
    expect(hasProAccess(undefined, NOW)).toBe(false);
  });

  it("returns true for is_pro=true", () => {
    expect(hasProAccess({ is_pro: true }, NOW)).toBe(true);
  });

  it("returns true for active trial", () => {
    const future = new Date("2026-05-12T12:00:00Z").toISOString();
    expect(hasProAccess({ is_pro: false, complimentary_trial_until: future }, NOW)).toBe(true);
  });

  it("returns false for expired trial", () => {
    const past = new Date("2026-05-01T12:00:00Z").toISOString();
    expect(hasProAccess({ is_pro: false, complimentary_trial_until: past }, NOW)).toBe(false);
  });

  it("returns false for null trial_until + non-pro", () => {
    expect(hasProAccess({ is_pro: false, complimentary_trial_until: null }, NOW)).toBe(false);
  });

  it("returns true if both is_pro AND trial active", () => {
    const future = new Date("2026-05-12T12:00:00Z").toISOString();
    expect(hasProAccess({ is_pro: true, complimentary_trial_until: future }, NOW)).toBe(true);
  });

  it("handles malformed date string gracefully", () => {
    expect(hasProAccess({ is_pro: false, complimentary_trial_until: "not-a-date" }, NOW)).toBe(false);
  });
});

describe("proAccess.getTrialStatus", () => {
  const NOW = new Date("2026-05-07T12:00:00Z");

  it("returns null for no trial", () => {
    expect(getTrialStatus({ is_pro: false }, NOW)).toBeNull();
    expect(getTrialStatus(null, NOW)).toBeNull();
  });

  it("returns null for expired trial", () => {
    const past = new Date("2026-05-01T12:00:00Z").toISOString();
    expect(getTrialStatus({ complimentary_trial_until: past }, NOW)).toBeNull();
  });

  it("returns daysLeft=7 for trial ending in 7 days exactly", () => {
    const future = new Date("2026-05-14T12:00:00Z").toISOString();
    const status = getTrialStatus({ complimentary_trial_until: future }, NOW);
    expect(status).not.toBeNull();
    expect(status!.daysLeft).toBe(7);
  });

  it("rounds up partial days (5h left = 1 day)", () => {
    const future = new Date("2026-05-07T17:00:00Z").toISOString();
    const status = getTrialStatus({ complimentary_trial_until: future }, NOW);
    expect(status!.daysLeft).toBe(1);
  });
});

describe("proAccess.calculateTrialEnd", () => {
  // z255uuu: default bumped from 7 → 14 days to match LP copy + Stripe industry default
  it("returns ISO string +14 days from now by default", () => {
    const now = new Date("2026-05-07T12:00:00Z");
    const result = calculateTrialEnd(undefined, now);
    expect(result).toBe("2026-05-21T12:00:00.000Z");
  });

  it("respects explicit 7-day duration", () => {
    const now = new Date("2026-05-07T12:00:00Z");
    const result = calculateTrialEnd(7, now);
    expect(result).toBe("2026-05-14T12:00:00.000Z");
  });

  it("respects custom duration (e.g. 30 days)", () => {
    const now = new Date("2026-05-07T12:00:00Z");
    const result = calculateTrialEnd(30, now);
    expect(result).toBe("2026-06-06T12:00:00.000Z");
  });
});
