/**
 * jsdocCoverageChecker.ts
 *
 * Measures JSDoc documentation coverage for TypeScript/JavaScript exports.
 * Scans source files for exported symbols (functions, types, interfaces,
 * classes, constants, default exports) and determines whether each has a
 * preceding JSDoc block.  Produces coverage reports, highlights gaps,
 * and suggests prioritisation for documentation efforts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Category of an exported symbol. */
export type ExportCategory = 'function' | 'const' | 'type' | 'interface' | 'class' | 'default';

/** Information about a single export. */
export type ExportInfo = {
  name: string;
  category: ExportCategory;
  line: number;
  hasJSDoc: boolean;
};

/** Coverage result for a single file. */
export type CoverageResult = {
  filePath: string;
  exports: ExportInfo[];
  totalExports: number;
  documentedExports: number;
  coveragePercent: number;
};

/** Per-category breakdown. */
export type CategoryBreakdown = {
  category: ExportCategory;
  total: number;
  documented: number;
  percent: number;
};

/** Aggregated coverage report. */
export type CoverageReport = {
  generatedAt: number;
  directory: string;
  fileCount: number;
  totalExports: number;
  documentedExports: number;
  undocumentedExports: number;
  coveragePercent: number;
  byCategory: CategoryBreakdown[];
  files: CoverageResult[];
  grade: string;
};

/** An undocumented export with location info. */
export type UndocumentedExport = {
  filePath: string;
  name: string;
  category: ExportCategory;
  line: number;
};

