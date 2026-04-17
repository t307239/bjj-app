#!/usr/bin/env node
/**
 * scripts/check-types-strict.mjs — Q-133: Stricter type checking guard
 *
 * Scans TypeScript files for patterns that weaken type safety:
 * - `as any` casts
 * - `@ts-ignore` / `@ts-expect-error` without explanation
 * - `// eslint-disable` without reason
 * - Bare `catch` without typed error
 *
 * Usage:
 *   node scripts/check-types-strict.mjs           # default check
 *   node scripts/check-types-strict.mjs --json     # JSON output for CI
 *   node scripts/check-types-strict.mjs --fix-hint # show fix suggestions
 *
 * Exit codes:
 *   0 — no new issues (or below threshold)
 *   1 — issues found above threshold
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC_DIRS = ["app", "lib", "components"];
const EXTENSIONS = [".ts", ".tsx"];

// Known baseline counts (to detect regression, not fix existing)
const BASELINE = {
  AS_ANY: 15,           // Allow up to N existing `as any`
  TS_IGNORE: 5,         // Allow up to N existing @ts-ignore
  ESLINT_DISABLE: 10,   // Allow up to N existing eslint-disable
  BARE_CATCH: 20,       // Allow up to N existing bare catch
};

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const fixHint = args.includes("--fix-hint");

function collectFiles(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules" || entry === "__tests__") continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...collectFiles(fullPath));
      } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return results;
}

function scanFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const issues = [];
  const relPath = relative(ROOT, filePath);

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // as any
    if (/\bas\s+any\b/.test(line) && !trimmed.startsWith("//")) {
      issues.push({
        file: relPath,
        line: lineNum,
        rule: "AS_ANY",
        text: trimmed.slice(0, 80),
        hint: fixHint ? "Use a specific type assertion instead of `as any`" : undefined,
      });
    }

    // @ts-ignore without explanation
    if (/@ts-ignore/.test(line) && !/@ts-ignore\s+.{10,}/.test(line)) {
      issues.push({
        file: relPath,
        line: lineNum,
        rule: "TS_IGNORE",
        text: trimmed.slice(0, 80),
        hint: fixHint ? "Use @ts-expect-error with an explanation, or fix the type error" : undefined,
      });
    }

    // eslint-disable without reason
    if (/eslint-disable/.test(line) && !/eslint-disable.*--\s*.{5,}/.test(line) && !trimmed.startsWith("*")) {
      issues.push({
        file: relPath,
        line: lineNum,
        rule: "ESLINT_DISABLE",
        text: trimmed.slice(0, 80),
        hint: fixHint ? "Add a `-- reason` comment after eslint-disable" : undefined,
      });
    }

    // Bare catch (no error type annotation)
    if (/\bcatch\s*\(\s*\w+\s*\)/.test(line) && !/catch\s*\(\s*\w+\s*:\s*\w+/.test(line)) {
      issues.push({
        file: relPath,
        line: lineNum,
        rule: "BARE_CATCH",
        text: trimmed.slice(0, 80),
        hint: fixHint ? "Type the error parameter: catch (e: unknown) or catch (e: Error)" : undefined,
      });
    }
  });

  return issues;
}

// Collect and scan
const files = SRC_DIRS.flatMap((dir) => collectFiles(join(ROOT, "bjj-app", dir)));
const allIssues = files.flatMap(scanFile);

// Group by rule
const grouped = {};
for (const issue of allIssues) {
  if (!grouped[issue.rule]) grouped[issue.rule] = [];
  grouped[issue.rule].push(issue);
}

// Check against baseline
const regressions = {};
let hasRegression = false;
for (const [rule, baseline] of Object.entries(BASELINE)) {
  const count = (grouped[rule] || []).length;
  if (count > baseline) {
    regressions[rule] = { count, baseline, delta: count - baseline };
    hasRegression = true;
  }
}

if (jsonOutput) {
  console.log(JSON.stringify({
    total: allIssues.length,
    byRule: Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.length])),
    regressions,
    hasRegression,
  }));
} else {
  console.log(`\n🔍 Type Safety Check — ${allIssues.length} issues found\n`);

  for (const [rule, issues] of Object.entries(grouped)) {
    const baseline = BASELINE[rule] ?? 0;
    const icon = issues.length > baseline ? "🔴" : "✅";
    console.log(`  ${icon} ${rule}: ${issues.length} (baseline: ${baseline})`);
    if (fixHint && issues.length > 0) {
      const sample = issues[0];
      console.log(`     Example: ${sample.file}:${sample.line}`);
      if (sample.hint) console.log(`     💡 ${sample.hint}`);
    }
  }

  if (hasRegression) {
    console.log("\n⚠️  Regressions detected:");
    for (const [rule, info] of Object.entries(regressions)) {
      console.log(`   ${rule}: ${info.count} > baseline ${info.baseline} (+${info.delta})`);
    }
  } else {
    console.log("\n✅ No regressions — all within baseline");
  }
}

process.exit(hasRegression ? 1 : 0);
