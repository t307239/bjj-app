/**
 * lib/styleAuditor.ts — Design token compliance auditor
 *
 * Q-163: UI pillar 93→94 — Static analysis utility that validates
 * CSS class usage against the design token system (designTokens.ts).
 * Detects non-token hex colors, inconsistent spacing, mixed color
 * systems, and suggests token-based replacements.
 *
 * Pure function, zero runtime cost. Intended for CI/audit scripts.
 *
 * @example
 *   import { auditStyles, AUDIT_RULES } from "@/lib/styleAuditor";
 *   const report = auditStyles(cssClassString);
 *   console.log(report.violations); // [{rule, message, suggestion}]
 */

// ── Token Maps ──────────────────────────────────────────────────────────

/** Approved hex colors from designTokens.ts */
export const APPROVED_COLORS: Record<string, string> = {
  "#0B1120": "surface.primary (bg-[#0B1120])",
  "#111827": "surface.card (bg-[#111827] / gray-900)",
  "#1F2937": "surface.elevated (bg-[#1F2937] / gray-800)",
  "#10B981": "brand.primary (emerald-500)",
  "#059669": "brand.primaryHover (emerald-600)",
  "#065F46": "brand.primaryMuted (emerald-800)",
  "#D1FAE5": "brand.primaryLight (emerald-100)",
  "#EF4444": "semantic.error (red-500)",
  "#F59E0B": "semantic.warning (amber-500)",
  "#3B82F6": "semantic.info (blue-500)",
  "#8B5CF6": "semantic.pro (violet-500)",
};

/** Approved Tailwind color prefixes (zinc/emerald/red/amber/blue/violet/slate/gray) */
export const APPROVED_COLOR_PREFIXES = [
  "zinc", "emerald", "red", "amber", "blue", "violet", "slate", "gray",
  "green", "white", "black", "transparent", "current",
] as const;

/** Forbidden color class patterns (non-token colors) */
export const FORBIDDEN_COLOR_PATTERNS = [
  "rose", "pink", "fuchsia", "purple", "indigo", "cyan", "teal",
  "lime", "yellow", "orange", "stone", "neutral",
] as const;

/** Standard spacing scale (Tailwind default: 0,0.5,1,1.5,2,2.5,3,3.5,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32,36,40,44,48,52,56,60,64,72,80,96) */
export const STANDARD_SPACING = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
] as const;

// ── Audit Rules ─────────────────────────────────────────────────────────

export type AuditSeverity = "error" | "warning" | "info";

export interface AuditViolation {
  rule: string;
  severity: AuditSeverity;
  message: string;
  match: string;
  suggestion: string;
}

export interface AuditRule {
  id: string;
  description: string;
  severity: AuditSeverity;
  check: (input: string) => AuditViolation[];
}

/**
 * Check for raw hex colors that aren't in the approved token list.
 * Catches: bg-[#FF0000], text-[#abc123], border-[#999]
 */
function checkRawHexColors(input: string): AuditViolation[] {
  const violations: AuditViolation[] = [];
  // Match Tailwind arbitrary color values: prefix-[#hex]
  const regex = /(?:bg|text|border|ring|shadow|outline|fill|stroke|accent|caret|decoration)-\[#([0-9a-fA-F]{3,8})\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const hex = `#${match[1].toUpperCase()}`;
    // Normalize 3-digit hex to 6-digit
    const normalized = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
    if (!APPROVED_COLORS[normalized]) {
      const closestToken = findClosestApprovedColor(normalized);
      violations.push({
        rule: "no-raw-hex",
        severity: "error",
        message: `Raw hex color "${match[0]}" is not in the design token system`,
        match: match[0],
        suggestion: closestToken
          ? `Use token: ${closestToken}`
          : "Add this color to designTokens.ts APPROVED_COLORS or use an existing token",
      });
    }
  }
  return violations;
}

/**
 * Check for off-brand Tailwind color classes.
 * Catches: text-pink-500, bg-cyan-200, etc.
 */
function checkForbiddenColors(input: string): AuditViolation[] {
  const violations: AuditViolation[] = [];
  for (const color of FORBIDDEN_COLOR_PATTERNS) {
    const regex = new RegExp(
      `(?:bg|text|border|ring|shadow|outline|fill|stroke|accent|caret|decoration)-${color}-\\d{2,3}`,
      "g"
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(input)) !== null) {
      violations.push({
        rule: "no-off-brand-color",
        severity: "warning",
        message: `Off-brand color class "${match[0]}" — use approved palette (emerald/zinc/red/amber/blue/violet)`,
        match: match[0],
        suggestion: `Replace with an approved color from: ${APPROVED_COLOR_PREFIXES.join(", ")}`,
      });
    }
  }
  return violations;
}

