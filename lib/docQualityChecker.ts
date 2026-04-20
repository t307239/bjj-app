/**
 * Q-218: Doc Quality Checker — JSDoc coverage and quality enforcement
 *
 * Analyzes TypeScript/JavaScript files for documentation quality,
 * enforces JSDoc coverage thresholds, and generates improvement suggestions.
 * Designed to be used in CI/CD and pre-commit hooks.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocQualityReport {
  /** Total exported symbols found */
  totalExports: number;
  /** Exports with JSDoc */
  documentedExports: number;
  /** Coverage percentage (0-100) */
  coverage: number;
  /** Overall quality score (0-100) */
  qualityScore: number;
  /** Grade A+ through F */
  grade: string;
  /** Files analyzed */
  filesAnalyzed: number;
  /** Per-file details */
  fileReports: FileDocReport[];
  /** Symbols missing documentation */
  undocumented: UndocumentedSymbol[];
  /** Quality issues found in existing docs */
  qualityIssues: DocQualityIssue[];
}

export interface FileDocReport {
  filePath: string;
  totalExports: number;
  documented: number;
  coverage: number;
}

export interface UndocumentedSymbol {
  filePath: string;
  name: string;
  kind: ExportKind;
  priority: "high" | "medium" | "low";
}

export type ExportKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "const"
  | "default";

export interface DocQualityIssue {
  filePath: string;
  symbolName: string;
  issue: DocIssueType;
  message: string;
}

export type DocIssueType =
  | "missing_description"
  | "missing_params"
  | "missing_returns"
  | "missing_example"
  | "too_short"
  | "missing_see_link"
  | "stale_todo";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** JSDoc patterns */
const JSDOC_PATTERN = /\/\*\*[\s\S]*?\*\//;

/** Export patterns by kind */
const EXPORT_PATTERNS: Record<ExportKind, RegExp> = {
  function: /export\s+(async\s+)?function\s+(\w+)/g,
  class: /export\s+class\s+(\w+)/g,
  interface: /export\s+interface\s+(\w+)/g,
  type: /export\s+type\s+(\w+)/g,
  const: /export\s+const\s+(\w+)/g,
  default: /export\s+default\s+/g,
};

/** Quality check rules */
const QUALITY_RULES: Array<{
  check: (jsdoc: string) => boolean;
  issue: DocIssueType;
  message: string;
  weight: number;
}> = [
  {
    check: (doc) => doc.includes("@param"),
    issue: "missing_params",
    message: "No @param tags found for function with parameters",
    weight: 15,
  },
  {
    check: (doc) => doc.includes("@returns") || doc.includes("@return"),
    issue: "missing_returns",
    message: "No @returns tag for function with return value",
    weight: 10,
  },
  {
    check: (doc) => doc.includes("@example"),
    issue: "missing_example",
    message: "No @example provided",
    weight: 5,
  },
  {
    check: (doc) => {
      const descMatch = doc.match(/\/\*\*\s*\n?\s*\*\s*(.+)/);
      return descMatch ? descMatch[1].trim().length >= 10 : false;
    },
    issue: "too_short",
    message: "Description is too short (less than 10 characters)",
    weight: 10,
  },
];

/** Priority determination based on export kind */
const KIND_PRIORITY: Record<ExportKind, "high" | "medium" | "low"> = {
  function: "high",
  class: "high",
  interface: "medium",
  type: "medium",
  const: "low",
  default: "high",
};

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a single file's documentation quality.
 *
 * @param filePath - Path to the file (for reporting)
 * @param content - File content as string
 * @returns File documentation report
 */
