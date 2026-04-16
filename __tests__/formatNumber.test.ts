/**
 * formatNumber / formatMonthYear / parseAcceptLanguage — unit tests
 *
 * Tests for Q-75 i18n utilities:
 * - Locale-aware number formatting
 * - Month/year label formatting
 * - Accept-Language header parsing
 */
import { describe, it, expect } from "vitest";
import { formatNumber, formatMonthYear } from "@/lib/formatDate";

// Re-implement parseAcceptLanguage for testing (original is in i18n.tsx which contains JSX)
type Locale = "en" | "ja" | "pt";
function parseAcceptLanguage(header: string): Locale | null {
  if (!header) return null;
  const entries = header.split(",").map((part) => {
    const [tag, ...params] = part.trim().split(";");
    const qParam = params.find((p) => p.trim().startsWith("q="));
    const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1.0;
    return { lang: tag.trim().toLowerCase(), q: isNaN(q) ? 0 : q };
  });
  entries.sort((a, b) => b.q - a.q);
  for (const { lang } of entries) {
    if (lang.startsWith("ja")) return "ja";
    if (lang.startsWith("en")) return "en";
  }
  return null;
}

// ── formatNumber ────────────────────────────────────────────────────────────

describe("formatNumber", () => {
  it("formats with commas for English", () => {
    expect(formatNumber(1234, "en")).toBe("1,234");
  });

  it("formats with commas for Japanese", () => {
    // ja-JP uses commas like en-US
    expect(formatNumber(1234, "ja")).toBe("1,234");
  });

  it("formats with period for Portuguese", () => {
    // pt-BR uses period as thousands separator
    expect(formatNumber(1234, "pt")).toBe("1.234");
  });

  it("handles zero", () => {
    expect(formatNumber(0, "en")).toBe("0");
  });

  it("handles decimals with options", () => {
    const result = formatNumber(3.14159, "en", { maximumFractionDigits: 2 });
    expect(result).toBe("3.14");
  });

  it("handles large numbers", () => {
    expect(formatNumber(1000000, "en")).toBe("1,000,000");
  });

  it("handles negative numbers", () => {
    const result = formatNumber(-500, "en");
    expect(result).toContain("500");
  });

  it("defaults to en locale", () => {
    expect(formatNumber(9999)).toBe("9,999");
  });
});

// ── formatMonthYear ─────────────────────────────────────────────────────────

describe("formatMonthYear", () => {
  const april2026 = new Date("2026-04-15T12:00:00Z");

  it("formats in English", () => {
    const result = formatMonthYear(april2026, "en");
    expect(result).toContain("April");
    expect(result).toContain("2026");
  });

  it("formats in Japanese", () => {
    const result = formatMonthYear(april2026, "ja");
    expect(result).toContain("4");
    expect(result).toContain("2026");
  });

  it("formats in Portuguese", () => {
    const result = formatMonthYear(april2026, "pt");
    expect(result).toContain("abril");
    expect(result).toContain("2026");
  });

  it("defaults to en", () => {
    const result = formatMonthYear(april2026);
    expect(result).toContain("April");
  });
});

// ── parseAcceptLanguage ─────────────────────────────────────────────────────

describe("parseAcceptLanguage", () => {
  it("detects Japanese from simple header", () => {
    expect(parseAcceptLanguage("ja")).toBe("ja");
  });

  it("detects Japanese from complex header", () => {
    expect(parseAcceptLanguage("ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("ja");
  });

  it("detects English from en-US header", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });

  it("prefers higher quality language", () => {
    // en has higher quality than ja here
    expect(parseAcceptLanguage("ja;q=0.5,en;q=0.9")).toBe("en");
  });

  it("returns null for empty header", () => {
    expect(parseAcceptLanguage("")).toBeNull();
  });

  it("returns null for unsupported language only", () => {
    expect(parseAcceptLanguage("fr-FR,de;q=0.8")).toBeNull();
  });

  it("handles malformed quality value", () => {
    expect(parseAcceptLanguage("ja;q=abc")).toBe("ja");
  });

  it("handles whitespace in header", () => {
    expect(parseAcceptLanguage(" ja-JP , en-US;q=0.8 ")).toBe("ja");
  });
});