/**
 * Check for px_ typos (should be px-).
 * CLAUDE.md zero-tolerance rule.
 */
function checkPxTypo(input: string): AuditViolation[] {
  const violations: AuditViolation[] = [];
  const regex = /\bpx_\d+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    violations.push({
      rule: "no-px-underscore",
      severity: "error",
      message: `Typo: "${match[0]}" should use hyphen, not underscore`,
      match: match[0],
      suggestion: match[0].replace("_", "-"),
    });
  }
  return violations;
}

/**
 * Check for non-standard arbitrary spacing values.
 * Catches: p-[13px], m-[7px] (not in the standard scale).
 */
function checkArbitrarySpacing(input: string): AuditViolation[] {
  const violations: AuditViolation[] = [];
  const regex = /(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-\[(\d+(?:\.\d+)?)(?:px|rem)?\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const value = parseFloat(match[1]);
    // Convert px to Tailwind scale (1 unit = 4px for rem-based)
    const tailwindUnit = value / 4;
    if (!STANDARD_SPACING.includes(tailwindUnit as typeof STANDARD_SPACING[number])) {
      const closest = findClosestSpacing(tailwindUnit);
      violations.push({
        rule: "no-arbitrary-spacing",
        severity: "warning",
        message: `Arbitrary spacing "${match[0]}" — prefer standard Tailwind scale`,
        match: match[0],
        suggestion: `Use standard spacing: ${match[0].split("-[")[0]}-${closest}`,
      });
    }
  }
  return violations;
}

/**
 * Check for mixed dark/light mode confusion.
 * In our dark-first app, light background classes are suspicious.
 */
function checkLightBackgrounds(input: string): AuditViolation[] {
  const violations: AuditViolation[] = [];
  const lightBgPattern = /\bbg-(?:white|gray-(?:50|100)|zinc-(?:50|100)|slate-(?:50|100))\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex(lightBgPattern, input)) !== null) {
    violations.push({
      rule: "no-light-background",
      severity: "info",
      message: `Light background "${match[0]}" in dark-first app — verify this is intentional (e.g., print styles)`,
      match: match[0],
      suggestion: "Use dark surface tokens: bg-[#0B1120], bg-gray-900, bg-gray-800",
    });
  }
  return violations;
}

/** Helper: run regex.exec in a loop */
function regex(pattern: RegExp, input: string): RegExpExecArray | null {
  return pattern.exec(input);
}

/**
 * Check for missing whitespace-nowrap on number+unit patterns.
 * CLAUDE.md rule: "数値+単位の並びには whitespace-nowrap を必ず付ける"
 */
function checkNumberUnitWrap(input: string): AuditViolation[] {
  // This is a heuristic: we check if the class string has number-related
  // content but lacks whitespace-nowrap. Only applicable for JSX context.
  const violations: AuditViolation[] = [];
  // This check is intentionally conservative - only flags obvious cases
  if (input.includes("text-") && !input.includes("whitespace-nowrap") && !input.includes("whitespace-pre")) {
    // Check for known number display patterns
    const numberPatterns = /\b(?:tabular-nums|font-mono|slashed-zero)\b/;
    if (numberPatterns.test(input)) {
      violations.push({
        rule: "number-unit-nowrap",
        severity: "info",
        message: "Numeric display class detected without whitespace-nowrap",
        match: "tabular-nums/font-mono",
        suggestion: "Add whitespace-nowrap to prevent number+unit wrapping",
      });
    }
  }
  return violations;
}

// ── Aggregate Rules ─────────────────────────────────────────────────────

export const AUDIT_RULES: AuditRule[] = [
  {
    id: "no-raw-hex",
    description: "Reject raw hex colors not in the approved token list",
    severity: "error",
    check: checkRawHexColors,
  },
  {
    id: "no-off-brand-color",
    description: "Reject Tailwind color classes outside the approved palette",
    severity: "warning",
    check: checkForbiddenColors,
  },
  {
    id: "no-px-underscore",
    description: "Reject px_ typos (should be px-)",
    severity: "error",
    check: checkPxTypo,
  },
  {
    id: "no-arbitrary-spacing",
    description: "Prefer standard Tailwind spacing over arbitrary values",
    severity: "warning",
    check: checkArbitrarySpacing,
  },
  {
    id: "no-light-background",
    description: "Flag light backgrounds in dark-first app",
    severity: "info",
    check: checkLightBackgrounds,
  },
  {
    id: "number-unit-nowrap",
    description: "Ensure numeric displays have whitespace-nowrap",
    severity: "info",
    check: checkNumberUnitWrap,
  },
];

