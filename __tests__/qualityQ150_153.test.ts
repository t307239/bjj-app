/**
 * __tests__/qualityQ150_153.test.ts
 *
 * Q-150: UI — responsiveValidator (layout validation)
 * Q-151: UX — formValidator (form validation UX)
 * Q-152: i18n — pluralRules (ICU plural/ordinal)
 * Q-153: Data — dataIntegrityChecker (cross-table integrity)
 */
import { describe, it, expect } from "vitest";

// ── Q-150: Responsive Validator ─────────────────────────────────────────

import {
  validateLayout,
  checkBreakpointCoverage,
  calculateCoverage,
  buildResponsiveReport,
  getViewportCategory,
  formatResponsiveReport,
  VIEWPORT_PRESETS,
  TAILWIND_BREAKPOINTS,
  LAYOUT_RULES,
} from "@/lib/responsiveValidator";
import type { LayoutMeasurement, ViewportSize } from "@/lib/responsiveValidator";

const mobileViewport: ViewportSize = VIEWPORT_PRESETS[0]; // iPhone SE 320px
const desktopViewport: ViewportSize = VIEWPORT_PRESETS[6]; // Desktop 1920px

const goodMeasurement: LayoutMeasurement = {
  elementId: "btn-submit",
  width: 200,
  height: 48,
  overflows: false,
  textTruncated: false,
  touchTargetOk: true,
  fontSize: 16,
};

describe("Q-150: Responsive Validator", () => {
  describe("constants", () => {
    it("VIEWPORT_PRESETS has mobile/tablet/desktop", () => {
      const categories = new Set(VIEWPORT_PRESETS.map((v) => v.category));
      expect(categories).toContain("mobile");
      expect(categories).toContain("tablet");
      expect(categories).toContain("desktop");
    });

    it("TAILWIND_BREAKPOINTS has standard breakpoints", () => {
      expect(TAILWIND_BREAKPOINTS.sm).toBe(640);
      expect(TAILWIND_BREAKPOINTS.md).toBe(768);
      expect(TAILWIND_BREAKPOINTS.lg).toBe(1024);
    });

    it("LAYOUT_RULES has sensible defaults", () => {
      expect(LAYOUT_RULES.minTouchTarget).toBe(44);
      expect(LAYOUT_RULES.minFontSize).toBe(12);
    });
  });

  describe("validateLayout", () => {
    it("returns no issues for good measurements", () => {
      const issues = validateLayout([goodMeasurement], mobileViewport);
      expect(issues).toHaveLength(0);
    });

    it("detects overflow", () => {
      const issues = validateLayout(
        [{ ...goodMeasurement, overflows: true }],
        mobileViewport,
      );
      expect(issues.some((i) => i.rule === "no-overflow")).toBe(true);
      expect(issues[0].severity).toBe("critical");
    });

    it("detects small touch target on mobile", () => {
      const issues = validateLayout(
        [{ ...goodMeasurement, touchTargetOk: false }],
        mobileViewport,
      );
      expect(issues.some((i) => i.rule === "touch-target")).toBe(true);
    });

    it("skips touch target check on desktop", () => {
      const issues = validateLayout(
        [{ ...goodMeasurement, touchTargetOk: false }],
        desktopViewport,
      );
      expect(issues.some((i) => i.rule === "touch-target")).toBe(false);
    });

    it("detects small font size", () => {
      const issues = validateLayout(
        [{ ...goodMeasurement, fontSize: 8 }],
        mobileViewport,
      );
      expect(issues.some((i) => i.rule === "min-font-size")).toBe(true);
    });

    it("detects element wider than viewport", () => {
      const issues = validateLayout(
        [{ ...goodMeasurement, width: 500 }],
        mobileViewport,
      );
      expect(issues.some((i) => i.rule === "max-width")).toBe(true);
    });
  });

  describe("checkBreakpointCoverage", () => {
    it("marks covered breakpoints", () => {
      const coverage = checkBreakpointCoverage(["sm", "md"]);
      expect(coverage.find((c) => c.breakpoint === "sm")?.hasCoverage).toBe(true);
      expect(coverage.find((c) => c.breakpoint === "lg")?.hasCoverage).toBe(false);
    });
  });

  describe("calculateCoverage", () => {
    it("returns 100% for all breakpoints", () => {
      expect(calculateCoverage(Object.keys(TAILWIND_BREAKPOINTS))).toBe(100);
    });

    it("returns 0% for no breakpoints", () => {
      expect(calculateCoverage([])).toBe(0);
    });
  });

  describe("getViewportCategory", () => {
    it("classifies widths correctly", () => {
      expect(getViewportCategory(320)).toBe("mobile");
      expect(getViewportCategory(768)).toBe("tablet");
      expect(getViewportCategory(1920)).toBe("desktop");
    });
  });

  describe("buildResponsiveReport / formatResponsiveReport", () => {
    it("builds passing report", () => {
      const report = buildResponsiveReport([goodMeasurement], mobileViewport);
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
      expect(report.issues).toHaveLength(0);
    });

    it("builds failing report", () => {
      const report = buildResponsiveReport(
        [{ ...goodMeasurement, overflows: true }],
        mobileViewport,
      );
      expect(report.passed).toBe(false);
      expect(report.score).toBeLessThan(100);
    });

    it("formats report", () => {
      const report = buildResponsiveReport([goodMeasurement], mobileViewport);
      const formatted = formatResponsiveReport(report);
      expect(formatted).toContain("iPhone SE");
      expect(formatted).toContain("✅");
    });
  });

  it("barrel exports work", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("validateLayout");
    expect(idx).toContain("VIEWPORT_PRESETS");
    expect(idx).toContain("TAILWIND_BREAKPOINTS");
  });
});

