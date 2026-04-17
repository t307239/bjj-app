/**
 * lib/responsiveValidator.ts — Responsive layout validation utilities
 *
 * Q-150: UI pillar — provides viewport-based layout validation,
 * breakpoint coverage checking, and responsive issue detection
 * for ensuring consistent UI across device sizes.
 *
 * Pure utility layer — no DOM access, no UI. Validators receive
 * layout measurements and return issue reports.
 *
 * @example
 *   import { validateLayout, checkBreakpointCoverage, VIEWPORT_PRESETS } from "@/lib/responsiveValidator";
 *   const issues = validateLayout(measurements, "mobile");
 *   const coverage = checkBreakpointCoverage(breakpointMap);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface ViewportSize {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Device label */
  label: string;
  /** Device category */
  category: "mobile" | "tablet" | "desktop";
}

export interface LayoutMeasurement {
  /** Component or element identifier */
  elementId: string;
  /** Width of element */
  width: number;
  /** Height of element */
  height: number;
  /** Whether element overflows its container */
  overflows: boolean;
  /** Whether text is truncated */
  textTruncated: boolean;
  /** Touch target meets 44px minimum */
  touchTargetOk: boolean;
  /** Font size in px */
  fontSize: number;
}

export interface LayoutIssue {
  /** Issue severity */
  severity: "critical" | "warning" | "info";
  /** Element that has the issue */
  elementId: string;
  /** Description of the issue */
  message: string;
  /** Suggested fix */
  suggestion: string;
  /** Rule that detected the issue */
  rule: string;
}

export interface BreakpointCoverage {
  /** Breakpoint name */
  breakpoint: string;
  /** Whether styles are defined for this breakpoint */
  hasCoverage: boolean;
  /** Min width for this breakpoint */
  minWidth: number;
}

export interface ResponsiveReport {
  /** Viewport tested */
  viewport: ViewportSize;
  /** Issues found */
  issues: LayoutIssue[];
  /** Number of elements tested */
  elementsChecked: number;
  /** Pass/fail assessment */
  passed: boolean;
  /** Score (0-100) */
  score: number;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Standard viewport presets for testing */
export const VIEWPORT_PRESETS: ViewportSize[] = [
  { width: 320, height: 568, label: "iPhone SE", category: "mobile" },
  { width: 375, height: 667, label: "iPhone 8", category: "mobile" },
  { width: 390, height: 844, label: "iPhone 14", category: "mobile" },
  { width: 768, height: 1024, label: "iPad", category: "tablet" },
  { width: 1024, height: 768, label: "iPad Landscape", category: "tablet" },
  { width: 1280, height: 800, label: "Laptop", category: "desktop" },
  { width: 1920, height: 1080, label: "Desktop", category: "desktop" },
];

/** Tailwind breakpoints for coverage checking */
export const TAILWIND_BREAKPOINTS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

/** Minimum standards */
export const LAYOUT_RULES = {
  /** Minimum touch target size (px) */
  minTouchTarget: 44,
  /** Minimum font size for readability (px) */
  minFontSize: 12,
  /** Maximum content width before line length becomes unreadable */
  maxReadableWidth: 75,
  /** Minimum contrast for text readability is handled elsewhere (a11y) */
} as const;

// ── Validation ──────────────────────────────────────────────────────────

/**
 * Validate layout measurements against responsive rules.
 */
export function validateLayout(
  measurements: LayoutMeasurement[],
  viewport: ViewportSize,
): LayoutIssue[] {
  const issues: LayoutIssue[] = [];

  for (const m of measurements) {
    // Rule 1: Overflow detection
    if (m.overflows) {
      issues.push({
        severity: "critical",
        elementId: m.elementId,
        message: `Element overflows container at ${viewport.width}px`,
        suggestion: "Add overflow-hidden, overflow-x-auto, or flex-wrap",
        rule: "no-overflow",
      });
    }

    // Rule 2: Touch target size (mobile/tablet)
    if (viewport.category !== "desktop" && !m.touchTargetOk) {
      issues.push({
        severity: "warning",
        elementId: m.elementId,
        message: `Touch target below ${LAYOUT_RULES.minTouchTarget}px minimum`,
        suggestion: "Add min-h-[44px] min-w-[44px] or increase padding",
        rule: "touch-target",
      });
    }

    // Rule 3: Font size readability
    if (m.fontSize < LAYOUT_RULES.minFontSize) {
      issues.push({
        severity: "warning",
        elementId: m.elementId,
        message: `Font size ${m.fontSize}px below ${LAYOUT_RULES.minFontSize}px minimum`,
        suggestion: "Increase font size or use responsive text classes",
        rule: "min-font-size",
      });
    }

    // Rule 4: Element wider than viewport
    if (m.width > viewport.width) {
      issues.push({
        severity: "critical",
        elementId: m.elementId,
        message: `Element width (${m.width}px) exceeds viewport (${viewport.width}px)`,
        suggestion: "Add max-w-full or width constraints",
        rule: "max-width",
      });
    }

    // Rule 5: Text truncation on mobile (may indicate layout issue)
    if (m.textTruncated && viewport.category === "mobile") {
      issues.push({
        severity: "info",
        elementId: m.elementId,
        message: "Text truncated on mobile — verify truncation is intentional",
        suggestion: "Consider wrapping text or using a responsive layout",
        rule: "text-truncation",
      });
    }
  }

  return issues;
}

/**
 * Check which Tailwind breakpoints have responsive styles.
 */
export function checkBreakpointCoverage(
  coveredBreakpoints: string[],
): BreakpointCoverage[] {
  return Object.entries(TAILWIND_BREAKPOINTS).map(([name, minWidth]) => ({
    breakpoint: name,
    hasCoverage: coveredBreakpoints.includes(name),
    minWidth,
  }));
}

/**
 * Calculate responsive coverage percentage.
 */
export function calculateCoverage(
  coveredBreakpoints: string[],
): number {
  const total = Object.keys(TAILWIND_BREAKPOINTS).length;
  if (total === 0) return 100;
  const covered = coveredBreakpoints.filter((bp) =>
    bp in TAILWIND_BREAKPOINTS,
  ).length;
  return Math.round((covered / total) * 100);
}

/**
 * Build a responsive validation report.
 */
export function buildResponsiveReport(
  measurements: LayoutMeasurement[],
  viewport: ViewportSize,
): ResponsiveReport {
  const issues = validateLayout(measurements, viewport);
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const penalty = criticalCount * 20 + warningCount * 5;
  const score = Math.max(0, 100 - penalty);

  return {
    viewport,
    issues,
    elementsChecked: measurements.length,
    passed: criticalCount === 0,
    score,
  };
}

/**
 * Get the viewport category for a given width.
 */
export function getViewportCategory(width: number): "mobile" | "tablet" | "desktop" {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

/**
 * Format a responsive report as a human-readable string.
 */
export function formatResponsiveReport(report: ResponsiveReport): string {
  const icon = report.passed ? "✅" : "❌";
  const lines = [
    `${icon} ${report.viewport.label} (${report.viewport.width}×${report.viewport.height}): ${report.score}/100`,
    `   Elements checked: ${report.elementsChecked}, Issues: ${report.issues.length}`,
  ];

  if (report.issues.length > 0) {
    lines.push("");
    for (const issue of report.issues) {
      const sev = issue.severity === "critical" ? "🔴" : issue.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`  ${sev} [${issue.rule}] ${issue.elementId}: ${issue.message}`);
    }
  }

  return lines.join("\n");
}
