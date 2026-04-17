/**
 * __tests__/qualityQ157_159.test.ts
 *
 * Q-157: Performance — resourceTimingAnalyzer
 * Q-158: a11y — focusTrapManager
 * Q-159: Security — inputSanitizer
 */
import { describe, it, expect } from "vitest";

// ── Q-157: resourceTimingAnalyzer ───────────────────────────────────────

import {
  analyzeResourceTiming,
  detectRenderBlocking,
  calculateWaterfallEfficiency,
  classifyResourceSize,
  formatResourceAnalysis,
  RESOURCE_BUDGETS,
  SIZE_THRESHOLDS,
  BLOCKING_TYPES,
} from "@/lib/resourceTimingAnalyzer";
import type { ResourceEntry } from "@/lib/resourceTimingAnalyzer";

const makeEntry = (overrides: Partial<ResourceEntry> = {}): ResourceEntry => ({
  name: "/test.js",
  initiatorType: "script",
  transferSize: 5000,
  duration: 100,
  startTime: 0,
  cached: false,
  ...overrides,
});

describe("Q-157 resourceTimingAnalyzer", () => {
  describe("RESOURCE_BUDGETS", () => {
    it("has sensible defaults", () => {
      expect(RESOURCE_BUDGETS.maxTotalKB).toBeGreaterThan(0);
      expect(RESOURCE_BUDGETS.maxSingleResourceKB).toBeGreaterThan(0);
      expect(RESOURCE_BUDGETS.maxResources).toBeGreaterThan(0);
      expect(RESOURCE_BUDGETS.targetCacheHitRate).toBeGreaterThan(0);
      expect(RESOURCE_BUDGETS.targetCacheHitRate).toBeLessThanOrEqual(1);
    });
  });

  describe("SIZE_THRESHOLDS", () => {
    it("large > medium", () => {
      expect(SIZE_THRESHOLDS.large).toBeGreaterThan(SIZE_THRESHOLDS.medium);
    });
  });

  describe("BLOCKING_TYPES", () => {
    it("includes script and stylesheet", () => {
      expect(BLOCKING_TYPES).toContain("script");
      expect(BLOCKING_TYPES).toContain("stylesheet");
    });
  });

  describe("analyzeResourceTiming", () => {
    it("analyzes empty entries", () => {
      const result = analyzeResourceTiming([]);
      expect(result.totalResources).toBe(0);
      expect(result.totalTransferBytes).toBe(0);
      expect(result.cacheHitRate).toBe(0);
    });
    it("counts by type", () => {
      const entries = [
        makeEntry({ initiatorType: "script" }),
        makeEntry({ initiatorType: "script" }),
        makeEntry({ initiatorType: "img" }),
      ];
      const result = analyzeResourceTiming(entries);
      expect(result.byType.script.count).toBe(2);
      expect(result.byType.img.count).toBe(1);
      expect(result.totalResources).toBe(3);
    });
    it("calculates cache hit rate", () => {
      const entries = [
        makeEntry({ cached: true }),
        makeEntry({ cached: true }),
        makeEntry({ cached: false }),
        makeEntry({ cached: false }),
      ];
      const result = analyzeResourceTiming(entries);
      expect(result.cacheHitRate).toBeCloseTo(0.5);
    });
    it("tracks render-blocking count", () => {
      const entries = [
        makeEntry({ renderBlocking: true }),
        makeEntry({ renderBlocking: true }),
        makeEntry({ renderBlocking: false }),
      ];
      const result = analyzeResourceTiming(entries);
      expect(result.renderBlockingCount).toBe(2);
    });
    it("returns top 5 slowest", () => {
      const entries = Array.from({ length: 10 }, (_, i) =>
        makeEntry({ name: `/resource-${i}`, duration: i * 100 }),
      );
      const result = analyzeResourceTiming(entries);
      expect(result.slowest).toHaveLength(5);
      expect(result.slowest[0].duration).toBeGreaterThan(result.slowest[4].duration);
    });
    it("returns top 5 largest", () => {
      const entries = Array.from({ length: 10 }, (_, i) =>
        makeEntry({ name: `/resource-${i}`, transferSize: i * 10000 }),
      );
      const result = analyzeResourceTiming(entries);
      expect(result.largest).toHaveLength(5);
      expect(result.largest[0].transferSize).toBeGreaterThan(result.largest[4].transferSize);
    });
    it("generates size suggestion when over budget", () => {
      const entries = [makeEntry({ transferSize: 600 * 1024 })]; // 600KB > 500KB budget
      const result = analyzeResourceTiming(entries);
      expect(result.suggestions.some((s) => s.category === "size")).toBe(true);
    });
    it("generates blocking suggestion when over limit", () => {
      const entries = Array.from({ length: 5 }, () =>
        makeEntry({ renderBlocking: true }),
      );
      const result = analyzeResourceTiming(entries);
      expect(result.suggestions.some((s) => s.category === "blocking")).toBe(true);
    });
    it("generates cache suggestion when below target", () => {
      const entries = [makeEntry({ cached: false }), makeEntry({ cached: false })];
      const result = analyzeResourceTiming(entries);
      expect(result.suggestions.some((s) => s.category === "cache")).toBe(true);
    });
  });

  describe("detectRenderBlocking", () => {
    it("returns explicitly blocking resources", () => {
      const entries = [
        makeEntry({ renderBlocking: true }),
        makeEntry({ renderBlocking: false }),
      ];
      const blocking = detectRenderBlocking(entries);
      expect(blocking.length).toBeGreaterThanOrEqual(1);
    });
    it("detects early scripts as blocking", () => {
      const entries = [
        makeEntry({ initiatorType: "script", startTime: 50 }),
        makeEntry({ initiatorType: "img", startTime: 50 }),
      ];
      const blocking = detectRenderBlocking(entries);
      expect(blocking.some((e) => e.initiatorType === "script")).toBe(true);
      expect(blocking.some((e) => e.initiatorType === "img")).toBe(false);
    });
  });

  describe("calculateWaterfallEfficiency", () => {
    it("returns 1 for single resource", () => {
      expect(calculateWaterfallEfficiency([makeEntry()])).toBe(1);
    });
    it("returns 1 for empty", () => {
      expect(calculateWaterfallEfficiency([])).toBe(1);
    });
    it("returns value between 0 and 1", () => {
      const entries = [
        makeEntry({ startTime: 0, duration: 100 }),
        makeEntry({ startTime: 50, duration: 100 }),
        makeEntry({ startTime: 200, duration: 100 }),
      ];
      const efficiency = calculateWaterfallEfficiency(entries);
      expect(efficiency).toBeGreaterThan(0);
      expect(efficiency).toBeLessThanOrEqual(1);
    });
  });

  describe("classifyResourceSize", () => {
    it("classifies small", () => {
      expect(classifyResourceSize(1024)).toBe("small");
    });
    it("classifies medium", () => {
      expect(classifyResourceSize(60 * 1024)).toBe("medium");
    });
    it("classifies large", () => {
      expect(classifyResourceSize(200 * 1024)).toBe("large");
    });
  });

  describe("formatResourceAnalysis", () => {
    it("includes total and cache rate", () => {
      const analysis = analyzeResourceTiming([makeEntry()]);
      const text = formatResourceAnalysis(analysis);
      expect(text).toContain("Resource Analysis");
      expect(text).toContain("Cache hit rate");
    });
  });

  describe("barrel exports", () => {
    it("exports from lib/index", async () => {
      const mod = await import("@/lib/index");
      expect(mod.analyzeResourceTiming).toBeDefined();
      expect(mod.detectRenderBlocking).toBeDefined();
      expect(mod.RESOURCE_BUDGETS).toBeDefined();
      expect(mod.classifyResourceSize).toBeDefined();
    });
  });
});