export function analyzeFileDoc(
  filePath: string,
  content: string
): {
  report: FileDocReport;
  undocumented: UndocumentedSymbol[];
  qualityIssues: DocQualityIssue[];
} {
  const exports: Array<{ name: string; kind: ExportKind; line: number }> = [];

  // Find all exports
  for (const [kind, pattern] of Object.entries(EXPORT_PATTERNS) as Array<
    [ExportKind, RegExp]
  >) {
    const regex = new RegExp(pattern.source, "g");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const name =
        kind === "default"
          ? "default"
          : kind === "function"
            ? match[2]
            : match[1];
      if (name) {
        const linesBefore = content.slice(0, match.index).split("\n").length;
        exports.push({ name, kind, line: linesBefore });
      }
    }
  }

  // Check each export for JSDoc
  const undocumented: UndocumentedSymbol[] = [];
  const qualityIssues: DocQualityIssue[] = [];
  let documented = 0;

  for (const exp of exports) {
    const lineStart = content.split("\n").slice(0, exp.line - 1).join("\n").length;
    const contextBefore = content.slice(Math.max(0, lineStart - 500), lineStart);
    const hasJSDoc = JSDOC_PATTERN.test(contextBefore.slice(-300));

    if (hasJSDoc) {
      documented++;
      // Check quality of the JSDoc
      const jsdocMatch = contextBefore.slice(-300).match(/\/\*\*[\s\S]*?\*\//);
      if (jsdocMatch && exp.kind === "function") {
        for (const rule of QUALITY_RULES) {
          if (!rule.check(jsdocMatch[0])) {
            qualityIssues.push({
              filePath,
              symbolName: exp.name,
              issue: rule.issue,
              message: rule.message,
            });
          }
        }
      }
    } else {
      undocumented.push({
        filePath,
        name: exp.name,
        kind: exp.kind,
        priority: KIND_PRIORITY[exp.kind],
      });
    }
  }

  const totalExports = exports.length;
  const coverage = totalExports > 0 ? Math.round((documented / totalExports) * 100) : 100;

  return {
    report: { filePath, totalExports, documented, coverage },
    undocumented,
    qualityIssues,
  };
}

/**
 * Aggregate file-level reports into a project-level doc quality report.
 */
export function buildDocQualityReport(
  fileResults: Array<ReturnType<typeof analyzeFileDoc>>
): DocQualityReport {
  const fileReports = fileResults.map((r) => r.report);
  const undocumented = fileResults.flatMap((r) => r.undocumented);
  const qualityIssues = fileResults.flatMap((r) => r.qualityIssues);

  const totalExports = fileReports.reduce((sum, r) => sum + r.totalExports, 0);
  const documentedExports = fileReports.reduce((sum, r) => sum + r.documented, 0);
  const coverage = totalExports > 0 ? Math.round((documentedExports / totalExports) * 100) : 100;

  // Quality score: coverage (60%) + quality of existing docs (40%)
  const qualityPenalty = Math.min(qualityIssues.length * 2, 40);
  const qualityScore = Math.max(
    0,
    Math.round(coverage * 0.6 + (100 - qualityPenalty) * 0.4)
  );

  return {
    totalExports,
    documentedExports,
    coverage,
    qualityScore,
    grade: scoreToGrade(qualityScore),
    filesAnalyzed: fileReports.length,
    fileReports,
    undocumented,
    qualityIssues,
  };
}

/**
 * Check if documentation meets a minimum coverage threshold.
 *
 * @param report - The doc quality report
 * @param threshold - Minimum coverage percentage (0-100)
 * @returns Whether the coverage meets the threshold
 */
export function meetsThreshold(
  report: DocQualityReport,
  threshold: number
): boolean {
  return report.coverage >= threshold;
}

/**
 * Get priority-sorted list of symbols to document next.
 * High-priority: functions and classes.
 * Medium: interfaces and types.
 * Low: constants.
 */
export function getPriorityDocTargets(
  report: DocQualityReport,
  limit = 10
): UndocumentedSymbol[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...report.undocumented]
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, limit);
}

/**
 * Format the doc quality report as a human-readable string.
 */
export function formatDocQualityReport(report: DocQualityReport): string {
  const lines: string[] = [
    `Doc Quality Report: ${report.qualityScore}/100 (${report.grade})`,
    `Files analyzed: ${report.filesAnalyzed}`,
    `Coverage: ${report.documentedExports}/${report.totalExports} exports (${report.coverage}%)`,
    `Quality issues: ${report.qualityIssues.length}`,
    "",
  ];

  if (report.undocumented.length > 0) {
    lines.push("Top undocumented symbols:");
    const top5 = getPriorityDocTargets(report, 5);
    for (const sym of top5) {
      lines.push(`  [${sym.priority}] ${sym.kind} ${sym.name} (${sym.filePath})`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