// ── Q-151: Form Validator ───────────────────────────────────────────────

import {
  validateField,
  validateForm,
  getErrorAnnouncement,
  getFieldAriaProps,
  createRule,
  combineRules,
  formatValidationSummary,
  VALIDATION_RULES,
  ANNOUNCE_DELAY_MS,
} from "@/lib/formValidator";

describe("Q-151: Form Validator", () => {
  describe("VALIDATION_RULES", () => {
    it("has standard rules", () => {
      expect(VALIDATION_RULES.required).toBeDefined();
      expect(VALIDATION_RULES.email).toBeDefined();
      expect(VALIDATION_RULES.numericPositive).toBeDefined();
    });

    it("required catches empty string", () => {
      expect(VALIDATION_RULES.required.validate("")).not.toBeNull();
      expect(VALIDATION_RULES.required.validate("  ")).not.toBeNull();
      expect(VALIDATION_RULES.required.validate("hello")).toBeNull();
    });

    it("email validates format", () => {
      expect(VALIDATION_RULES.email.validate("")).toBeNull(); // empty ok (required handles)
      expect(VALIDATION_RULES.email.validate("test@example.com")).toBeNull();
      expect(VALIDATION_RULES.email.validate("invalid")).not.toBeNull();
    });

    it("numericPositive validates numbers", () => {
      expect(VALIDATION_RULES.numericPositive.validate("5")).toBeNull();
      expect(VALIDATION_RULES.numericPositive.validate("-1")).not.toBeNull();
      expect(VALIDATION_RULES.numericPositive.validate("abc")).not.toBeNull();
      expect(VALIDATION_RULES.numericPositive.validate("")).toBeNull();
    });

    it("dateNotFuture validates dates", () => {
      expect(VALIDATION_RULES.dateNotFuture.validate("2020-01-01")).toBeNull();
      expect(VALIDATION_RULES.dateNotFuture.validate("2099-01-01")).not.toBeNull();
    });
  });

  describe("validateField", () => {
    it("returns valid for passing value", () => {
      const result = validateField("email", "test@example.com", [VALIDATION_RULES.required, VALIDATION_RULES.email]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("returns first error by priority", () => {
      const result = validateField("email", "", [VALIDATION_RULES.email, VALIDATION_RULES.required]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required"); // priority 0 runs first
    });
  });

  describe("validateForm", () => {
    it("validates all fields", () => {
      const result = validateForm([
        { name: "name", value: "John", touched: true, rules: [VALIDATION_RULES.required] },
        { name: "email", value: "j@e.com", touched: true, rules: [VALIDATION_RULES.required, VALIDATION_RULES.email] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it("finds first error field", () => {
      const result = validateForm([
        { name: "name", value: "", touched: true, rules: [VALIDATION_RULES.required] },
        { name: "email", value: "bad", touched: true, rules: [VALIDATION_RULES.email] },
      ]);
      expect(result.valid).toBe(false);
      expect(result.firstErrorField).toBe("name");
      expect(result.errorCount).toBe(2);
    });
  });

  describe("getErrorAnnouncement", () => {
    it("returns empty for no errors", () => {
      expect(getErrorAnnouncement({ field1: { field: "field1", valid: true, error: null, touched: true } })).toBe("");
    });

    it("returns single error message", () => {
      const announcement = getErrorAnnouncement({
        email: { field: "email", valid: false, error: "Required", touched: true },
      });
      expect(announcement).toContain("email");
      expect(announcement).toContain("Required");
    });

    it("returns count for multiple errors", () => {
      const announcement = getErrorAnnouncement({
        name: { field: "name", valid: false, error: "Required", touched: true },
        email: { field: "email", valid: false, error: "Invalid", touched: true },
      });
      expect(announcement).toContain("2 errors");
    });
  });

  describe("getFieldAriaProps", () => {
    it("sets aria-invalid for errors", () => {
      const props = getFieldAriaProps(
        { field: "name", valid: false, error: "Required", touched: true },
        "name-error",
      );
      expect(props["aria-invalid"]).toBe(true);
      expect(props["aria-describedby"]).toBe("name-error");
    });

    it("unsets aria-invalid when valid", () => {
      const props = getFieldAriaProps(
        { field: "name", valid: true, error: null, touched: true },
        "name-error",
      );
      expect(props["aria-invalid"]).toBe(false);
    });
  });

  describe("createRule / combineRules", () => {
    it("creates custom rule", () => {
      const rule = createRule("custom", (v) => (v === "bad" ? "Bad value" : null));
      expect(rule.validate("bad")).toBe("Bad value");
      expect(rule.validate("good")).toBeNull();
    });

    it("combines and sorts rules", () => {
      const rules = combineRules(
        createRule("b", () => null, 2),
        createRule("a", () => null, 1),
      );
      expect(rules[0].id).toBe("a");
    });
  });

  describe("formatValidationSummary", () => {
    it("formats valid form", () => {
      const form = validateForm([{ name: "x", value: "ok", touched: true, rules: [VALIDATION_RULES.required] }]);
      expect(formatValidationSummary(form)).toContain("✅");
    });

    it("formats invalid form", () => {
      const form = validateForm([{ name: "x", value: "", touched: true, rules: [VALIDATION_RULES.required] }]);
      expect(formatValidationSummary(form)).toContain("❌");
    });
  });

  it("ANNOUNCE_DELAY_MS is positive", () => {
    expect(ANNOUNCE_DELAY_MS).toBeGreaterThan(0);
  });

  it("barrel exports work", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("validateForm");
    expect(idx).toContain("VALIDATION_RULES");
  });
});

// ── Q-152: Plural Rules ─────────────────────────────────────────────────

import {
  selectPlural,
  getPluralCategory,
  getOrdinalCategory,
  formatOrdinal,
  formatCount,
  formatCompact,
  isSupportedLocale,
  PLURAL_RULES,
  COUNT_FORMATS,
  EN_ORDINAL_SUFFIXES,
} from "@/lib/pluralRules";

describe("Q-152: Plural Rules", () => {
  describe("PLURAL_RULES", () => {
    it("has rules for en/ja/pt", () => {
      expect(PLURAL_RULES.en).toBeDefined();
      expect(PLURAL_RULES.ja).toBeDefined();
      expect(PLURAL_RULES.pt).toBeDefined();
    });

    it("EN cardinal: 1=one, else=other", () => {
      expect(PLURAL_RULES.en.cardinal(1)).toBe("one");
      expect(PLURAL_RULES.en.cardinal(0)).toBe("other");
      expect(PLURAL_RULES.en.cardinal(2)).toBe("other");
      expect(PLURAL_RULES.en.cardinal(100)).toBe("other");
    });

    it("JA cardinal: always other", () => {
      expect(PLURAL_RULES.ja.cardinal(0)).toBe("other");
      expect(PLURAL_RULES.ja.cardinal(1)).toBe("other");
      expect(PLURAL_RULES.ja.cardinal(99)).toBe("other");
    });

    it("PT cardinal: 0-1=one, else=other", () => {
      expect(PLURAL_RULES.pt.cardinal(0)).toBe("one");
      expect(PLURAL_RULES.pt.cardinal(1)).toBe("one");
      expect(PLURAL_RULES.pt.cardinal(2)).toBe("other");
    });

    it("EN ordinal: 1st/2nd/3rd/4th patterns", () => {
      expect(PLURAL_RULES.en.ordinal(1)).toBe("one");   // 1st
      expect(PLURAL_RULES.en.ordinal(2)).toBe("two");   // 2nd
      expect(PLURAL_RULES.en.ordinal(3)).toBe("few");   // 3rd
      expect(PLURAL_RULES.en.ordinal(4)).toBe("other"); // 4th
      expect(PLURAL_RULES.en.ordinal(11)).toBe("other"); // 11th (exception)
      expect(PLURAL_RULES.en.ordinal(12)).toBe("other"); // 12th
      expect(PLURAL_RULES.en.ordinal(13)).toBe("other"); // 13th
      expect(PLURAL_RULES.en.ordinal(21)).toBe("one");   // 21st
    });
  });

  describe("selectPlural", () => {
    it("selects correct form for EN", () => {
      const msgs = { one: "{count} session", other: "{count} sessions" };
      expect(selectPlural("en", 1, msgs)).toBe("1 session");
      expect(selectPlural("en", 5, msgs)).toBe("5 sessions");
    });

    it("selects correct form for JA", () => {
      const msgs = { other: "{count}回" };
      expect(selectPlural("ja", 1, msgs)).toBe("1回");
      expect(selectPlural("ja", 5, msgs)).toBe("5回");
    });

    it("falls back to other", () => {
      expect(selectPlural("en", 1, { other: "fallback" })).toBe("fallback");
    });
  });

  describe("formatOrdinal", () => {
    it("formats EN ordinals", () => {
      expect(formatOrdinal("en", 1)).toBe("1st");
      expect(formatOrdinal("en", 2)).toBe("2nd");
      expect(formatOrdinal("en", 3)).toBe("3rd");
      expect(formatOrdinal("en", 4)).toBe("4th");
      expect(formatOrdinal("en", 11)).toBe("11th");
      expect(formatOrdinal("en", 21)).toBe("21st");
    });

    it("formats JA ordinals", () => {
      expect(formatOrdinal("ja", 1)).toBe("1番目");
    });

    it("formats PT ordinals", () => {
      expect(formatOrdinal("pt", 1)).toBe("1º");
    });
  });

  describe("formatCount", () => {
    it("formats with EN separators", () => {
      expect(formatCount("en", 1234567)).toBe("1,234,567");
    });

    it("formats with PT separators", () => {
      expect(formatCount("pt", 1234567)).toBe("1.234.567");
    });

    it("handles negative numbers", () => {
      expect(formatCount("en", -1000)).toBe("-1,000");
    });

    it("handles small numbers", () => {
      expect(formatCount("en", 42)).toBe("42");
    });
  });

  describe("formatCompact", () => {
    it("formats thousands", () => {
      expect(formatCompact("en", 1500)).toBe("1.5K");
      expect(formatCompact("ja", 1500)).toBe("1.5千");
    });

    it("formats millions", () => {
      expect(formatCompact("en", 2500000)).toBe("2.5M");
    });

    it("returns raw for small numbers", () => {
      expect(formatCompact("en", 999)).toBe("999");
    });
  });

  describe("isSupportedLocale", () => {
    it("returns true for supported", () => {
      expect(isSupportedLocale("en")).toBe(true);
      expect(isSupportedLocale("ja")).toBe(true);
      expect(isSupportedLocale("pt")).toBe(true);
    });

    it("returns false for unsupported", () => {
      expect(isSupportedLocale("fr")).toBe(false);
    });
  });

  it("barrel exports work", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("selectPlural");
    expect(idx).toContain("PLURAL_RULES");
    expect(idx).toContain("formatOrdinal");
  });
});

// ── Q-153: Data Integrity Checker ───────────────────────────────────────

import {
  defineCheck,
  evaluateResults,
  getChecksForTable,
  getChecksByCategory,
  buildIntegrityReport,
  formatIntegrityReport,
  INTEGRITY_CHECKS,
  MAX_SAMPLES,
} from "@/lib/dataIntegrityChecker";

describe("Q-153: Data Integrity Checker", () => {
  describe("INTEGRITY_CHECKS", () => {
    it("has at least 8 checks", () => {
      expect(Object.keys(INTEGRITY_CHECKS).length).toBeGreaterThanOrEqual(8);
    });

    it("each check has required fields", () => {
      Object.values(INTEGRITY_CHECKS).forEach((c) => {
        expect(c.id).toBeTruthy();
        expect(c.name).toBeTruthy();
        expect(c.tables.length).toBeGreaterThan(0);
        expect(["critical", "warning", "info"]).toContain(c.severity);
      });
    });

    it("covers multiple categories", () => {
      const categories = new Set(Object.values(INTEGRITY_CHECKS).map((c) => c.category));
      expect(categories.size).toBeGreaterThanOrEqual(4);
    });
  });

  describe("evaluateResults", () => {
    const check = INTEGRITY_CHECKS.orphanTrainingLogs;

    it("passes with no violations", () => {
      const result = evaluateResults(check, []);
      expect(result.passed).toBe(true);
      expect(result.violationCount).toBe(0);
    });

    it("fails with violations above threshold", () => {
      const result = evaluateResults(check, ["id1", "id2"]);
      expect(result.passed).toBe(false);
      expect(result.violationCount).toBe(2);
    });

    it("limits samples", () => {
      const ids = Array.from({ length: 20 }, (_, i) => `id${i}`);
      const result = evaluateResults(check, ids);
      expect(result.samples).toHaveLength(MAX_SAMPLES);
    });

    it("passes when violations within threshold", () => {
      const check = INTEGRITY_CHECKS.duplicatePushEndpoints; // threshold=5
      const result = evaluateResults(check, ["id1", "id2"]);
      expect(result.passed).toBe(true);
    });
  });

  describe("getChecksForTable / getChecksByCategory", () => {
    it("finds checks for profiles table", () => {
      const checks = getChecksForTable("profiles");
      expect(checks.length).toBeGreaterThanOrEqual(3);
    });

    it("finds checks by category", () => {
      const orphanChecks = getChecksByCategory("orphan");
      expect(orphanChecks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("defineCheck", () => {
    it("creates check with default threshold", () => {
      const check = defineCheck({
        id: "custom",
        name: "Custom Check",
        description: "Test",
        tables: ["test"],
        severity: "info",
        category: "range",
        queryHint: "SELECT 1",
      });
      expect(check.threshold).toBe(0);
    });
  });

  describe("buildIntegrityReport", () => {
    it("builds healthy report", () => {
      const results = [
        evaluateResults(INTEGRITY_CHECKS.orphanTrainingLogs, []),
        evaluateResults(INTEGRITY_CHECKS.invalidBeltValues, []),
      ];
      const report = buildIntegrityReport(results);
      expect(report.health).toBe("healthy");
      expect(report.score).toBe(100);
      expect(report.passedChecks).toBe(2);
    });

    it("builds critical report", () => {
      const results = [
        evaluateResults(INTEGRITY_CHECKS.orphanTrainingLogs, ["id1"]),
        evaluateResults(INTEGRITY_CHECKS.invalidBeltValues, []),
      ];
      const report = buildIntegrityReport(results);
      expect(report.health).toBe("critical");
      expect(report.score).toBe(50);
    });

    it("builds degraded report (warning only)", () => {
      const results = [
        evaluateResults(INTEGRITY_CHECKS.invalidBeltValues, ["id1"]), // warning
        evaluateResults(INTEGRITY_CHECKS.futureTrainingDates, []), // ok
      ];
      const report = buildIntegrityReport(results);
      expect(report.health).toBe("degraded");
    });
  });

  describe("formatIntegrityReport", () => {
    it("formats healthy report", () => {
      const report = buildIntegrityReport([
        evaluateResults(INTEGRITY_CHECKS.orphanTrainingLogs, []),
      ]);
      const formatted = formatIntegrityReport(report);
      expect(formatted).toContain("HEALTHY");
      expect(formatted).toContain("✅");
    });

    it("formats failing report with details", () => {
      const report = buildIntegrityReport([
        evaluateResults(INTEGRITY_CHECKS.orphanTrainingLogs, ["id1"]),
      ]);
      const formatted = formatIntegrityReport(report);
      expect(formatted).toContain("CRITICAL");
      expect(formatted).toContain("Failed checks");
    });
  });

  it("barrel exports work", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("evaluateResults");
    expect(idx).toContain("INTEGRITY_CHECKS");
    expect(idx).toContain("buildIntegrityReport");
  });
});
