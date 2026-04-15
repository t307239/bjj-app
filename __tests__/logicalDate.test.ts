import { describe, it, expect } from "vitest";
import { getLogicalTrainingDate } from "@/lib/logicalDate";

describe("getLogicalTrainingDate", () => {
  const tz = "Asia/Tokyo";

  it("returns current date for daytime sessions (e.g. 14:00 JST)", () => {
    // 2026-04-15 14:00 JST = 2026-04-15 05:00 UTC
    const date = new Date("2026-04-15T05:00:00Z");
    expect(getLogicalTrainingDate(date, tz)).toBe("2026-04-15");
  });

  it("shifts to previous day for sessions before 4 AM (e.g. 1:00 JST)", () => {
    // 2026-04-15 01:00 JST = 2026-04-14 16:00 UTC
    const date = new Date("2026-04-14T16:00:00Z");
    expect(getLogicalTrainingDate(date, tz)).toBe("2026-04-14");
  });

  it("does NOT shift at exactly 4:00 AM", () => {
    // 2026-04-15 04:00 JST = 2026-04-14 19:00 UTC
    const date = new Date("2026-04-14T19:00:00Z");
    expect(getLogicalTrainingDate(date, tz)).toBe("2026-04-15");
  });

  it("shifts at 3:59 AM", () => {
    // 2026-04-15 03:59 JST = 2026-04-14 18:59 UTC
    const date = new Date("2026-04-14T18:59:00Z");
    expect(getLogicalTrainingDate(date, tz)).toBe("2026-04-14");
  });

  it("handles midnight exactly (00:00)", () => {
    // 2026-04-15 00:00 JST = 2026-04-14 15:00 UTC
    const date = new Date("2026-04-14T15:00:00Z");
    expect(getLogicalTrainingDate(date, tz)).toBe("2026-04-14");
  });

  it("works with US Eastern timezone", () => {
    // 2026-04-15 02:00 ET = 2026-04-15 06:00 UTC (EDT)
    const date = new Date("2026-04-15T06:00:00Z");
    expect(getLogicalTrainingDate(date, "America/New_York")).toBe("2026-04-14");
  });

  it("handles month boundary (midnight on Jan 1st shifts to Dec 31st)", () => {
    // 2026-01-01 01:00 JST = 2025-12-31 16:00 UTC
    const date = new Date("2025-12-31T16:00:00Z");
    expect(getLogicalTrainingDate(date, tz)).toBe("2025-12-31");
  });

  it("returns current date for late night 23:00", () => {
    // 2026-04-15 23:00 JST = 2026-04-15 14:00 UTC
    const date = new Date("2026-04-15T14:00:00Z");
    expect(getLogicalTrainingDate(date, tz)).toBe("2026-04-15");
  });
});