// ── Main API ────────────────────────────────────────────────────────────

export interface StyleAuditReport {
  totalViolations: number;
  errors: number;
  warnings: number;
  infos: number;
  violations: AuditViolation[];
  passed: boolean;
}

/**
 * Audit a CSS class string (or file content) against design token rules.
 *
 * @param input - CSS class string or file content to audit
 * @param rules - Optional subset of rules to apply (default: all)
 * @returns Audit report with violations and pass/fail status
 */
export function auditStyles(
  input: string,
  rules: AuditRule[] = AUDIT_RULES
): StyleAuditReport {
  const violations: AuditViolation[] = [];

  for (const rule of rules) {
    const found = rule.check(input);
    violations.push(...found);
  }

  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.filter((v) => v.severity === "warning").length;
  const infos = violations.filter((v) => v.severity === "info").length;

  return {
    totalViolations: violations.length,
    errors,
    warnings,
    infos,
    violations,
    passed: errors === 0,
  };
}

/**
 * Audit multiple class strings and aggregate results.
 */
export function auditMultipleStyles(
  inputs: { source: string; classes: string }[],
  rules?: AuditRule[]
): StyleAuditReport & { bySource: Record<string, AuditViolation[]> } {
  const bySource: Record<string, AuditViolation[]> = {};
  const allViolations: AuditViolation[] = [];

  for (const { source, classes } of inputs) {
    const report = auditStyles(classes, rules);
    if (report.violations.length > 0) {
      bySource[source] = report.violations;
      allViolations.push(...report.violations);
    }
  }

  const errors = allViolations.filter((v) => v.severity === "error").length;
  const warnings = allViolations.filter((v) => v.severity === "warning").length;
  const infos = allViolations.filter((v) => v.severity === "info").length;

  return {
    totalViolations: allViolations.length,
    errors,
    warnings,
    infos,
    violations: allViolations,
    passed: errors === 0,
    bySource,
  };
}

/**
 * Get a summary of the design token system for documentation.
 */
export function getTokenSummary(): {
  approvedColors: number;
  approvedPrefixes: readonly string[];
  forbiddenPrefixes: readonly string[];
  spacingScale: readonly number[];
  rulesCount: number;
} {
  return {
    approvedColors: Object.keys(APPROVED_COLORS).length,
    approvedPrefixes: APPROVED_COLOR_PREFIXES,
    forbiddenPrefixes: FORBIDDEN_COLOR_PATTERNS,
    spacingScale: STANDARD_SPACING,
    rulesCount: AUDIT_RULES.length,
  };
}

/**
 * Format an audit report as a human-readable string.
 */
export function formatAuditReport(report: StyleAuditReport): string {
  const lines: string[] = [
    `Style Audit: ${report.passed ? "PASSED ✅" : "FAILED ❌"}`,
    `  Errors: ${report.errors}, Warnings: ${report.warnings}, Info: ${report.infos}`,
  ];

  for (const v of report.violations) {
    const icon = v.severity === "error" ? "❌" : v.severity === "warning" ? "⚠️" : "ℹ️";
    lines.push(`  ${icon} [${v.rule}] ${v.message}`);
    lines.push(`     → ${v.suggestion}`);
  }

  return lines.join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Find the closest approved color by hex similarity */
function findClosestApprovedColor(hex: string): string | null {
  const target = hexToRgb(hex);
  if (!target) return null;

  let closest: string | null = null;
  let minDist = Infinity;

  for (const [approvedHex, tokenName] of Object.entries(APPROVED_COLORS)) {
    const rgb = hexToRgb(approvedHex);
    if (!rgb) continue;
    const dist = Math.sqrt(
      (target.r - rgb.r) ** 2 +
      (target.g - rgb.g) ** 2 +
      (target.b - rgb.b) ** 2
    );
    if (dist < minDist) {
      minDist = dist;
      closest = tokenName;
    }
  }

  return closest;
}

/** Parse hex string to RGB */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

/** Find closest standard Tailwind spacing value */
function findClosestSpacing(value: number): number {
  let closest: number = STANDARD_SPACING[0];
  let minDiff = Math.abs(value - closest);
  for (const s of STANDARD_SPACING) {
    const diff = Math.abs(value - s);
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }
  return closest;
}