// ── Q-158: focusTrapManager ─────────────────────────────────────────────

import {
  getFocusableElements,
  analyzeFocusableElements,
  createTrapKeyHandler,
  getInitialFocusTarget,
  buildTrapContainerProps,
  isWithinContainer,
  formatFocusTrapInfo,
  FOCUSABLE_SELECTOR,
  DEFAULT_TRAP_OPTIONS,
  TAB_KEY,
  ESCAPE_KEY,
} from "@/lib/focusTrapManager";

// Mock DOM-like container
function createMockContainer(elements: { tagName: string; disabled?: boolean; style?: Record<string, string> }[]) {
  const els = elements.map((spec) => ({
    tagName: spec.tagName,
    style: spec.style ?? {},
    focus: () => {},
    parentElement: null as unknown,
  }));

  return {
    querySelectorAll: (_selector: string) => {
      // Return all elements as if they match
      return els as unknown as NodeListOf<Element>;
    },
    querySelector: (selector: string) => {
      if (selector === "[autofocus]") return null;
      return els[0] ?? null;
    },
  };
}

describe("Q-158 focusTrapManager", () => {
  describe("constants", () => {
    it("FOCUSABLE_SELECTOR includes key elements", () => {
      expect(FOCUSABLE_SELECTOR).toContain("button");
      expect(FOCUSABLE_SELECTOR).toContain("input");
      expect(FOCUSABLE_SELECTOR).toContain("a[href]");
      expect(FOCUSABLE_SELECTOR).toContain("[tabindex]");
    });
    it("DEFAULT_TRAP_OPTIONS has sensible defaults", () => {
      expect(DEFAULT_TRAP_OPTIONS.returnFocusOnDeactivate).toBe(true);
      expect(DEFAULT_TRAP_OPTIONS.escapeDeactivates).toBe(true);
      expect(DEFAULT_TRAP_OPTIONS.clickOutsideDeactivates).toBe(false);
    });
    it("TAB_KEY and ESCAPE_KEY are defined", () => {
      expect(TAB_KEY).toBe("Tab");
      expect(ESCAPE_KEY).toBe("Escape");
    });
  });

  describe("getFocusableElements", () => {
    it("returns elements from container", () => {
      const container = createMockContainer([
        { tagName: "BUTTON" },
        { tagName: "INPUT" },
      ]);
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(2);
    });
    it("filters hidden elements", () => {
      const container = createMockContainer([
        { tagName: "BUTTON" },
        { tagName: "INPUT", style: { display: "none" } },
      ]);
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(1);
    });
    it("filters visibility:hidden", () => {
      const container = createMockContainer([
        { tagName: "BUTTON", style: { visibility: "hidden" } },
      ]);
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(0);
    });
  });

  describe("analyzeFocusableElements", () => {
    it("returns count and types", () => {
      const container = createMockContainer([
        { tagName: "BUTTON" },
        { tagName: "INPUT" },
        { tagName: "BUTTON" },
      ]);
      const info = analyzeFocusableElements(container);
      expect(info.count).toBe(3);
      expect(info.hasFocusable).toBe(true);
      expect(info.types).toContain("button");
      expect(info.types).toContain("input");
    });
    it("returns empty for no focusable", () => {
      const container = createMockContainer([]);
      const info = analyzeFocusableElements(container);
      expect(info.count).toBe(0);
      expect(info.hasFocusable).toBe(false);
    });
  });

  describe("createTrapKeyHandler", () => {
    it("calls onEscape on Escape key", () => {
      let escaped = false;
      const handler = createTrapKeyHandler(
        () => [],
        { escapeDeactivates: true, onEscape: () => { escaped = true; } },
      );
      handler({ key: "Escape", shiftKey: false, preventDefault: () => {} });
      expect(escaped).toBe(true);
    });
    it("does not call onEscape when disabled", () => {
      let escaped = false;
      const handler = createTrapKeyHandler(
        () => [],
        { escapeDeactivates: false, onEscape: () => { escaped = true; } },
      );
      handler({ key: "Escape", shiftKey: false, preventDefault: () => {} });
      expect(escaped).toBe(false);
    });
    it("calls preventDefault on Tab", () => {
      let prevented = false;
      const elements = [{ focus: () => {} }, { focus: () => {} }] as Element[];
      const handler = createTrapKeyHandler(
        () => elements,
        { escapeDeactivates: true, onEscape: () => {} },
      );
      handler({ key: "Tab", shiftKey: false, preventDefault: () => { prevented = true; } });
      expect(prevented).toBe(true);
    });
    it("ignores non-tab/escape keys", () => {
      let prevented = false;
      const handler = createTrapKeyHandler(
        () => [],
        { escapeDeactivates: true, onEscape: () => {} },
      );
      handler({ key: "Enter", shiftKey: false, preventDefault: () => { prevented = true; } });
      expect(prevented).toBe(false);
    });
  });

  describe("getInitialFocusTarget", () => {
    it("returns element matching selector", () => {
      const btn = { tagName: "BUTTON" };
      const container = {
        querySelector: () => btn as unknown as Element,
        querySelectorAll: () => [] as unknown as NodeListOf<Element>,
      };
      const target = getInitialFocusTarget(container, ".primary");
      expect(target).toBe(btn);
    });
    it("falls back to first focusable", () => {
      const btn = { tagName: "BUTTON", style: {} };
      const container = {
        querySelector: () => null,
        querySelectorAll: () => [btn] as unknown as NodeListOf<Element>,
      };
      const target = getInitialFocusTarget(container);
      expect(target).toBe(btn);
    });
  });

  describe("buildTrapContainerProps", () => {
    it("returns dialog role by default", () => {
      const props = buildTrapContainerProps({ label: "Test Dialog" });
      expect(props.role).toBe("dialog");
      expect(props["aria-label"]).toBe("Test Dialog");
      expect(props["aria-modal"]).toBe(true);
    });
    it("allows custom role", () => {
      const props = buildTrapContainerProps({ label: "Test", role: "alertdialog" });
      expect(props.role).toBe("alertdialog");
    });
    it("can disable modal", () => {
      const props = buildTrapContainerProps({ label: "Test", modal: false });
      expect(props["aria-modal"]).toBeUndefined();
    });
  });

  describe("isWithinContainer", () => {
    it("returns true when element is container", () => {
      const container = { parentElement: null };
      expect(isWithinContainer(container, container)).toBe(true);
    });
    it("returns false for null", () => {
      expect(isWithinContainer(null, {})).toBe(false);
      expect(isWithinContainer({} as never, null)).toBe(false);
    });
    it("walks up parent chain", () => {
      const container = { parentElement: null };
      const child = { parentElement: container };
      expect(isWithinContainer(child, container)).toBe(true);
    });
  });

  describe("formatFocusTrapInfo", () => {
    it("warns when no focusable", () => {
      const text = formatFocusTrapInfo({ count: 0, types: [], hasFocusable: false }, "Modal");
      expect(text).toContain("⚠️");
      expect(text).toContain("No focusable");
    });
    it("shows count when has focusable", () => {
      const text = formatFocusTrapInfo({ count: 3, types: ["button", "input"], hasFocusable: true }, "Dialog");
      expect(text).toContain("✅");
      expect(text).toContain("3");
    });
  });

  describe("barrel exports", () => {
    it("exports from lib/index", async () => {
      const mod = await import("@/lib/index");
      expect(mod.getFocusableElements).toBeDefined();
      expect(mod.analyzeFocusableElements).toBeDefined();
      expect(mod.FOCUSABLE_SELECTOR).toBeDefined();
      expect(mod.buildTrapContainerProps).toBeDefined();
    });
  });
});

