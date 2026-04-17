/**
 * Q-178: Theme Validation & Dark Mode Compliance
 * UI 94→95
 *
 * Validates theme consistency across components, detects off-brand usage,
 * ensures dark-mode compliance for SaaS-grade visual quality.
 */

// ── Constants ──────────────────────────────────────────────

export const DARK_MODE_REQUIREMENTS = {
  /** Background must use zinc/slate 800-950 range */
  backgroundDarkRange: { min: 800, max: 950 },
  /** Text must use zinc/slate 50-300 for readability */
  textLightRange: { min: 50, max: 300 },
  /** Minimum contrast ratio (WCAG AA) */
  minContrastRatio: 4.5,
  /** Brand accent color */
  brandAccent: "#10B981", // emerald-500
  /** Forbidden light backgrounds in dark mode */
  forbiddenLightBg: ["bg-white", "bg-gray-50", "bg-gray-100", "bg-slate-50"],
} as const;

export type ThemeSeverity = "error" | "warning" | "info";

export interface ThemeViolation {
  rule: string;
  severity: ThemeSeverity;
  message: string;
  suggestion: string;
  file?: string;
  line?: number;
}

export interface ThemeAuditResult {
  violations: ThemeViolation[];
  score: number; // 0-100
  grade: string;
  darkModeCompliant: boolean;
  brandConsistent: boolean;
  summary: string;
}

export const THEME_RULES = {
  no_light_background: {
    description: "No light backgrounds in dark-mode app",
    severity: "error" as ThemeSeverity,
  },
  no_gray_text: {
    description: "Use zinc/slate instead of gray for consistency",
    severity: "warning" as ThemeSeverity,
  },
  brand_color_usage: {
    description: "Brand accent should be emerald-500 (#10B981)",
    severity: "warning" as ThemeSeverity,
  },
  no_raw_white: {
    description: "Avoid raw white (#fff/white) on dark backgrounds",
    severity: "warning" as ThemeSeverity,
  },
  consistent_border: {
    description: "Borders should use zinc/slate-700 or -800",
    severity: "info" as ThemeSeverity,
  },
  no_opacity_text: {
    description: "Use semantic color tokens instead of opacity on text",
    severity: "info" as ThemeSeverity,
  },
} as const;

// ── Validation Functions ────────────────────────────────────

/**
 * Check if a class string contains forbidden light backgrounds
 */
export function detectLightBackgrounds(classes: string): ThemeViolation[] {
  const violations: ThemeViolation[] = [];
  for (const forbidden of DARK_MODE_REQUIREMENTS.forbiddenLightBg) {
    if (classes.includes(forbidden)) {
      violations.push({
        rule: "no_light_background",
        severity: "error",
        message: `Light background "${forbidden}" used in dark-mode app`,
        suggestion: forbidden.replace("white", "zinc-900").replace(/gray-\d+/, "zinc-900").replace(/slate-\d+/, "zinc-900"),
      });
    }
  }
  return violations;
}

/**
 * Check for gray color usage (should be zinc/slate)
 */
export function detectGrayUsage(classes: string): ThemeViolation[] {
  const violations: ThemeViolation[] = [];
  const grayPattern = /\b(text|bg|border)-gray-(\d+)\b/g;
  let match: RegExpExecArray | null;
  while ((match = grayPattern.exec(classes)) !== null) {
    const [full, prefix, shade] = match;
    violations.push({
      rule: "no_gray_text",
      severity: "warning",
      message: `"${full}" should use zinc instead of gray`,
      suggestion: `${prefix}-zinc-${shade}`,
    });
  }
  return violations;
}

/**
 * Check for raw white usage
 */
export function detectRawWhite(classes: string): ThemeViolation[] {
  const violations: ThemeViolation[] = [];
  if (/\btext-white\b/.test(classes)) {
    violations.push({
      rule: "no_raw_white",
      severity: "warning",
      message: "Raw text-white may be too bright on dark backgrounds",
      suggestion: "text-zinc-50 or text-zinc-100",
    });
  }
  return violations;
}

/**
 * Validate border consistency
 */
