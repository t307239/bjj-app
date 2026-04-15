/**
 * Q-24: Unit tests for locale-aware date formatting utilities.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatDateShort,
  formatDateLong,
  formatRelativeTime,
  formatTime,
} from "@/lib/formatDate";

// ─── formatDateShort ────────────────────────────────────────────────────────
describe("formatDateShort", () => {
  const iso = "2026-04-15T10:30:00Z";

  it("formats in English", () => {
    const result = formatDateShort(iso, "en");
    expect(result).toContain("Apr");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });

  it("formats in Japanese", () => {
    const result = formatDateShort(iso, "ja");
    expect(result).toContain("2026");
    expect(result).toContain("4");
  });

  it("formats in Portuguese", () => {
    const result = formatDateShort(iso, "pt");
    expect(result).toContain("2026");
    expect(result).toContain("15");
  });

  it("accepts Date object", () => {
    const date = new Date("2026-04-15T10:30:00Z");
    const result = formatDateShort(date, "en");
    expect(result).toContain("2026");
  });

  it("defaults to en locale", () => {
    const result = formatDateShort(iso);
    expect(result).toContain("Apr");
  });

  it("handles invalid date string gracefully", () => {
    const result = formatDateShort("not-a-date", "en");
    // Should return fallback (slice or "—")
    expect(typeof result).toBe("string");
  });
});

// ─── formatDateLong ─────────────────────────────────────────────────────────
describe("formatDateLong", () => {
  const iso = "2026-04-15T10:30:00Z";

  it("includes weekday in English", () => {
    const result = formatDateLong(iso, "en");
    expect(result).toContain("Wednesday");
    expect(result).toContain("April");
    expect(result).toContain("2026");
  });

  it("includes weekday in Japanese", () => {
    const result = formatDateLong(iso, "ja");
    expect(result).toContain("水曜日");
    expect(result).toContain("2026");
  });

  it("includes weekday in Portuguese", () => {
    const result = formatDateLong(iso, "pt");
    expect(result).toMatch(/quarta/i);
    expect(result).toContain("2026");
  });
});

// ─── formatRelativeTime ─────────────────────────────────────────────────────
describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T10:30:00Z"));
    const result = formatRelativeTime("2026-04-15T10:15:00Z", "en");
    expect(result).toContain("15");
    expect(result).toMatch(/minute/i);
  });

  it("formats hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T15:00:00Z"));
    const result = formatRelativeTime("2026-04-15T10:00:00Z", "en");
    expect(result).toContain("5");
    expect(result).toMatch(/hour/i);
  });

  it("formats days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T10:00:00Z"));
    const result = formatRelativeTime("2026-04-15T10:00:00Z", "en");
    expect(result).toContain("3");
    expect(result).toMatch(/day/i);
  });

  it("formats weeks ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T10:00:00Z"));
    const result = formatRelativeTime("2026-04-15T10:00:00Z", "en");
    expect(result).toContain("2");
    expect(result).toMatch(/week/i);
  });

  it("formats in Japanese", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T10:00:00Z"));
    const result = formatRelativeTime("2026-04-15T10:00:00Z", "ja");
    expect(result).toContain("3");
    expect(result).toMatch(/日前/);
  });

  it("formats in Portuguese", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T10:00:00Z"));
    const result = formatRelativeTime("2026-04-15T10:00:00Z", "pt");
    expect(result).toMatch(/há 3 dias/i);
  });
});

// ─── formatTime ─────────────────────────────────────────────────────────────
describe("formatTime", () => {
  it("formats time in English (12h or 24h depending on locale)", () => {
    const result = formatTime("2026-04-15T14:30:00Z", "en");
    // en-US typically uses 12h format: "2:30 PM"
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats time in Japanese (24h)", () => {
    const result = formatTime("2026-04-15T14:30:00Z", "ja");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