// ── Q-159: inputSanitizer ───────────────────────────────────────────────

import {
  escapeHTML,
  sanitizeHTML,
  sanitizeFilename,
  sanitizeURL,
  detectInjection,
  isSafeForContext,
  formatInjectionReport,
  HTML_ENTITIES,
  INJECTION_PATTERNS,
  MAX_INPUT_LENGTH,
} from "@/lib/inputSanitizer";

describe("Q-159 inputSanitizer", () => {
  describe("HTML_ENTITIES", () => {
    it("maps all dangerous characters", () => {
      expect(HTML_ENTITIES["<"]).toBe("&lt;");
      expect(HTML_ENTITIES[">"]).toBe("&gt;");
      expect(HTML_ENTITIES["&"]).toBe("&amp;");
      expect(HTML_ENTITIES['"']).toBe("&quot;");
      expect(HTML_ENTITIES["'"]).toBe("&#x27;");
    });
  });

  describe("INJECTION_PATTERNS", () => {
    it("has patterns for all threat types", () => {
      const types = new Set(INJECTION_PATTERNS.map((p) => p.type));
      expect(types.has("xss")).toBe(true);
      expect(types.has("sqli")).toBe(true);
      expect(types.has("path_traversal")).toBe(true);
      expect(types.has("command_injection")).toBe(true);
    });
    it("has at least 15 patterns", () => {
      expect(INJECTION_PATTERNS.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe("MAX_INPUT_LENGTH", () => {
    it("is positive", () => {
      expect(MAX_INPUT_LENGTH).toBeGreaterThan(0);
    });
  });

  describe("escapeHTML", () => {
    it("escapes angle brackets", () => {
      expect(escapeHTML("<script>")).toBe("&lt;script&gt;");
    });
    it("escapes ampersand", () => {
      expect(escapeHTML("a&b")).toBe("a&amp;b");
    });
    it("escapes quotes", () => {
      expect(escapeHTML('"hello"')).toBe("&quot;hello&quot;");
    });
    it("leaves safe text unchanged", () => {
      expect(escapeHTML("Hello World 123")).toBe("Hello World 123");
    });
  });

  describe("sanitizeHTML", () => {
    it("strips script tags", () => {
      const result = sanitizeHTML("<script>alert('xss')</script>");
      expect(result.output).not.toContain("<script");
      expect(result.wasModified).toBe(true);
      expect(result.removedThreats).toContain("xss");
    });
    it("strips event handlers", () => {
      const result = sanitizeHTML('<img onerror="alert(1)" src="x">');
      expect(result.output).not.toContain("onerror");
    });
    it("strips javascript: protocol", () => {
      const result = sanitizeHTML('<a href="javascript:alert(1)">click</a>');
      expect(result.output).not.toContain("javascript:");
    });
    it("strips iframe tags", () => {
      const result = sanitizeHTML('<iframe src="evil.com"></iframe>');
      expect(result.output).not.toContain("<iframe");
    });
    it("strips null bytes", () => {
      const result = sanitizeHTML("test\x00value");
      expect(result.output).not.toContain("\x00");
      expect(result.removedThreats).toContain("null_byte");
    });
    it("leaves safe HTML unchanged", () => {
      const result = sanitizeHTML("<p>Hello <strong>World</strong></p>");
      expect(result.output).toBe("<p>Hello <strong>World</strong></p>");
      expect(result.wasModified).toBe(false);
    });
    it("truncates overly long input", () => {
      const long = "a".repeat(MAX_INPUT_LENGTH + 1000);
      const result = sanitizeHTML(long);
      expect(result.output.length).toBeLessThanOrEqual(MAX_INPUT_LENGTH);
    });
  });

  describe("sanitizeFilename", () => {
    it("removes path traversal", () => {
      expect(sanitizeFilename("../../etc/passwd")).not.toContain("..");
    });
    it("removes unsafe characters", () => {
      expect(sanitizeFilename('file<>:"/\\|?*name.txt')).not.toContain("<");
      expect(sanitizeFilename('file<>:"/\\|?*name.txt')).not.toContain(">");
    });
    it("returns unnamed for empty", () => {
      expect(sanitizeFilename("")).toBe("unnamed");
    });
    it("limits length to 255", () => {
      const long = "a".repeat(300) + ".txt";
      expect(sanitizeFilename(long).length).toBeLessThanOrEqual(255);
    });
    it("preserves safe filenames", () => {
      expect(sanitizeFilename("report-2026.pdf")).toBe("report-2026.pdf");
    });
  });

  describe("sanitizeURL", () => {
    it("blocks javascript: protocol", () => {
      expect(sanitizeURL("javascript:alert(1)")).toBeNull();
    });
    it("blocks data: protocol", () => {
      expect(sanitizeURL("data:text/html,<script>alert(1)</script>")).toBeNull();
    });
    it("blocks double-encoded characters", () => {
      expect(sanitizeURL("https://example.com/%2525")).toBeNull();
    });
    it("allows https URLs", () => {
      expect(sanitizeURL("https://example.com/path")).toBe("https://example.com/path");
    });
    it("allows relative URLs", () => {
      expect(sanitizeURL("/api/health")).toBe("/api/health");
    });
    it("allows hash links", () => {
      expect(sanitizeURL("#section-1")).toBe("#section-1");
    });
    it("blocks protocol-relative URLs", () => {
      expect(sanitizeURL("//evil.com/script.js")).toBeNull();
    });
  });

  describe("detectInjection", () => {
    it("detects XSS", () => {
      const result = detectInjection("<script>alert(1)</script>");
      expect(result.detected).toBe(true);
      expect(result.threats).toContain("xss");
      expect(result.riskLevel).not.toBe("none");
    });
    it("detects SQL injection", () => {
      const result = detectInjection("' OR '1'='1");
      expect(result.detected).toBe(true);
      expect(result.threats).toContain("sqli");
    });
    it("detects path traversal", () => {
      const result = detectInjection("../../etc/passwd");
      expect(result.detected).toBe(true);
      expect(result.threats).toContain("path_traversal");
    });
    it("detects command injection", () => {
      const result = detectInjection("; rm -rf /");
      expect(result.detected).toBe(true);
      expect(result.threats).toContain("command_injection");
    });
    it("returns none for safe input", () => {
      const result = detectInjection("Hello, this is a normal message.");
      expect(result.detected).toBe(false);
      expect(result.riskLevel).toBe("none");
    });
    it("handles empty input", () => {
      const result = detectInjection("");
      expect(result.detected).toBe(false);
    });
    it("includes match positions", () => {
      const result = detectInjection("normal text <script>bad</script>");
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].position).toBeGreaterThanOrEqual(0);
    });
  });

  describe("isSafeForContext", () => {
    it("html: rejects tags", () => {
      expect(isSafeForContext("<b>bold</b>", "html")).toBe(false);
    });
    it("html: allows plain text", () => {
      expect(isSafeForContext("Hello World", "html")).toBe(true);
    });
    it("url: rejects javascript:", () => {
      expect(isSafeForContext("javascript:alert(1)", "url")).toBe(false);
    });
    it("url: allows https", () => {
      expect(isSafeForContext("https://example.com", "url")).toBe(true);
    });
    it("filename: rejects traversal", () => {
      expect(isSafeForContext("../../etc/passwd", "filename")).toBe(false);
    });
    it("filename: allows safe names", () => {
      expect(isSafeForContext("report.pdf", "filename")).toBe(true);
    });
  });

  describe("formatInjectionReport", () => {
    it("shows clean for no threats", () => {
      const result = detectInjection("safe input");
      const text = formatInjectionReport(result);
      expect(text).toContain("✅");
      expect(text).toContain("No injection");
    });
    it("shows risk level for threats", () => {
      const result = detectInjection("<script>alert(1)</script>");
      const text = formatInjectionReport(result);
      expect(text).toContain("Injection detected");
      expect(text).toContain("xss");
    });
  });

  describe("barrel exports", () => {
    it("exports from lib/index", async () => {
      const mod = await import("@/lib/index");
      expect(mod.escapeHTML).toBeDefined();
      expect(mod.sanitizeHTML).toBeDefined();
      expect(mod.detectInjection).toBeDefined();
      expect(mod.INJECTION_PATTERNS).toBeDefined();
      expect(mod.sanitizeURL).toBeDefined();
    });
  });
});
