/**
 * screenReaderAudit.ts — Screen reader compatibility audit utilities
 *
 * Pure-function utility for validating ARIA landmark structure,
 * heading hierarchy, live region management, and image alt text compliance.
 *
 * @module screenReaderAudit
 * @since Q-173
 */

/* ---------- Constants ---------- */

/** Required ARIA landmarks for a well-structured page */
export const REQUIRED_LANDMARKS = ["banner", "main", "contentinfo"] as const;

/** Optional but recommended landmarks */
export const RECOMMENDED_LANDMARKS = ["navigation", "complementary", "search"] as const;

/** Valid heading levels */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** Maximum recommended heading level skip (e.g., h1 → h3 skips h2) */
export const MAX_HEADING_SKIP = 1;

/** ARIA live region politeness levels */
export const LIVE_REGION_POLITENESS = ["off", "polite", "assertive"] as const;
export type LiveRegionPoliteness = (typeof LIVE_REGION_POLITENESS)[number];

/** Common ARIA roles that require specific attributes */
export const ROLE_REQUIRED_ATTRS: Record<string, string[]> = {
  checkbox: ["aria-checked"],
  combobox: ["aria-expanded"],
  slider: ["aria-valuenow", "aria-valuemin", "aria-valuemax"],
  spinbutton: ["aria-valuenow", "aria-valuemin", "aria-valuemax"],
  progressbar: ["aria-valuenow"],
  tab: ["aria-selected"],
  tabpanel: ["aria-labelledby"],
  dialog: ["aria-label", "aria-labelledby"],
  alertdialog: ["aria-label", "aria-labelledby"],
  img: ["aria-label", "alt"],
};

/* ---------- Types ---------- */

export interface LandmarkInfo {
  role: string;
  label?: string;
  hasLabel: boolean;
}

export interface HeadingInfo {
  level: number;
  text: string;
  id?: string;
}

export interface LiveRegionInfo {
  politeness: LiveRegionPoliteness;
  atomic: boolean;
  relevant: string;
  role?: string;
}

export interface ImageInfo {
  src: string;
  alt?: string;
  role?: string;
  ariaLabel?: string;
  ariaHidden?: boolean;
}

export type AuditSeverity = "error" | "warning" | "info";

export interface AuditIssue {
  severity: AuditSeverity;
  category: "landmark" | "heading" | "live_region" | "image" | "role" | "focus";
  message: string;
  element?: string;
}

export interface ScreenReaderAuditResult {
  issues: AuditIssue[];
  score: number;
  landmarkCoverage: number;
  headingStructureValid: boolean;
  imageAltCoverage: number;
}

/* ---------- Landmark Auditing ---------- */

/**
 * Audit landmark structure for screen reader navigation
 */
export function auditLandmarks(landmarks: LandmarkInfo[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const roles = landmarks.map((l) => l.role);

  // Check required landmarks
  for (const required of REQUIRED_LANDMARKS) {
    if (!roles.includes(required)) {
      issues.push({
        severity: "error",
        category: "landmark",
        message: `Missing required landmark: ${required}`,
      });
    }
  }

  // Check for duplicate main landmarks
  const mainCount = roles.filter((r) => r === "main").length;
  if (mainCount > 1) {
    issues.push({
      severity: "error",
      category: "landmark",
      message: `Multiple main landmarks found (${mainCount}). Only one is allowed.`,
    });
  }

  // Check for duplicate navigation without labels
  const navLandmarks = landmarks.filter((l) => l.role === "navigation");
  if (navLandmarks.length > 1) {
    const unlabeled = navLandmarks.filter((l) => !l.hasLabel);
    if (unlabeled.length > 0) {
      issues.push({
        severity: "warning",
        category: "landmark",
        message: `${navLandmarks.length} navigation landmarks found but ${unlabeled.length} lack labels. Each navigation should have a unique aria-label.`,
      });
    }
  }

  // Recommend optional landmarks
  for (const recommended of RECOMMENDED_LANDMARKS) {
    if (!roles.includes(recommended)) {
      issues.push({
        severity: "info",
        category: "landmark",
        message: `Consider adding ${recommended} landmark for better navigation`,
      });
    }
  }

  return issues;
}

/**
 * Calculate landmark coverage percentage
 */
export function calculateLandmarkCoverage(landmarks: LandmarkInfo[]): number {
  const roles = new Set(landmarks.map((l) => l.role));
  const requiredCount = REQUIRED_LANDMARKS.filter((r) => roles.has(r)).length;
  return Math.round((requiredCount / REQUIRED_LANDMARKS.length) * 100);
}

/* ---------- Heading Hierarchy Auditing ---------- */

/**
 * Audit heading hierarchy for logical structure
 */
export function auditHeadingHierarchy(headings: HeadingInfo[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (headings.length === 0) {
    issues.push({
      severity: "warning",
      category: "heading",
      message: "No headings found on page",
    });
    return issues;
  }

  // First heading should be h1
  if (headings[0].level !== 1) {
    issues.push({
      severity: "error",
      category: "heading",
      message: `First heading is h${headings[0].level}, expected h1`,
      element: headings[0].text,
    });
  }

  // Check for multiple h1s
  const h1Count = headings.filter((h) => h.level === 1).length;
  if (h1Count > 1) {
    issues.push({
      severity: "warning",
      category: "heading",
      message: `Multiple h1 headings found (${h1Count}). Consider using only one h1 per page.`,
    });
  }

  // Check for skipped levels
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;
    const skip = curr - prev;

    if (skip > MAX_HEADING_SKIP + 1) {
      issues.push({
        severity: "warning",
        category: "heading",
        message: `Heading level skipped from h${prev} to h${curr}`,
        element: headings[i].text,
      });
    }
  }

  // Check for empty headings
  for (const heading of headings) {
    if (!heading.text.trim()) {
      issues.push({
        severity: "error",
        category: "heading",
        message: `Empty h${heading.level} heading found`,
      });
    }
  }

  return issues;
}

/**
 * Check if heading structure is valid (no errors)
 */
export function isHeadingStructureValid(headings: HeadingInfo[]): boolean {
  const issues = auditHeadingHierarchy(headings);
  return !issues.some((i) => i.severity === "error");
}

/* ---------- Image Alt Text Auditing ---------- */

/**
 * Audit images for alt text compliance
 */
export function auditImageAlt(images: ImageInfo[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const img of images) {
    // Skip decorative images (explicitly hidden)
    if (img.ariaHidden === true || img.role === "presentation" || img.role === "none") {
      continue;
    }

    const hasAlt = Boolean(img.alt);
    const hasAriaLabel = Boolean(img.ariaLabel);

    if (!hasAlt && !hasAriaLabel) {
      issues.push({
        severity: "error",
        category: "image",
        message: `Image missing alt text: ${img.src}`,
        element: img.src,
      });
    } else if (hasAlt && img.alt!.length > 125) {
      issues.push({
        severity: "warning",
        category: "image",
        message: `Alt text too long (${img.alt!.length} chars, max 125): ${img.src}`,
        element: img.src,
      });
    } else if (hasAlt && /^(image|photo|picture|img|graphic)\s*(of)?$/i.test(img.alt!.trim())) {
      issues.push({
        severity: "warning",
        category: "image",
        message: `Non-descriptive alt text "${img.alt}" for: ${img.src}`,
        element: img.src,
      });
    }
  }

  return issues;
}

/**
 * Calculate image alt text coverage
 */
export function calculateImageAltCoverage(images: ImageInfo[]): number {
  const nonDecorative = images.filter(
    (img) => img.ariaHidden !== true && img.role !== "presentation" && img.role !== "none",
  );
  if (nonDecorative.length === 0) return 100;
  const withAlt = nonDecorative.filter((img) => Boolean(img.alt) || Boolean(img.ariaLabel));
  return Math.round((withAlt.length / nonDecorative.length) * 100);
}

/* ---------- ARIA Role Auditing ---------- */

/**
 * Audit ARIA roles for required attributes
 */
export function auditRoleAttributes(
  elements: Array<{ role: string; attributes: Record<string, string | undefined> }>,
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const el of elements) {
    const requiredAttrs = ROLE_REQUIRED_ATTRS[el.role];
    if (!requiredAttrs) continue;

    // For roles that need one of multiple attrs (like dialog needing label OR labelledby)
    const hasAny = requiredAttrs.some((attr) => el.attributes[attr] !== undefined);
    if (!hasAny) {
      issues.push({
        severity: "error",
        category: "role",
        message: `Element with role="${el.role}" missing required attribute(s): ${requiredAttrs.join(" or ")}`,
      });
    }
  }

  return issues;
}