/** Priority suggestion for documentation. */
export type Priority = {
  export: UndocumentedExport;
  /** 1 = highest priority */
  rank: number;
  reason: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pattern matching a JSDoc comment block. */
export const JSDOC_PATTERN = /\/\*\*[\s\S]*?\*\//;

/**
 * Patterns to detect various export forms.
 * Each regex captures the exported name in group 1.
 */
export const EXPORT_PATTERNS: Record<ExportCategory, RegExp> = {
  function: /^export\s+(?:async\s+)?function\s+(\w+)/,
  const: /^export\s+(?:const|let|var)\s+(\w+)/,
  type: /^export\s+type\s+(\w+)/,
  interface: /^export\s+interface\s+(\w+)/,
  class: /^export\s+(?:abstract\s+)?class\s+(\w+)/,
  default: /^export\s+default\s+(?:function|class|abstract\s+class)\s+(\w+)/,
};

/** Priority weight: functions and classes are more important to document. */
const CATEGORY_PRIORITY: Record<ExportCategory, number> = {
  function: 10,
  class: 9,
  interface: 7,
  type: 6,
  default: 8,
  const: 5,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lineHasJSDoc(lines: string[], lineIndex: number): boolean {
  // Walk backwards from the line before the export to find a JSDoc block.
  let i = lineIndex - 1;
  // Skip blank lines
  while (i >= 0 && lines[i].trim() === '') {
    i--;
  }
  if (i < 0) return false;

  // The JSDoc closing `*/` should be on or near this line
  const closeLine = lines[i].trim();
  if (!closeLine.endsWith('*/')) return false;

  // Walk further back to find `/**`
  while (i >= 0) {
    if (lines[i].includes('/**')) return true;
    i--;
  }
  return false;
}

function gradeFromPercent(percent: number): string {
  if (percent >= 95) return 'A+';
  if (percent >= 90) return 'A';
  if (percent >= 80) return 'B';
  if (percent >= 70) return 'C';
  if (percent >= 50) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse a single file's content for JSDoc coverage of exported symbols.
 *
 * @param filePath - Path to the file (used for reporting only).
 * @param content  - Full text content of the file.
 * @returns Coverage result for the file.
 */
export function analyzeFile(filePath: string, content: string): CoverageResult {
  const lines = content.split('\n');
  const exports: ExportInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    for (const [category, pattern] of Object.entries(EXPORT_PATTERNS) as Array<
      [ExportCategory, RegExp]
    >) {
      const match = trimmed.match(pattern);
      if (match) {
        exports.push({
          name: match[1] ?? 'default',
          category,
          line: i + 1,
          hasJSDoc: lineHasJSDoc(lines, i),
        });
        break; // one match per line
      }
    }
  }

  const documented = exports.filter((e) => e.hasJSDoc).length;
  return {
    filePath,
    exports,
    totalExports: exports.length,
    documentedExports: documented,
    coveragePercent: exports.length > 0 ? Math.round((documented / exports.length) * 100 * 100) / 100 : 100,
  };
}

/**
 * Calculate an aggregated coverage report from multiple file results.
 *
 * @param directory - Root directory (for display purposes).
 * @param results   - Array of per-file coverage results.
 */
export function calculateCoverage(
  directory: string,
  results: CoverageResult[],
): CoverageReport {
  const totalExports = results.reduce((s, r) => s + r.totalExports, 0);
  const documentedExports = results.reduce((s, r) => s + r.documentedExports, 0);
  const undocumented = totalExports - documentedExports;
  const percent = totalExports > 0 ? Math.round((documentedExports / totalExports) * 100 * 100) / 100 : 100;

  // By-category breakdown
  const catMap = new Map<ExportCategory, { total: number; documented: number }>();
  for (const r of results) {
    for (const exp of r.exports) {
      const entry = catMap.get(exp.category) ?? { total: 0, documented: 0 };
      entry.total++;
      if (exp.hasJSDoc) entry.documented++;
      catMap.set(exp.category, entry);
    }
  }

  const byCategory: CategoryBreakdown[] = [...catMap.entries()].map(([cat, data]) => ({
    category: cat,
    total: data.total,
    documented: data.documented,
    percent: data.total > 0 ? Math.round((data.documented / data.total) * 100) : 100,
  }));

  return {
    generatedAt: Date.now(),
    directory,
    fileCount: results.length,
    totalExports,
    documentedExports,
    undocumentedExports: undocumented,
    coveragePercent: percent,
    byCategory,
    files: results,
    grade: gradeFromPercent(percent),
  };
}

/**
 * List all undocumented exports from the given results.
 */
export function findUndocumentedExports(results: CoverageResult[]): UndocumentedExport[] {
  const undocumented: UndocumentedExport[] = [];
  for (const r of results) {
    for (const exp of r.exports) {
      if (!exp.hasJSDoc) {
        undocumented.push({
          filePath: r.filePath,
          name: exp.name,
          category: exp.category,
          line: exp.line,
        });
      }
    }
  }
  return undocumented;
}

/**
 * Generate a formatted coverage report string.
 */
export function generateCoverageReport(
  directory: string,
  results: CoverageResult[],
): string {
  const report = calculateCoverage(directory, results);
  return formatCoverageReport(report);
}

/**
 * Suggest documentation priorities for undocumented exports.
 * Ranks by category importance (functions > classes > interfaces > types > consts).
 */
export function suggestPriorityDocs(undocumented: UndocumentedExport[]): Priority[] {
  const ranked = [...undocumented].sort((a, b) => {
    const diff = CATEGORY_PRIORITY[b.category] - CATEGORY_PRIORITY[a.category];
    return diff !== 0 ? diff : a.filePath.localeCompare(b.filePath);
  });

  return ranked.map((exp, i) => ({
    export: exp,
    rank: i + 1,
    reason: `${exp.category} exports are ${CATEGORY_PRIORITY[exp.category] >= 8 ? 'critical' : 'important'} to document for maintainability.`,
  }));
}

/**
 * Format a CoverageReport as a human-readable string.
 */
export function formatCoverageReport(report: CoverageReport): string {
  const lines: string[] = [
    '=== JSDoc Coverage Report ===',
    `Generated: ${new Date(report.generatedAt).toISOString()}`,
    `Directory: ${report.directory}`,
    `Files scanned: ${report.fileCount}`,
    `Grade: ${report.grade}`,
    '',
    `Total exports: ${report.totalExports}`,
    `Documented:    ${report.documentedExports} (${report.coveragePercent}%)`,
    `Undocumented:  ${report.undocumentedExports}`,
    '',
  ];

  if (report.byCategory.length) {
    lines.push('--- By category ---');
    for (const cat of report.byCategory) {
      lines.push(
        `  ${cat.category.padEnd(12)} ${cat.documented}/${cat.total} (${cat.percent}%)`,
      );
    }
    lines.push('');
  }

  lines.push('--- Per-file ---');
  const sortedFiles = [...report.files].sort((a, b) => a.coveragePercent - b.coveragePercent);
  for (const f of sortedFiles) {
    lines.push(
      `  ${f.coveragePercent.toString().padStart(5)}% | ${f.documentedExports}/${f.totalExports} | ${f.filePath}`,
    );
  }

  return lines.join('\n');
}
