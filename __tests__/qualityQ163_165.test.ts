/**
 * Tests for Q-163 (styleAuditor), Q-164 (gestureManager), Q-165 (messageFormatter)
 * UI 93→94, UX 93→94, i18n 93→94
 */
import { describe, it, expect } from "vitest";

// ── Q-163: styleAuditor ─────────────────────────────────────────────────

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
import type { AuditViolation, StyleAuditReport } from "@/lib/styleAuditor";

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
      expect(APPROVED_COLOR_PREFIXES).toContain("red");
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
      expect(STANDARD_SPACING).toContain(8);
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

    it("all rules have description and check function", () => {
      for (const rule of AUDIT_RULES) {
        expect(rule.description.length).toBeGreaterThan(0);
        expect(typeof rule.check).toBe("function");
      }
    });
  });

  describe("auditStyles", () => {
    it("passes clean approved-only classes", () => {
      const report = auditStyles("bg-gray-900 text-zinc-400 border-emerald-500");
      expect(report.passed).toBe(true);
      expect(report.errors).toBe(0);
    });

    it("catches raw hex colors not in token list", () => {
      const report = auditStyles("bg-[#FF0000] text-zinc-400");
      expect(report.passed).toBe(false);
      expect(report.errors).toBeGreaterThan(0);
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

    it("reports correct severity counts", () => {
      const report = auditStyles("bg-[#FF0000] text-pink-500 px_4");
      expect(report.errors).toBeGreaterThanOrEqual(2); // raw-hex + px_
      expect(report.warnings).toBeGreaterThanOrEqual(1); // off-brand
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
      expect(summary.spacingScale.length).toBeGreaterThan(20);
    });
  });

  describe("formatAuditReport", () => {
    it("shows PASSED for clean report", () => {
      const report = auditStyles("bg-gray-900");
      const text = formatAuditReport(report);
      expect(text).toContain("PASSED");
    });

    it("shows FAILED for dirty report", () => {
      const report = auditStyles("bg-[#FF0000]");
      const text = formatAuditReport(report);
      expect(text).toContain("FAILED");
    });
  });
});

// ── Q-164: gestureManager ───────────────────────────────────────────────

import {
  detectSwipe,
  detectLongPress,
  detectPinch,
  classifyPinch,
  resolveGesture,
  getSwipeAxis,
  getDistance,
  createGestureConfig,
  createVelocityTracker,
  formatGestureDebug,
  DEFAULT_GESTURE_CONFIG,
} from "@/lib/gestureManager";
import type { SwipeResult, GestureConfig } from "@/lib/gestureManager";

