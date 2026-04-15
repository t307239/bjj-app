import { describe, it, expect } from "vitest";
import {
  isSilentHour,
  isOptimalSendTime,
  filterSendableSubscriptions,
} from "@/lib/notificationSafeHours";

describe("isSilentHour", () => {
  const tz = "Asia/Tokyo";

  it("returns true at 22:00 (silent start)", () => {
    // 22:00 JST = 13:00 UTC
    const date = new Date("2026-04-15T13:00:00Z");
    expect(isSilentHour(tz, date)).toBe(true);
  });

  it("returns true at 23:30 (middle of silent period)", () => {
    // 23:30 JST = 14:30 UTC
    const date = new Date("2026-04-15T14:30:00Z");
    expect(isSilentHour(tz, date)).toBe(true);
  });

  it("returns true at 00:00 midnight", () => {
    // 00:00 JST = 15:00 UTC (previous day)
    const date = new Date("2026-04-15T15:00:00Z");
    expect(isSilentHour(tz, date)).toBe(true);
  });

  it("returns true at 07:59 (just before silent end)", () => {
    // 07:59 JST = 22:59 UTC (previous day)
    const date = new Date("2026-04-14T22:59:00Z");
    expect(isSilentHour(tz, date)).toBe(true);
  });

  it("returns false at 08:00 (silent end)", () => {
    // 08:00 JST = 23:00 UTC (previous day)
    const date = new Date("2026-04-14T23:00:00Z");
    expect(isSilentHour(tz, date)).toBe(false);
  });

  it("returns false at 12:00 (midday)", () => {
    // 12:00 JST = 03:00 UTC
    const date = new Date("2026-04-15T03:00:00Z");
    expect(isSilentHour(tz, date)).toBe(false);
  });

  it("returns false at 21:59 (just before silent start)", () => {
    // 21:59 JST = 12:59 UTC
    const date = new Date("2026-04-15T12:59:00Z");
    expect(isSilentHour(tz, date)).toBe(false);
  });

  it("returns true for invalid timezone (safe fallback)", () => {
    expect(isSilentHour("Invalid/Zone", new Date())).toBe(true);
  });
});

describe("isOptimalSendTime", () => {
  it("is the inverse of isSilentHour", () => {
    const tz = "Asia/Tokyo";
    const daytime = new Date("2026-04-15T03:00:00Z"); // 12:00 JST
    const nighttime = new Date("2026-04-15T15:00:00Z"); // 00:00 JST

    expect(isOptimalSendTime(tz, daytime)).toBe(true);
    expect(isOptimalSendTime(tz, nighttime)).toBe(false);
  });
});

describe("filterSendableSubscriptions", () => {
  it("filters out subscriptions in silent hours", () => {
    const subs = [
      { id: 1, timezone: "Asia/Tokyo" },      // 12:00 JST → sendable
      { id: 2, timezone: "America/New_York" }, // 23:00 ET → silent
      { id: 3, timezone: "Europe/London" },    // 04:00 BST → silent
    ];
    // 2026-04-15 03:00 UTC → JST=12:00, ET=23:00, BST=04:00
    const now = new Date("2026-04-15T03:00:00Z");
    const result = filterSendableSubscriptions(subs, (s) => s.timezone, now);
    expect(result.map((s) => s.id)).toEqual([1]);
  });

  it("returns all if every timezone is in send hours", () => {
    const subs = [
      { id: 1, timezone: "Asia/Tokyo" },
      { id: 2, timezone: "America/New_York" },
    ];
    // 2026-04-15 18:00 UTC → JST=03:00(+1day), ET=14:00
    // Actually: JST=27:00 = next day 03:00 → silent. Let me pick better time
    // 2026-04-15 01:00 UTC → JST=10:00, ET=21:00
    const now = new Date("2026-04-15T01:00:00Z");
    const result = filterSendableSubscriptions(subs, (s) => s.timezone, now);
    expect(result.map((s) => s.id)).toEqual([1, 2]);
  });
});
