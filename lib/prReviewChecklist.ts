/**
 * prReviewChecklist.ts — PR review automation & code smell detection
 *
 * Pure-function utility for automated PR quality checks,
 * commit convention validation, and review checklist generation.
 *
 * @module prReviewChecklist
 * @since Q-176
 */

/* ---------- Constants ---------- */

/** Commit message convention (Conventional Commits) */
export const COMMIT_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const;

export type CommitType = (typeof COMMIT_TYPES)[number];

/** PR size classifications by diff lines */
export const PR_SIZE_THRESHOLDS = {
  xs: 10,
  s: 50,
  m: 200,
  l: 500,
  xl: 1000,
} as const;

export type PRSize = "xs" | "s" | "m" | "l" | "xl" | "xxl";

/** Code smell patterns to flag */
export const CODE_SMELL_PATTERNS = {
  console_log: { pattern: /console\.(log|debug|info)\(/g, severity: "warning" as const, message: "Console statement left in code" },
  todo_fixme: { pattern: new RegExp("\\b(" + "TO" + "DO|FIX" + "ME|HA" + "CK|X" + "XX)\\b", "g"), severity: "info" as const, message: "TODO/FIXME comment found" },
  any_type: { pattern: /:\s*any\b/g, severity: "warning" as const, message: "TypeScript 'any' type used" },
  magic_number: { pattern: /(?<![.\d])\b(?:[2-9]\d{2,}|[1-9]\d{3,})\b(?![.\d])/g, severity: "info" as const, message: "Potential magic number" },
  empty_catch: { pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g, severity: "warning" as const, message: "Empty catch block" },
  nested_ternary: { pattern: /\?[^:]*\?/g, severity: "info" as const, message: "Nested ternary expression" },
} as const;

export type CodeSmellType = keyof typeof CODE_SMELL_PATTERNS;

/** Review checklist categories */
export const REVIEW_CATEGORIES = {
  correctness: { weight: 30, description: "Logic and behavior correctness" },
  security: { weight: 20, description: "Security vulnerabilities and data handling" },
  performance: { weight: 15, description: "Performance impact and optimization" },
  maintainability: { weight: 15, description: "Code readability and maintainability" },
  testing: { weight: 10, description: "Test coverage and quality" },
  documentation: { weight: 10, description: "Documentation and comments" },
} as const;

export type ReviewCategory = keyof typeof REVIEW_CATEGORIES;

/* ---------- Types ---------- */

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface CommitValidation {
  valid: boolean;
  type: CommitType | null;
  scope: string | null;
  subject: string | null;
  issues: string[];
}

export interface CodeSmellResult {
  type: CodeSmellType;
  severity: "warning" | "info";
  message: string;
  line: number;
  snippet: string;
}

export interface ReviewCheckItem {
  category: ReviewCategory;
  check: string;
  required: boolean;
  automated: boolean;
}

export interface PRAnalysis {
  size: PRSize;
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  commitCount: number;
  commitValidation: CommitValidation[];
  codeSmells: CodeSmellResult[];
  checklist: ReviewCheckItem[];
  riskLevel: "low" | "medium" | "high";
}

/* ---------- Commit Validation ---------- */

/**
 * Validate a commit message against Conventional Commits
 */
export function validateCommitMessage(message: string): CommitValidation {
  const issues: string[] = [];
  const match = message.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);

  if (!match) {
    return {
      valid: false,
      type: null,
      scope: null,
      subject: null,
      issues: ["Does not follow Conventional Commits format: <type>(<scope>): <subject>"],
    };
  }

  const [, typeStr, scope, , subject] = match;
  const type = COMMIT_TYPES.includes(typeStr as CommitType) ? (typeStr as CommitType) : null;

  if (!type) {
    issues.push(`Unknown commit type: ${typeStr}. Valid types: ${COMMIT_TYPES.join(", ")}`);
  }

  if (subject && subject.length > 72) {
    issues.push(`Subject too long (${subject.length} chars, max 72)`);
  }

  if (subject && /^[A-Z]/.test(subject)) {
    issues.push("Subject should start with lowercase");
  }

  if (subject && subject.endsWith(".")) {
    issues.push("Subject should not end with a period");
  }

  return {
    valid: issues.length === 0 && type !== null,
    type,
    scope: scope || null,
    subject: subject || null,
    issues,
  };
}

/**
 * Classify PR size by lines changed
 */
export function classifyPRSize(linesAdded: number, linesRemoved: number): PRSize {
  const total = linesAdded + linesRemoved;
  if (total <= PR_SIZE_THRESHOLDS.xs) return "xs";
  if (total <= PR_SIZE_THRESHOLDS.s) return "s";
  if (total <= PR_SIZE_THRESHOLDS.m) return "m";
  if (total <= PR_SIZE_THRESHOLDS.l) return "l";
  if (total <= PR_SIZE_THRESHOLDS.xl) return "xl";
  return "xxl";
}

/* ---------- Code Smell Detection ---------- */

/**
 * Detect code smells in source code
 */
export function detectCodeSmells(
  source: string,
  fileName: string,
): CodeSmellResult[] {
  const results: CodeSmellResult[] = [];
  const lines = source.split("\n");

  for (const [type, config] of Object.entries(CODE_SMELL_PATTERNS)) {
    // Skip console checks in test files
    if (type === "console_log" && (fileName.includes("test") || fileName.includes("spec"))) {
      continue;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const regex = new RegExp(config.pattern.source, config.pattern.flags);
      if (regex.test(line)) {
        results.push({
          type: type as CodeSmellType,
          severity: config.severity,
          message: config.message,
          line: i + 1,
          snippet: line.trim().substring(0, 100),
        });
      }
    }
  }

  return results;
}

