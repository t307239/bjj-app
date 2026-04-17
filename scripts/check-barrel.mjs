#!/usr/bin/env node
/**
 * scripts/check-barrel.mjs — Verify lib/index.ts barrel export completeness
 *
 * Q-112: DX pillar — ensures all public lib/ modules are re-exported
 * from the barrel file, keeping imports clean and discoverable.
 *
 * Usage:
 *   node scripts/check-barrel.mjs          # check mode (exit 1 on missing)
 *   node scripts/check-barrel.mjs --list   # list all exports
 *
 * Excluded files (import directly, not via barrel):
 *   - database.types.ts (auto-generated)
 *   - i18n.tsx / techniqueLogTypes.tsx (contains JSX)
 *   - hooks (use*.ts) — React hooks, import individually
 *   - server-only modules (env.ts, webpush.ts)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIB_DIR = path.resolve(__dirname, "..", "lib");
const BARREL = path.join(LIB_DIR, "index.ts");

// Files intentionally excluded from barrel
const EXCLUDED = new Set([
  "index.ts",
  "database.types.ts",
  "i18n.tsx",
  "techniqueLogTypes.tsx",
  "webpush.ts",
  "env.ts",
  "supabase",  // directory
]);

// Patterns for files excluded by convention
const EXCLUDED_PATTERNS = [
  /^use[A-Z]/,     // React hooks
  /\.test\./,      // test files
  /\.d\.ts$/,      // type declarations
];

function shouldExclude(filename) {
  if (EXCLUDED.has(filename)) return true;
  return EXCLUDED_PATTERNS.some((p) => p.test(filename));
}

function main() {
  const listMode = process.argv.includes("--list");

  // 1. Read barrel file
  const barrelContent = fs.readFileSync(BARREL, "utf-8");

  // 2. List all .ts/.tsx files in lib/
  const files = fs.readdirSync(LIB_DIR).filter((f) => {
    const stat = fs.statSync(path.join(LIB_DIR, f));
    if (stat.isDirectory()) return false;
    return /\.(ts|tsx)$/.test(f);
  });

  const eligible = files.filter((f) => !shouldExclude(f));
  const missing = [];

  for (const file of eligible) {
    const stem = file.replace(/\.(ts|tsx)$/, "");
    // Check if barrel imports from this file
    const importPattern = new RegExp(`from\\s+["']\\./${stem}["']`);
    if (!importPattern.test(barrelContent)) {
      missing.push(file);
    }
  }

  if (listMode) {
    console.log("📦 Barrel exports from lib/index.ts:\n");
    for (const file of eligible) {
      const stem = file.replace(/\.(ts|tsx)$/, "");
      const importPattern = new RegExp(`from\\s+["']\\./${stem}["']`);
      const inBarrel = importPattern.test(barrelContent);
      console.log(`  ${inBarrel ? "✅" : "❌"} ${file}`);
    }
    console.log(`\n  Excluded: ${[...EXCLUDED].join(", ")}`);
    return;
  }

  if (missing.length === 0) {
    console.log("✅ All eligible lib/ modules are in barrel export");
    process.exit(0);
  } else {
    console.error(`❌ ${missing.length} module(s) missing from lib/index.ts:`);
    for (const f of missing) {
      console.error(`   - ${f}`);
    }
    console.error("\nAdd them to lib/index.ts or add to EXCLUDED in this script.");
    process.exit(1);
  }
}

main();