/* ---------- Live Region Auditing ---------- */

/**
 * Audit live regions for proper configuration
 */
export function auditLiveRegions(regions: LiveRegionInfo[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  const assertiveCount = regions.filter((r) => r.politeness === "assertive").length;
  if (assertiveCount > 2) {
    issues.push({
      severity: "warning",
      category: "live_region",
      message: `${assertiveCount} assertive live regions found. Use sparingly to avoid overwhelming screen readers.`,
    });
  }

  for (const region of regions) {
    if (region.politeness === "assertive" && !region.role) {
      issues.push({
        severity: "info",
        category: "live_region",
        message: "Assertive live region without role. Consider adding role=alert or role=status.",
      });
    }
  }

  return issues;
}

/* ---------- Full Audit ---------- */

/**
 * Run a complete screen reader audit
 */
export function runScreenReaderAudit(input: {
  landmarks: LandmarkInfo[];
  headings: HeadingInfo[];
  images: ImageInfo[];
  liveRegions: LiveRegionInfo[];
  roleElements?: Array<{ role: string; attributes: Record<string, string | undefined> }>;
}): ScreenReaderAuditResult {
  const allIssues: AuditIssue[] = [
    ...auditLandmarks(input.landmarks),
    ...auditHeadingHierarchy(input.headings),
    ...auditImageAlt(input.images),
    ...auditLiveRegions(input.liveRegions),
    ...(input.roleElements ? auditRoleAttributes(input.roleElements) : []),
  ];

  const landmarkCoverage = calculateLandmarkCoverage(input.landmarks);
  const headingStructureValid = isHeadingStructureValid(input.headings);
  const imageAltCoverage = calculateImageAltCoverage(input.images);

  // Score calculation
  const errors = allIssues.filter((i) => i.severity === "error").length;
  const warnings = allIssues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errors * 15 - warnings * 5);

  return {
    issues: allIssues,
    score,
    landmarkCoverage,
    headingStructureValid,
    imageAltCoverage,
  };
}

/**
 * Format audit result as human-readable report
 */
export function formatScreenReaderAudit(result: ScreenReaderAuditResult): string {
  const lines: string[] = [
    "=== Screen Reader Audit ===",
    "",
    `Score: ${result.score}/100`,
    `Landmark Coverage: ${result.landmarkCoverage}%`,
    `Heading Structure: ${result.headingStructureValid ? "Valid" : "Invalid"}`,
    `Image Alt Coverage: ${result.imageAltCoverage}%`,
  ];

  if (result.issues.length > 0) {
    lines.push("", "Issues:");
    for (const issue of result.issues) {
      const icon = issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`  ${icon} [${issue.category}] ${issue.message}`);
    }
  } else {
    lines.push("", "No issues found.");
  }

  return lines.join("\n");
}