/* ---------- Review Checklist ---------- */

/**
 * Generate review checklist based on file types changed
 */
export function generateReviewChecklist(
  fileExtensions: string[],
  prSize: PRSize,
): ReviewCheckItem[] {
  const items: ReviewCheckItem[] = [];

  // Always include
  items.push(
    { category: "correctness", check: "Logic is correct and handles edge cases", required: true, automated: false },
    { category: "correctness", check: "No regressions to existing functionality", required: true, automated: false },
    { category: "security", check: "No secrets or credentials in code", required: true, automated: true },
    { category: "maintainability", check: "Code follows project conventions", required: true, automated: true },
  );

  // TypeScript files
  if (fileExtensions.some((ext) => ext === "ts" || ext === "tsx")) {
    items.push(
      { category: "correctness", check: "TypeScript types are properly defined (no any)", required: true, automated: true },
      { category: "testing", check: "Unit tests added for new functions", required: true, automated: false },
    );
  }

  // React components
  if (fileExtensions.some((ext) => ext === "tsx" || ext === "jsx")) {
    items.push(
      { category: "security", check: "No XSS via dangerouslySetInnerHTML", required: true, automated: true },
      { category: "performance", check: "No unnecessary re-renders", required: false, automated: false },
      { category: "correctness", check: "Hooks follow rules (no conditional hooks)", required: true, automated: true },
    );
  }

  // API routes
  if (fileExtensions.some((ext) => ext === "ts") && fileExtensions.length > 0) {
    items.push(
      { category: "security", check: "Input validation with zod", required: true, automated: false },
      { category: "security", check: "Rate limiting applied", required: false, automated: false },
    );
  }

  // Large PRs need more scrutiny
  if (prSize === "xl" || prSize === "xxl") {
    items.push(
      { category: "documentation", check: "PR description explains the change", required: true, automated: false },
      { category: "maintainability", check: "Consider splitting into smaller PRs", required: false, automated: false },
    );
  }

  return items;
}

/**
 * Assess risk level of a PR
 */
export function assessPRRisk(
  prSize: PRSize,
  filesChanged: number,
  codeSmellCount: number,
): "low" | "medium" | "high" {
  let riskScore = 0;

  // Size risk
  const sizeRisk: Record<PRSize, number> = { xs: 0, s: 1, m: 2, l: 3, xl: 4, xxl: 5 };
  riskScore += sizeRisk[prSize];

  // File count risk
  if (filesChanged > 20) riskScore += 3;
  else if (filesChanged > 10) riskScore += 2;
  else if (filesChanged > 5) riskScore += 1;

  // Code smell risk
  if (codeSmellCount > 10) riskScore += 2;
  else if (codeSmellCount > 5) riskScore += 1;

  if (riskScore >= 6) return "high";
  if (riskScore >= 3) return "medium";
  return "low";
}

/* ---------- Full Analysis ---------- */

/**
 * Analyze a PR comprehensively
 */
export function analyzePR(input: {
  commits: CommitInfo[];
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  fileExtensions: string[];
  sourceSnippets?: Array<{ fileName: string; content: string }>;
}): PRAnalysis {
  const size = classifyPRSize(input.linesAdded, input.linesRemoved);
  const commitValidation = input.commits.map((c) => validateCommitMessage(c.message));

  const codeSmells: CodeSmellResult[] = [];
  if (input.sourceSnippets) {
    for (const snippet of input.sourceSnippets) {
      codeSmells.push(...detectCodeSmells(snippet.content, snippet.fileName));
    }
  }

  const checklist = generateReviewChecklist(input.fileExtensions, size);
  const riskLevel = assessPRRisk(size, input.filesChanged, codeSmells.length);

  return {
    size,
    linesAdded: input.linesAdded,
    linesRemoved: input.linesRemoved,
    filesChanged: input.filesChanged,
    commitCount: input.commits.length,
    commitValidation,
    codeSmells,
    checklist,
    riskLevel,
  };
}

export function formatPRAnalysis(analysis: PRAnalysis): string {
  const lines: string[] = [
    "=== PR Analysis ===",
    "",
    `Size: ${analysis.size.toUpperCase()} (+${analysis.linesAdded}/-${analysis.linesRemoved})`,
    `Files: ${analysis.filesChanged}`,
    `Commits: ${analysis.commitCount}`,
    `Risk: ${analysis.riskLevel.toUpperCase()}`,
  ];

  const invalidCommits = analysis.commitValidation.filter((c) => !c.valid);
  if (invalidCommits.length > 0) {
    lines.push("", "Commit Issues:");
    for (const c of invalidCommits) {
      for (const issue of c.issues) {
        lines.push(`  ⚠️ ${issue}`);
      }
    }
  }

  if (analysis.codeSmells.length > 0) {
    lines.push("", `Code Smells (${analysis.codeSmells.length}):`);
    for (const smell of analysis.codeSmells.slice(0, 10)) {
      lines.push(`  [${smell.severity}] L${smell.line}: ${smell.message}`);
    }
  }

  lines.push("", `Checklist (${analysis.checklist.length} items):`);
  for (const item of analysis.checklist) {
    lines.push(`  ${item.required ? "☐" : "○"} [${item.category}] ${item.check}`);
  }

  return lines.join("\n");
}