describe("Q-164: gestureManager", () => {
  describe("DEFAULT_GESTURE_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_GESTURE_CONFIG.minSwipeDistance).toBe(50);
      expect(DEFAULT_GESTURE_CONFIG.maxSwipeTime).toBe(300);
      expect(DEFAULT_GESTURE_CONFIG.longPressDuration).toBe(500);
      expect(DEFAULT_GESTURE_CONFIG.reducedMotion).toBe(false);
    });
  });

  describe("createGestureConfig", () => {
    it("merges overrides with defaults", () => {
      const config = createGestureConfig({ minSwipeDistance: 100 });
      expect(config.minSwipeDistance).toBe(100);
      expect(config.maxSwipeTime).toBe(300); // unchanged
    });
  });

  describe("detectSwipe", () => {
    it("detects right swipe", () => {
      const result = detectSwipe(
        { x: 100, y: 200, time: 0 },
        { x: 300, y: 200, time: 150 }
      );
      expect(result.direction).toBe("right");
      expect(result.distance).toBe(200);
      expect(result.valid).toBe(true);
    });

    it("detects left swipe", () => {
      const result = detectSwipe(
        { x: 300, y: 200, time: 0 },
        { x: 50, y: 200, time: 150 }
      );
      expect(result.direction).toBe("left");
      expect(result.valid).toBe(true);
    });

    it("detects up swipe", () => {
      const result = detectSwipe(
        { x: 200, y: 300, time: 0 },
        { x: 200, y: 50, time: 150 }
      );
      expect(result.direction).toBe("up");
      expect(result.valid).toBe(true);
    });

    it("detects down swipe", () => {
      const result = detectSwipe(
        { x: 200, y: 50, time: 0 },
        { x: 200, y: 300, time: 150 }
      );
      expect(result.direction).toBe("down");
      expect(result.valid).toBe(true);
    });

    it("rejects short distance", () => {
      const result = detectSwipe(
        { x: 100, y: 200, time: 0 },
        { x: 120, y: 200, time: 50 }
      );
      expect(result.valid).toBe(false);
    });

    it("rejects slow swipe", () => {
      const result = detectSwipe(
        { x: 100, y: 200, time: 0 },
        { x: 300, y: 200, time: 5000 }
      );
      expect(result.valid).toBe(false);
    });

    it("rejects when reducedMotion is true", () => {
      const config = createGestureConfig({ reducedMotion: true });
      const result = detectSwipe(
        { x: 100, y: 200, time: 0 },
        { x: 300, y: 200, time: 150 },
        config
      );
      expect(result.valid).toBe(false);
    });

    it("provides deltaX and deltaY", () => {
      const result = detectSwipe(
        { x: 100, y: 200, time: 0 },
        { x: 300, y: 250, time: 150 }
      );
      expect(result.deltaX).toBe(200);
      expect(result.deltaY).toBe(50);
    });
  });

  describe("getSwipeAxis", () => {
    it("returns horizontal for mostly-x movement", () => {
      expect(getSwipeAxis({ x: 0, y: 0 }, { x: 100, y: 20 })).toBe("horizontal");
    });

    it("returns vertical for mostly-y movement", () => {
      expect(getSwipeAxis({ x: 0, y: 0 }, { x: 20, y: 100 })).toBe("vertical");
    });
  });

  describe("detectLongPress", () => {
    it("triggers after sufficient hold time", () => {
      const result = detectLongPress(
        { x: 100, y: 200, time: 0 },
        { x: 102, y: 201, time: 600 }
      );
      expect(result.triggered).toBe(true);
      expect(result.elapsed).toBe(600);
    });

    it("rejects if finger moved too much", () => {
      const result = detectLongPress(
        { x: 100, y: 200, time: 0 },
        { x: 200, y: 300, time: 600 }
      );
      expect(result.triggered).toBe(false);
    });

    it("rejects if too short", () => {
      const result = detectLongPress(
        { x: 100, y: 200, time: 0 },
        { x: 101, y: 200, time: 200 }
      );
      expect(result.triggered).toBe(false);
    });

    it("rejects when reducedMotion is true", () => {
      const config = createGestureConfig({ reducedMotion: true });
      const result = detectLongPress(
        { x: 100, y: 200, time: 0 },
        { x: 100, y: 200, time: 600 },
        config
      );
      expect(result.triggered).toBe(false);
    });
  });

  describe("detectPinch", () => {
    it("detects zoom-in (fingers moving apart)", () => {
      const result = detectPinch(
        { x: 100, y: 200 },
        { x: 200, y: 200 },
        { x: 50, y: 200 },
        { x: 250, y: 200 }
      );
      expect(result.scale).toBe(2);
      expect(result.valid).toBe(true);
    });

    it("detects zoom-out (fingers moving together)", () => {
      const result = detectPinch(
        { x: 0, y: 200 },
        { x: 200, y: 200 },
        { x: 75, y: 200 },
        { x: 125, y: 200 }
      );
      expect(result.scale).toBe(0.25);
      expect(result.valid).toBe(true);
    });

    it("reports center point", () => {
      const result = detectPinch(
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 50, y: 100 },
        { x: 150, y: 100 }
      );
      expect(result.center.x).toBe(100);
      expect(result.center.y).toBe(100);
    });

    it("handles zero initial distance", () => {
      const result = detectPinch(
        { x: 100, y: 100 },
        { x: 100, y: 100 },
        { x: 50, y: 100 },
        { x: 150, y: 100 }
      );
      expect(result.scale).toBe(1);
    });
  });

  describe("classifyPinch", () => {
    it("returns zoom-in for scale > 1", () => {
      const result = detectPinch(
        { x: 100, y: 200 }, { x: 200, y: 200 },
        { x: 50, y: 200 }, { x: 250, y: 200 }
      );
      expect(classifyPinch(result)).toBe("zoom-in");
    });

    it("returns zoom-out for scale < 1", () => {
      const result = detectPinch(
        { x: 0, y: 0 }, { x: 200, y: 0 },
        { x: 75, y: 0 }, { x: 125, y: 0 }
      );
      expect(classifyPinch(result)).toBe("zoom-out");
    });

    it("returns none for invalid pinch", () => {
      const config = createGestureConfig({ reducedMotion: true });
      const result = detectPinch(
        { x: 0, y: 0 }, { x: 200, y: 0 },
        { x: 50, y: 0 }, { x: 250, y: 0 },
        config
      );
      expect(classifyPinch(result)).toBe("none");
    });
  });

  describe("resolveGesture", () => {
    it("returns pinch for 2+ touch points", () => {
      const result = resolveGesture(2, 100, 50);
      expect(result.type).toBe("pinch");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("returns long-press for still hold", () => {
      const result = resolveGesture(1, 600, 5);
      expect(result.type).toBe("long-press");
    });

    it("returns swipe for quick movement", () => {
      const result = resolveGesture(1, 150, 100);
      expect(result.type).toBe("swipe");
    });

    it("returns tap for brief still touch", () => {
      const result = resolveGesture(1, 100, 3);
      expect(result.type).toBe("tap");
    });

    it("returns none for reducedMotion", () => {
      const config = createGestureConfig({ reducedMotion: true });
      const result = resolveGesture(1, 150, 100, config);
      expect(result.type).toBe("none");
    });
  });

  describe("getDistance", () => {
    it("calculates Euclidean distance", () => {
      expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    it("returns 0 for same point", () => {
      expect(getDistance({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0);
    });
  });

  describe("createVelocityTracker", () => {
    it("tracks velocity from points", () => {
      const tracker = createVelocityTracker(5);
      tracker.addPoint({ x: 0, y: 0, time: 0 });
      tracker.addPoint({ x: 100, y: 0, time: 100 });
      const vel = tracker.getVelocity();
      expect(vel.x).toBe(1); // 100px / 100ms
      expect(vel.y).toBe(0);
    });

    it("returns zero velocity with fewer than 2 points", () => {
      const tracker = createVelocityTracker();
      tracker.addPoint({ x: 0, y: 0, time: 0 });
      const vel = tracker.getVelocity();
      expect(vel.x).toBe(0);
      expect(vel.y).toBe(0);
    });

    it("resets correctly", () => {
      const tracker = createVelocityTracker();
      tracker.addPoint({ x: 0, y: 0, time: 0 });
      tracker.addPoint({ x: 100, y: 0, time: 100 });
      tracker.reset();
      const vel = tracker.getVelocity();
      expect(vel.x).toBe(0);
    });
  });

  describe("formatGestureDebug", () => {
    it("formats gesture with percentage", () => {
      const text = formatGestureDebug({ type: "swipe", confidence: 0.85 });
      expect(text).toContain("swipe");
      expect(text).toContain("85%");
    });
  });
});

// ── Q-165: messageFormatter ─────────────────────────────────────────────

import {
  formatMessage,
  formatCompiled,
  compileMessage,
  validateMessage,
  checkMissingParams,
  extractParams,
  createLocaleFormatter,
  buildMessageDiagnostic,
  getPluralCategory,
} from "@/lib/messageFormatter";
import type { CompiledMessage, MessageValues } from "@/lib/messageFormatter";

describe("Q-165: messageFormatter", () => {
  describe("getPluralCategory", () => {
    it("returns 'one' for 1 in English", () => {
      expect(getPluralCategory(1, "en")).toBe("one");
    });

    it("returns 'other' for 0 in English", () => {
      expect(getPluralCategory(0, "en")).toBe("other");
    });

    it("returns 'other' for 5 in English", () => {
      expect(getPluralCategory(5, "en")).toBe("other");
    });

    it("always returns 'other' for Japanese", () => {
      expect(getPluralCategory(0, "ja")).toBe("other");
      expect(getPluralCategory(1, "ja")).toBe("other");
      expect(getPluralCategory(5, "ja")).toBe("other");
    });

    it("returns 'one' for 0 and 1 in Portuguese", () => {
      expect(getPluralCategory(0, "pt")).toBe("one");
      expect(getPluralCategory(1, "pt")).toBe("one");
      expect(getPluralCategory(2, "pt")).toBe("other");
    });
  });

  describe("compileMessage", () => {
    it("compiles simple text as literal", () => {
      const compiled = compileMessage("Hello World");
      expect(compiled.parts.length).toBe(1);
      expect(compiled.parts[0].type).toBe("literal");
    });

    it("extracts named arguments", () => {
      const compiled = compileMessage("Hello, {name}!");
      expect(compiled.requiredParams).toContain("name");
      expect(compiled.parts.length).toBe(3);
    });

    it("parses plural arguments", () => {
      const compiled = compileMessage("{count, plural, one {# item} other {# items}}");
      expect(compiled.parts[0].type).toBe("plural");
      expect(compiled.requiredParams).toContain("count");
    });

    it("parses select arguments", () => {
      const compiled = compileMessage("{belt, select, white {Beginner} blue {Intermediate} other {Advanced}}");
      expect(compiled.parts[0].type).toBe("select");
      expect(compiled.requiredParams).toContain("belt");
    });

    it("handles escaped single quotes", () => {
      const result = formatMessage("It''s a {thing}", { thing: "test" });
      expect(result).toBe("It's a test");
    });
  });

  describe("formatMessage", () => {
    it("replaces simple parameters", () => {
      expect(formatMessage("Hello, {name}!", { name: "Toshiki" }))
        .toBe("Hello, Toshiki!");
    });

    it("handles multiple parameters", () => {
      expect(formatMessage("{a} and {b}", { a: "X", b: "Y" }))
        .toBe("X and Y");
    });

    it("leaves missing params as-is", () => {
      expect(formatMessage("Hello, {name}!"))
        .toBe("Hello, {name}!");
    });

    it("handles number values", () => {
      expect(formatMessage("Count: {n}", { n: 42 }))
        .toBe("Count: 42");
    });

    it("handles boolean values", () => {
      expect(formatMessage("Active: {flag}", { flag: true }))
        .toBe("Active: true");
    });
  });

  describe("formatMessage — plural", () => {
    it("formats English plural correctly", () => {
      const tpl = "{count, plural, one {# session} other {# sessions}}";
      expect(formatMessage(tpl, { count: 1 }, "en")).toBe("1 session");
      expect(formatMessage(tpl, { count: 5 }, "en")).toBe("5 sessions");
    });

    it("formats Japanese plural (always other)", () => {
      const tpl = "{count, plural, other {#回}}";
      expect(formatMessage(tpl, { count: 1 }, "ja")).toBe("1回");
      expect(formatMessage(tpl, { count: 5 }, "ja")).toBe("5回");
    });

    it("handles exact match =0", () => {
      const tpl = "{count, plural, =0 {No items} one {# item} other {# items}}";
      expect(formatMessage(tpl, { count: 0 }, "en")).toBe("No items");
    });

    it("handles offset", () => {
      const tpl = "{count, plural, offset:1 one {# other person} other {# other people}}";
      expect(formatMessage(tpl, { count: 2 }, "en")).toBe("1 other person");
      expect(formatMessage(tpl, { count: 5 }, "en")).toBe("4 other people");
    });
  });

  describe("formatMessage — select", () => {
    it("selects matching option", () => {
      const tpl = "{belt, select, white {Beginner} blue {Intermediate} other {Advanced}}";
      expect(formatMessage(tpl, { belt: "white" })).toBe("Beginner");
      expect(formatMessage(tpl, { belt: "blue" })).toBe("Intermediate");
    });

    it("falls back to other", () => {
      const tpl = "{belt, select, white {Beginner} other {Advanced}}";
      expect(formatMessage(tpl, { belt: "purple" })).toBe("Advanced");
    });
  });

  describe("formatCompiled", () => {
    it("reuses compiled message", () => {
      const compiled = compileMessage("Hello, {name}!");
      expect(formatCompiled(compiled, { name: "A" })).toBe("Hello, A!");
      expect(formatCompiled(compiled, { name: "B" })).toBe("Hello, B!");
    });
  });

  describe("validateMessage", () => {
    it("passes valid template", () => {
      const result = validateMessage("Hello, {name}!");
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("fails on unbalanced braces", () => {
      const result = validateMessage("Hello, {name!");
      expect(result.valid).toBe(false);
    });

    it("warns about missing other in plural", () => {
      const result = validateMessage("{count, plural, one {# item}}");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("other"))).toBe(true);
    });

    it("warns about missing other in select", () => {
      const result = validateMessage("{x, select, a {A}}");
      expect(result.valid).toBe(false);
    });
  });

  describe("checkMissingParams", () => {
    it("finds missing parameters", () => {
      const compiled = compileMessage("{a} and {b}");
      const missing = checkMissingParams(compiled, { a: "X" });
      expect(missing).toEqual(["b"]);
    });

    it("returns empty when all provided", () => {
      const compiled = compileMessage("{a} and {b}");
      const missing = checkMissingParams(compiled, { a: "X", b: "Y" });
      expect(missing).toEqual([]);
    });
  });

  describe("extractParams", () => {
    it("extracts all parameter names", () => {
      const params = extractParams("{a} loves {b}");
      expect(params).toContain("a");
      expect(params).toContain("b");
    });
  });

  describe("createLocaleFormatter", () => {
    it("creates a locale-bound formatter", () => {
      const jaFormat = createLocaleFormatter("ja");
      const result = jaFormat("{count, plural, other {#件}}", { count: 3 });
      expect(result).toBe("3件");
    });
  });

  describe("buildMessageDiagnostic", () => {
    it("returns comprehensive diagnostic", () => {
      const diag = buildMessageDiagnostic("{count, plural, one {# item} other {# items}}");
      expect(diag.paramCount).toBe(1);
      expect(diag.hasPluralRules).toBe(true);
      expect(diag.hasSelectRules).toBe(false);
      expect(diag.validation.valid).toBe(true);
    });
  });
});

// ── Barrel Export Tests ─────────────────────────────────────────────────

describe("Barrel exports for Q-163~Q-165", () => {
  it("exports styleAuditor symbols", async () => {
    const mod = await import("@/lib/index");
    expect(mod.auditStyles).toBeDefined();
    expect(mod.APPROVED_COLORS).toBeDefined();
    expect(mod.AUDIT_RULES).toBeDefined();
    expect(mod.formatAuditReport).toBeDefined();
  }, 30000);

  it("exports gestureManager symbols", async () => {
    const mod = await import("@/lib/index");
    expect(mod.detectSwipe).toBeDefined();
    expect(mod.detectLongPress).toBeDefined();
    expect(mod.detectPinch).toBeDefined();
    expect(mod.resolveGesture).toBeDefined();
    expect(mod.DEFAULT_GESTURE_CONFIG).toBeDefined();
  }, 30000);

  it("exports messageFormatter symbols", async () => {
    const mod = await import("@/lib/index");
    expect(mod.formatMessage).toBeDefined();
    expect(mod.compileMessage).toBeDefined();
    expect(mod.validateMessage).toBeDefined();
    expect(mod.getPluralCategory).toBeDefined();
  }, 30000);
});
