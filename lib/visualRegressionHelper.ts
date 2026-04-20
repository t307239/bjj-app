/**
 * Q-221: Visual Regression Helper — screenshot diffing and layout shift detection
 *
 * Provides utilities for visual regression testing without external
 * services. Designed for use in CI/CD pipelines and manual QA.
 * Compares layout metrics, element positions, and style consistency.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutSnapshot {
  /** Page URL or route */
  url: string;
  /** Viewport width */
  viewportWidth: number;
  /** Viewport height */
  viewportHeight: number;
  /** Timestamp */
  timestamp: string;
  /** Elements and their bounding rects */
  elements: ElementSnapshot[];
  /** Computed styles for key elements */
  styles: StyleSnapshot[];
}

export interface ElementSnapshot {
  /** CSS selector or test ID */
  selector: string;
  /** Bounding client rect */
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  /** Whether the element is visible */
  isVisible: boolean;
  /** Overflow state */
  overflows: boolean;
  /** Text content length */
  textLength: number;
}

export interface StyleSnapshot {
  selector: string;
  backgroundColor: string;
  color: string;
  fontSize: string;
  fontWeight: string;
  padding: string;
  margin: string;
  borderRadius: string;
}

export interface VisualDiff {
  /** Elements that shifted position */
  layoutShifts: LayoutShift[];
  /** Elements that changed size */
  sizeChanges: SizeChange[];
  /** Style changes detected */
  styleChanges: StyleChange[];
  /** Elements that appeared or disappeared */
  visibilityChanges: VisibilityChange[];
  /** Overall regression score (100 = no changes) */
  score: number;
  /** Grade A+ through F */
  grade: string;
  /** Whether this diff should block deployment */
  shouldBlock: boolean;
}

export interface LayoutShift {
  selector: string;
  axis: "x" | "y" | "both";
  shiftPx: number;
  from: { top: number; left: number };
  to: { top: number; left: number };
  severity: "minor" | "major" | "critical";
}

export interface SizeChange {
  selector: string;
  dimension: "width" | "height" | "both";
  changePx: number;
  changePercent: number;
  from: { width: number; height: number };
  to: { width: number; height: number };
  severity: "minor" | "major" | "critical";
}

export interface StyleChange {
  selector: string;
  property: string;
  from: string;
  to: string;
  severity: "minor" | "major";
}

export interface VisibilityChange {
  selector: string;
  change: "appeared" | "disappeared";
  severity: "minor" | "major" | "critical";
}

