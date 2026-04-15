import { describe, it, expect, vi, afterEach } from "vitest";
import { calcBjjDuration, formatBjjDuration } from "@/lib/bjjDuration";

describe("calcBjjDuration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 months for a start date in the current month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15"));

    const result = calcBjjDuration("2026-04-01");
    expect(result.totalMonths).toBe(0);
    expect(result.years).toBe(0);
    expect(result.months).toBe(0);
  });

  it("calculates months correctly within the same year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15"));

    const result = calcBjjDuration("2026-01-15");
    expect(result.totalMonths).toBe(3);
    expect(result.years).toBe(0);
    expect(result.months).toBe(3);
  });

  it("calculates years and months across year boundaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15"));

    const result = calcBjjDuration("2024-06-15");
    expect(result.totalMonths).toBe(22);
    expect(result.years).toBe(1);
    expect(result.months).toBe(10);
  });

  it("returns exact years with 0 remaining months", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15"));

    const result = calcBjjDuration("2024-04-01");
    expect(result.totalMonths).toBe(24);
    expect(result.years).toBe(2);
    expect(result.months).toBe(0);
  });

  it("returns 0 for future start dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15"));

    const result = calcBjjDuration("2027-01-01");
    expect(result.totalMonths).toBe(0);
  });
});

describe("formatBjjDuration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const mockT = (key: string, vars?: Record<string, string | number>) => {
    if (key === "profile.bjjHistoryJustStarted") return "Just started";
    if (key === "profile.bjjHistoryMonths") return `${vars?.n} months`;
    if (key === "profile.bjjHistoryYears") return `${vars?.n} years`;
    if (key === "profile.bjjHistoryYearsMonths")
      return `${vars?.y} years ${vars?.m} months`;
    return key;
  };

  it("returns 'Just started' for 0 months", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15"));
    expect(formatBjjDuration("2026-04-01", mockT)).toBe("Just started");
  });

  it("returns months only when less than 1 year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15"));
    expect(formatBjjDuration("2026-01-01", mockT)).toBe("3 months");
  });

  it("returns years only when months remainder is 0", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15"));
    expect(formatBjjDuration("2024-04-01", mockT)).toBe("2 years");
  });

  it("returns years and months combined", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15"));
    expect(formatBjjDuration("2024-06-01", mockT)).toBe("1 years 10 months");
  });
});