export function detectInconsistentBorders(classes: string): ThemeViolation[] {
  const violations: ThemeViolation[] = [];
  const borderPattern = /\bborder-(gray|slate|neutral)-(\d+)\b/g;
  let match: RegExpExecArray | null;
  while ((match = borderPattern.exec(classes)) !== null) {
    const [full, colorFamily, shade] = match;
    const shadeNum = parseInt(shade, 10);
    if (colorFamily !== "slate" && colorFamily !== "zinc") {
      violations.push({
        rule: "consistent_border",
        severity: "info",
        message: `Border "${full}" should use zinc for consistency`,
        suggestion: `border-zinc-${shade}`,
      });
    }
    if (shadeNum < 600) {
      violations.push({
        rule: "consistent_border",
        severity: "info",
        message: `Border shade ${shade} too light for dark theme`,
        suggestion: `border-zinc-700 or border-zinc-800`,
      });
    }
  }
  return violations;
}

/**
 * Validate text opacity patterns
 */
export function detectOpacityText(classes: string): ThemeViolation[] {
  const violations: ThemeViolation[] = [];
  if (/\btext-opacity-\d+\b/.test(classes) || /\btext-[a-z]+-\d+\/\d+\b/.test(classes)) {
    violations.push({
      rule: "no_opacity_text",
      severity: "info",
      message: "Text opacity used instead of semantic color token",
      suggestion: "Use text-zinc-400 or text-zinc-500 instead of opacity modifiers",
    });
  }
  return violations;
}

/**
 * Run full theme audit on a set of class strings
 */
export function auditTheme(
  entries: Array<{ classes: string; file?: string; line?: number }>
): ThemeAuditResult {
  const allViolations: ThemeViolation[] = [];

  for (const entry of entries) {
    const checks = [
      ...detectLightBackgrounds(entry.classes),
      ...detectGrayUsage(entry.classes),
      ...detectRawWhite(entry.classes),
      ...detectInconsistentBorders(entry.classes),
      ...detectOpacityText(entry.classes),
    ];
    for (const v of checks) {
      allViolations.push({ ...v, file: entry.file, line: entry.line });
    }
  }

  const errorCount = allViolations.filter((v) => v.severity === "error").length;
  const warningCount = allViolations.filter((v) => v.severity === "warning").length;
  const infoCount = allViolations.filter((v) => v.severity === "info").length;

  // Score: start at 100, -10 per error, -3 per warning, -1 per info
  const rawScore = 100 - errorCount * 10 - warningCount * 3 - infoCount * 1;
  const score = Math.max(0, Math.min(100, rawScore));

  const grade =
    score >= 95 ? "A+" : score >= 90 ? "A" : score >= 80 ? "B" :
    score >= 70 ? "C" : score >= 60 ? "D" : "F";

  return {
    violations: allViolations,
    score,
    grade,
    darkModeCompliant: errorCount === 0,
    brandConsistent: !allViolations.some(
      (v) => v.rule === "brand_color_usage"
    ),
    summary: `Theme audit: ${score}/100 (${grade}) — ${errorCount} errors, ${warningCount} warnings, ${infoCount} info`,
  };
}

/**
 * Check if a hex color is within the dark range
 */
export function isDarkColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.3;
}

/**
 * Calculate relative contrast ratio between two hex colors
 */
export function calculateContrastRatio(fg: string, bg: string): number {
  const toLuminance = (hex: string) => {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };
  const l1 = toLuminance(fg);
  const l2 = toLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check WCAG contrast compliance
 */
export function isContrastCompliant(
  fg: string,
  bg: string,
  level: "AA" | "AAA" = "AA"
): boolean {
  const ratio = calculateContrastRatio(fg, bg);
  return level === "AAA" ? ratio >= 7 : ratio >= 4.5;
}

/**
 * Format theme audit result as human-readable string
 */
export function formatThemeAudit(result: ThemeAuditResult): string {
  const lines = [
    `# Theme Audit Report`,
    `Score: ${result.score}/100 (${result.grade})`,
    `Dark Mode Compliant: ${result.darkModeCompliant ? "Yes" : "No"}`,
    `Brand Consistent: ${result.brandConsistent ? "Yes" : "No"}`,
    ``,
    `## Violations (${result.violations.length})`,
  ];
  for (const v of result.violations) {
    const loc = v.file ? ` [${v.file}${v.line ? `:${v.line}` : ""}]` : "";
    lines.push(`- [${v.severity.toUpperCase()}] ${v.message}${loc}`);
    lines.push(`  → ${v.suggestion}`);
  }
  return lines.join("\n");
}