export interface RegressionTestConfig {
  /** Viewports to test */
  viewports: Array<{ width: number; height: number; name: string }>;
  /** Routes to test */
  routes: string[];
  /** CSS selectors to track */
  selectors: string[];
  /** Maximum allowed layout shift in px */
  maxShiftPx: number;
  /** Maximum allowed size change in % */
  maxSizeChangePercent: number;
  /** Whether to block on style changes */
  blockOnStyleChanges: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard viewports for BJJ App testing */
export const STANDARD_VIEWPORTS = [
  { width: 320, height: 568, name: "iPhone SE" },
  { width: 375, height: 812, name: "iPhone 13 mini" },
  { width: 390, height: 844, name: "iPhone 14" },
  { width: 768, height: 1024, name: "iPad" },
  { width: 1280, height: 800, name: "Desktop" },
] as const;

/** Key routes to test */
export const KEY_ROUTES = [
  "/",
  "/login",
  "/dashboard",
  "/records",
  "/techniques",
  "/profile",
  "/help",
  "/privacy",
] as const;

/** Threshold for severity classification */
const SHIFT_THRESHOLDS = { minor: 2, major: 10, critical: 50 } as const;
const SIZE_THRESHOLDS = { minor: 5, major: 15, critical: 30 } as const; // percent

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Compare two layout snapshots and produce a diff.
 */
export function compareSnapshots(
  baseline: LayoutSnapshot,
  current: LayoutSnapshot
): VisualDiff {
  const layoutShifts: LayoutShift[] = [];
  const sizeChanges: SizeChange[] = [];
  const styleChanges: StyleChange[] = [];
  const visibilityChanges: VisibilityChange[] = [];

  // Build lookup maps
  const baseMap = new Map(baseline.elements.map((e) => [e.selector, e]));
  const currMap = new Map(current.elements.map((e) => [e.selector, e]));

  // Check existing elements for shifts and size changes
  for (const [selector, baseEl] of baseMap) {
    const currEl = currMap.get(selector);

    if (!currEl) {
      if (baseEl.isVisible) {
        visibilityChanges.push({
          selector,
          change: "disappeared",
          severity: "major",
        });
      }
      continue;
    }

    // Visibility changes
    if (baseEl.isVisible && !currEl.isVisible) {
      visibilityChanges.push({ selector, change: "disappeared", severity: "major" });
    } else if (!baseEl.isVisible && currEl.isVisible) {
      visibilityChanges.push({ selector, change: "appeared", severity: "minor" });
    }

    // Layout shifts
    const dx = Math.abs(currEl.rect.left - baseEl.rect.left);
    const dy = Math.abs(currEl.rect.top - baseEl.rect.top);
    const totalShift = Math.sqrt(dx * dx + dy * dy);

    if (totalShift > SHIFT_THRESHOLDS.minor) {
      const axis: "x" | "y" | "both" =
        dx > SHIFT_THRESHOLDS.minor && dy > SHIFT_THRESHOLDS.minor
          ? "both"
          : dx > dy
            ? "x"
            : "y";

      layoutShifts.push({
        selector,
        axis,
        shiftPx: Math.round(totalShift),
        from: { top: baseEl.rect.top, left: baseEl.rect.left },
        to: { top: currEl.rect.top, left: currEl.rect.left },
        severity: classifyShiftSeverity(totalShift),
      });
    }

    // Size changes
    const dw = Math.abs(currEl.rect.width - baseEl.rect.width);
    const dh = Math.abs(currEl.rect.height - baseEl.rect.height);
    const dwPercent =
      baseEl.rect.width > 0 ? (dw / baseEl.rect.width) * 100 : 0;
    const dhPercent =
      baseEl.rect.height > 0 ? (dh / baseEl.rect.height) * 100 : 0;
    const maxChangePercent = Math.max(dwPercent, dhPercent);

    if (maxChangePercent > SIZE_THRESHOLDS.minor) {
      sizeChanges.push({
        selector,
        dimension:
          dwPercent > SIZE_THRESHOLDS.minor && dhPercent > SIZE_THRESHOLDS.minor
            ? "both"
            : dwPercent > dhPercent
              ? "width"
              : "height",
        changePx: Math.round(Math.max(dw, dh)),
        changePercent: Math.round(maxChangePercent),
        from: { width: baseEl.rect.width, height: baseEl.rect.height },
        to: { width: currEl.rect.width, height: currEl.rect.height },
        severity: classifySizeSeverity(maxChangePercent),
      });
    }
  }

  // Check for new elements
  for (const [selector, currEl] of currMap) {
    if (!baseMap.has(selector) && currEl.isVisible) {
      visibilityChanges.push({
        selector,
        change: "appeared",
        severity: "minor",
      });
    }
  }

  // Compare styles
  const baseStyleMap = new Map(baseline.styles.map((s) => [s.selector, s]));
  for (const currStyle of current.styles) {
    const baseStyle = baseStyleMap.get(currStyle.selector);
    if (!baseStyle) continue;

    const props: Array<keyof StyleSnapshot> = [
      "backgroundColor",
      "color",
      "fontSize",
      "fontWeight",
    ];
    for (const prop of props) {
      if (prop === "selector") continue;
      if (baseStyle[prop] !== currStyle[prop]) {
        styleChanges.push({
          selector: currStyle.selector,
          property: prop,
          from: baseStyle[prop],
          to: currStyle[prop],
          severity: prop === "fontSize" || prop === "color" ? "major" : "minor",
        });
      }
    }
  }

  // Calculate score
  const criticalCount = [
    ...layoutShifts.filter((s) => s.severity === "critical"),
    ...sizeChanges.filter((s) => s.severity === "critical"),
    ...visibilityChanges.filter((v) => v.severity === "critical"),
  ].length;

  const majorCount = [
    ...layoutShifts.filter((s) => s.severity === "major"),
    ...sizeChanges.filter((s) => s.severity === "major"),
    ...visibilityChanges.filter((v) => v.severity === "major"),
    ...styleChanges.filter((s) => s.severity === "major"),
  ].length;

  const score = Math.max(
    0,
    100 - criticalCount * 25 - majorCount * 10 - styleChanges.length * 2
  );

  const shouldBlock = criticalCount > 0 || majorCount >= 3;

  return {
    layoutShifts,
    sizeChanges,
    styleChanges,
    visibilityChanges,
    score,
    grade: scoreToGrade(score),
    shouldBlock,
  };
}

/**
 * Build a default regression test configuration for BJJ App.
 */
export function buildDefaultTestConfig(): RegressionTestConfig {
  return {
    viewports: [...STANDARD_VIEWPORTS],
    routes: [...KEY_ROUTES],
    selectors: [
      "[data-testid]",
      "nav",
      "main",
      "header",
      "footer",
      "h1",
      "h2",
      "button",
      "a",
      "img",
    ],
    maxShiftPx: 10,
    maxSizeChangePercent: 15,
    blockOnStyleChanges: false,
  };
}

/**
 * Format a visual diff as a human-readable report.
 */
export function formatVisualDiff(diff: VisualDiff): string {
  const lines: string[] = [
    `Visual Regression: ${diff.score}/100 (${diff.grade})`,
    `Should block: ${diff.shouldBlock ? "YES" : "NO"}`,
    `Layout shifts: ${diff.layoutShifts.length}`,
    `Size changes: ${diff.sizeChanges.length}`,
    `Style changes: ${diff.styleChanges.length}`,
    `Visibility changes: ${diff.visibilityChanges.length}`,
  ];

  if (diff.layoutShifts.length > 0) {
    lines.push("", "Layout Shifts:");
    for (const s of diff.layoutShifts.slice(0, 5)) {
      lines.push(`  [${s.severity}] ${s.selector}: ${s.shiftPx}px ${s.axis}`);
    }
  }

  if (diff.sizeChanges.length > 0) {
    lines.push("", "Size Changes:");
    for (const s of diff.sizeChanges.slice(0, 5)) {
      lines.push(
        `  [${s.severity}] ${s.selector}: ${s.changePercent}% ${s.dimension}`
      );
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyShiftSeverity(
  px: number
): "minor" | "major" | "critical" {
  if (px >= SHIFT_THRESHOLDS.critical) return "critical";
  if (px >= SHIFT_THRESHOLDS.major) return "major";
  return "minor";
}

function classifySizeSeverity(
  percent: number
): "minor" | "major" | "critical" {
  if (percent >= SIZE_THRESHOLDS.critical) return "critical";
  if (percent >= SIZE_THRESHOLDS.major) return "major";
  return "minor";
}

function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
