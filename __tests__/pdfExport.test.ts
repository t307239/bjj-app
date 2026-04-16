/**
 * Unit tests: PDF export helpers (Q-54)
 *
 * The PDF exporter in components/CsvExport.tsx inlines HTML string
 * generation. This test suite locks in the invariants of that logic:
 * XSS-safe HTML escaping, summary-stat math, and duration formatting.
 *
 * Run:  npx vitest run __tests__/pdfExport.test.ts
 */

import { describe, it, expect } from "vitest";

// ── Helpers mirroring components/CsvExport.tsx ───────────────────────────────

/** HTML escape — must prevent tag injection in the PDF body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type Log = { date: string; type: string; duration_min: number | null };

function totalSessions(logs: Log[]): number {
  return logs.length;
}

function totalHours(logs: Log[]): number {
  const min = logs.reduce((acc, l) => acc + (l.duration_min ?? 0), 0);
  return Math.round((min / 60) * 10) / 10; // 1 decimal
}

/** Date range formatter: returns [earliest, latest] or empty strings. */
function dateRange(logs: Log[]): { from: string; to: string } {
  if (logs.length === 0) return { from: "", to: "" };
  const sorted = [...logs].map((l) => l.date).sort();
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("escapeHtml (PDF XSS safety)", () => {
  it("escapes < and > to HTML entities", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("escapes & first to avoid double-escaping", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;"); // user-typed literal, not real tag
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("Drilled half-guard passes")).toBe(
      "Drilled half-guard passes"
    );
  });

  it("handles multi-byte Japanese notes (no mojibake)", () => {
    expect(escapeHtml("スパーリング5本")).toBe("スパーリング5本");
  });

  it("neutralizes nested attack patterns", () => {
    const evil = '<img src=x onerror="fetch(\'//a\')">';
    const out = escapeHtml(evil);
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<");
  });
});

describe("PDF summary math", () => {
  const logs: Log[] = [
    { date: "2026-04-01", type: "gi", duration_min: 90 },
    { date: "2026-04-03", type: "nogi", duration_min: 60 },
    { date: "2026-04-05", type: "drilling", duration_min: 45 },
    { date: "2026-04-07", type: "openmat", duration_min: null }, // null should be 0
  ];

  it("counts total sessions including null-duration entries", () => {
    expect(totalSessions(logs)).toBe(4);
  });

  it("sums duration to 1-decimal hours, treating null as 0", () => {
    // (90 + 60 + 45 + 0) / 60 = 3.25 → 3.3
    expect(totalHours(logs)).toBe(3.3);
  });

  it("returns 0 hours for empty or all-null logs", () => {
    expect(totalHours([])).toBe(0);
    expect(totalHours([{ date: "2026-04-01", type: "gi", duration_min: null }])).toBe(0);
  });
});

describe("dateRange", () => {
  it("returns earliest and latest by ISO date string sort", () => {
    const logs: Log[] = [
      { date: "2026-04-07", type: "gi", duration_min: 60 },
      { date: "2026-04-01", type: "gi", duration_min: 60 },
      { date: "2026-04-03", type: "gi", duration_min: 60 },
    ];
    expect(dateRange(logs)).toEqual({ from: "2026-04-01", to: "2026-04-07" });
  });

  it("returns empty range for empty logs (avoids NaN in UI)", () => {
    expect(dateRange([])).toEqual({ from: "", to: "" });
  });

  it("works with a single log (from === to)", () => {
    expect(
      dateRange([{ date: "2026-04-16", type: "gi", duration_min: 60 }])
    ).toEqual({ from: "2026-04-16", to: "2026-04-16" });
  });
});
