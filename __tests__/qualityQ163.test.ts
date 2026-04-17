/**
 * Tests for Q-163: styleAuditor (UI 93→94)
 */
import { describe, it, expect } from "vitest";
import {
  auditStyles,
  auditMultipleStyles,
  getTokenSummary,
  formatAuditReport,
  APPROVED_COLORS,
  APPROVED_COLOR_PREFIXES,
  FORBIDDEN_COLOR_PATTERNS,
  STANDARD_SPACING,
  AUDIT_RULES,
} from "@/lib/styleAuditor";

describe("Q-163: styleAuditor", () => {
  describe("APPROVED_COLORS", () => {
    it("contains core brand colors", () => {
      expect(APPROVED_COLORS["#10B981"]).toBeDefined();
      expect(APPROVED_COLORS["#0B1120"]).toBeDefined();
      expect(APPROVED_COLORS["#EF4444"]).toBeDefined();
    });

    it("all entries have token descriptions", () => {
      for (const [hex, desc] of Object.entries(APPROVED_COLORS)) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  });

  describe("APPROVED_COLOR_PREFIXES", () => {
    it("includes core palette", () => {
      expect(APPROVED_COLOR_PREFIXES).toContain("zinc");
      expect(APPROVED_COLOR_PREFIXES).toContain("emerald");
    });

    it("does not overlap with forbidden", () => {
      for (const prefix of APPROVED_COLOR_PREFIXES) {
        expect(FORBIDDEN_COLOR_PATTERNS).not.toContain(prefix);
      }
    });
  });

  describe("STANDARD_SPACING", () => {
    it("starts at 0 and includes common values", () => {
      expect(STANDARD_SPACING[0]).toBe(0);
      expect(STANDARD_SPACING).toContain(4);
      expect(STANDARD_SPACING).toContain(16);
    });

    it("is sorted ascending", () => {
      for (let i = 1; i < STANDARD_SPACING.length; i++) {
        expect(STANDARD_SPACING[i]).toBeGreaterThan(STANDARD_SPACING[i - 1]);
      }
    });
  });

  describe("AUDIT_RULES", () => {
    it("has 6 rules with unique IDs", () => {
      expect(AUDIT_RULES.length).toBe(6);
      const ids = AUDIT_RULES.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("auditStyles", () => {
    it("passes clean classes", () => {
      const report = auditStyles("bg-gray-900 text-zinc-400 border-emerald-500");
      expect(report.passed).toBe(true);
      expect(report.errors).toBe(0);
    });

    it("catches raw hex colors not in token list", () => {
      const report = auditStyles("bg-[#FF0000] text-zinc-400");
      expect(report.passed).toBe(false);
      expect(report.violations[0].rule).toBe("no-raw-hex");
    });

    it("allows approved hex colors", () => {
      const report = auditStyles("bg-[#0B1120] text-[#10B981]");
      const hexErrors = report.violations.filter((v) => v.rule === "no-raw-hex");
      expect(hexErrors.length).toBe(0);
    });

    it("catches off-brand colors", () => {
      const report = auditStyles("text-pink-500 bg-cyan-200");
      const offBrand = report.violations.filter((v) => v.rule === "no-off-brand-color");
      expect(offBrand.length).toBe(2);
    });

    it("catches px_ typos", () => {
      const report = auditStyles("px_4 py-2");
      const typos = report.violations.filter((v) => v.rule === "no-px-underscore");
      expect(typos.length).toBe(1);
      expect(typos[0].suggestion).toBe("px-4");
    });

    it("catches arbitrary spacing", () => {
      const report = auditStyles("p-[13px] m-4");
      const spacing = report.violations.filter((v) => v.rule === "no-arbitrary-spacing");
      expect(spacing.length).toBe(1);
    });

    it("returns empty violations for empty input", () => {
      const report = auditStyles("");
      expect(report.totalViolations).toBe(0);
      expect(report.passed).toBe(true);
    });
  });

  describe("auditMultipleStyles", () => {
    it("aggregates from multiple sources", () => {
      const report = auditMultipleStyles([
        { source: "Button.tsx", classes: "bg-[#FF0000]" },
        { source: "Card.tsx", classes: "text-pink-500" },
      ]);
      expect(report.totalViolations).toBe(2);
      expect(Object.keys(report.bySource).length).toBe(2);
    });

    it("skips clean sources in bySource", () => {
      const report = auditMultipleStyles([
        { source: "Clean.tsx", classes: "bg-gray-900" },
        { source: "Dirty.tsx", classes: "bg-[#FF0000]" },
      ]);
      expect(report.bySource["Clean.tsx"]).toBeUndefined();
      expect(report.bySource["Dirty.tsx"]).toBeDefined();
    });
  });

  describe("getTokenSummary", () => {
    it("returns system overview", () => {
      const summary = getTokenSummary();
      expect(summary.approvedColors).toBeGreaterThan(0);
      expect(summary.rulesCount).toBe(6);
    });
  });

  describe("formatAuditReport", () => {
    it("shows PASSED for clean report", () => {
      const text = formatAuditReport(auditStyles("bg-gray-900"));
      expect(text).toContain("PASSED");
    });

    it("shows FAILED for dirty report", () => {
      const text = formatAuditReport(auditStyles("bg-[#FF0000]"));
      expect(text).toContain("FAILED");
    });
  });

  it("barrel: lib/index.ts exports styleAuditor symbols", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(content).toContain("auditStyles");
    expect(content).toContain("APPROVED_COLORS");
  });
});
