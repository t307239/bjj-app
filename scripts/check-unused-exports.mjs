#!/usr/bin/env node
/**
 * scripts/check-unused-exports.mjs — Q-121: Unused export detection
 *
 * Scans lib/*.ts files for named exports and checks if they are
 * imported anywhere in the codebase (app/, components/, __tests__/).
 *
 * Helps maintain a clean API surface by flagging dead exports.
 *
 * Usage:
 *   node scripts/check-unused-exports.mjs [--json] [--fix-hint]
 *
 * Exit codes:
 *   0 — no unused exports found
 *   1 — unused exports detected
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.join(ROOT, "lib");

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const fixHint = args.includes("--fix-hint");

// Files that are entry points or auto-generated — skip analysis
const SKIP_FILES = new Set([
  "index.ts",
  "database.types.ts",
]);

// Exports that are used at runtime or by external tools — never flag
const KNOWN_USED = new Set([
  "middleware", // Next.js middleware
  "config",    // Next.js config export
  "default",   // default exports
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

function walkDir(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
      walkDir(full, predicate, results);
    } else if (predicate(full, entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/** Extract named exports from a .ts file */
function extractExports(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const exports = [];

  // export function name / export async function name
  for (const m of content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
    exports.push(m[1]);
  }
  // export const/let/var name
  for (const m of content.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g)) {
    exports.push(m[1]);
  }
  // export type/interface name
  for (const m of content.matchAll(/export\s+(?:type|interface)\s+(\w+)/g)) {
    exports.push(m[1]);
  }
  // export enum name
  for (const m of content.matchAll(/export\s+enum\s+(\w+)/g)) {
    exports.push(m[1]);
  }

  return exports.filter((e) => !KNOWN_USED.has(e));
}

// ── Main ────────────────────────────────────────────────────────────────────

// 1. Collect all lib exports
const libFiles = walkDir(LIB_DIR, (_, name) => /\.tsx?$/.test(name) && !SKIP_FILES.has(name));

const allExports = [];
for (const f of libFiles) {
  const exports = extractExports(f);
  for (const exp of exports) {
    allExports.push({ name: exp, file: path.relative(ROOT, f) });
  }
}

// 2. Read all consumer files
const consumerDirs = ["app", "components", "__tests__", "scripts"].map((d) => path.join(ROOT, d));
const consumerFiles = [];
for (const dir of consumerDirs) {
  walkDir(dir, (_, name) => /\.(tsx?|jsx?|mjs)$/.test(name), consumerFiles);
}

// Also include lib files themselves (cross-references)
walkDir(LIB_DIR, (_, name) => /\.tsx?$/.test(name), consumerFiles);

const allConsumerContent = consumerFiles
  .map((f) => {
    try { return fs.readFileSync(f, "utf-8"); } catch { return ""; }
  })
  .join("\n");

// 3. Check each export for usage
const unused = [];
for (const exp of allExports) {
  // Build regex: word boundary + export name (not in its own definition file)
  // Simple heuristic: check if the name appears anywhere outside its own file
  const escapedName = exp.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escapedName}\\b`);

  // Count occurrences across all consumer content
  const matches = allConsumerContent.match(new RegExp(`\\b${escapedName}\\b`, "g"));
  const count = matches ? matches.length : 0;

  // The name will appear at least once (its own export declaration).
  // If in lib/index.ts barrel, that's another reference.
  // We consider it "unused" if it appears only in its own file (count <= occurrences in own file)
  const ownContent = fs.readFileSync(path.join(ROOT, exp.file), "utf-8");
  const ownMatches = ownContent.match(new RegExp(`\\b${escapedName}\\b`, "g"));
  const ownCount = ownMatches ? ownMatches.length : 0;

  const externalCount = count - ownCount;
  if (externalCount <= 0) {
    unused.push({
      name: exp.name,
      file: exp.file,
      message: `Export "${exp.name}" from ${exp.file} is not imported elsewhere.`,
      fix: fixHint ? `Remove or internalize "${exp.name}" in ${exp.file}` : undefined,
    });
  }
}

// ── Output ──────────────────────────────────────────────────────────────────

if (jsonOutput) {
  console.log(JSON.stringify({
    total_exports: allExports.length,
    unused_exports: unused,
    summary: {
      total: allExports.length,
      unused: unused.length,
      utilization: `${Math.round(((allExports.length - unused.length) / allExports.length) * 100)}%`,
    },
  }, null, 2));
} else {
  console.log(`\n📦 Export Audit — ${allExports.length} exports in lib/\n`);

  if (unused.length === 0) {
    console.log("✅ All exports are used.\n");
  } else {
    for (const item of unused) {
      console.log(`⚠️  ${item.file}: "${item.name}"`);
      if (item.fix) console.log(`   Fix: ${item.fix}`);
    }
    console.log(`\nSummary: ${unused.length}/${allExports.length} unused exports\n`);
  }
}

process.exit(unused.length > 0 ? 1 : 0);
