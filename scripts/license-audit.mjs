#!/usr/bin/env node
/**
 * scripts/license-audit.mjs
 *
 * OSS License Audit — scans all production dependencies and reports license types.
 * Flags potentially problematic licenses (GPL, AGPL, LGPL, CDDL, MPL) that
 * could affect commercial use or M&A due diligence.
 *
 * Usage:
 *   node scripts/license-audit.mjs             # Summary + violations only
 *   node scripts/license-audit.mjs --full      # Full list of all packages
 *   node scripts/license-audit.mjs --json      # JSON output
 *
 * Exit code: 0 = clean, 1 = violations found
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../");
const NODE_MODULES = join(ROOT, "node_modules");
const PKG_JSON = join(ROOT, "package.json");

const FULL = process.argv.includes("--full");
const JSON_OUT = process.argv.includes("--json");

// ── License risk levels ───────────────────────────────────────────────────────

const LICENSE_RISK = {
  // Copyleft — potentially problematic for proprietary commercial SaaS
  AGPL: "CRITICAL",   // GNU Affero GPL — must open-source entire SaaS
  "AGPL-3.0": "CRITICAL",
  GPL: "HIGH",        // GNU GPL — must open-source linked code
  "GPL-2.0": "HIGH",
  "GPL-3.0": "HIGH",
  LGPL: "MEDIUM",     // Lesser GPL — dynamic linking usually OK
  "LGPL-2.1": "MEDIUM",
  "LGPL-3.0": "MEDIUM",
  CDDL: "MEDIUM",     // Common Development and Distribution License
  MPL: "LOW",         // Mozilla Public License — file-level copyleft only
  "MPL-2.0": "LOW",
  EPL: "LOW",         // Eclipse Public License
  EUPL: "MEDIUM",

  // Permissive — safe for commercial use
  MIT: "SAFE",
  "MIT-0": "SAFE",
  ISC: "SAFE",
  BSD: "SAFE",
  "BSD-2-Clause": "SAFE",
  "BSD-3-Clause": "SAFE",
  Apache: "SAFE",
  "Apache-2.0": "SAFE",
  "0BSD": "SAFE",
  Unlicense: "SAFE",
  "CC0-1.0": "SAFE",
  "CC-BY-4.0": "SAFE",
  "CC-BY-3.0": "SAFE",
  Python: "SAFE",
  PSF: "SAFE",
  WTFPL: "SAFE",
  BlueOak: "SAFE",
  "BlueOak-1.0.0": "SAFE",
};

const RISK_EMOJI = {
  CRITICAL: "🚨",
  HIGH: "🔴",
  MEDIUM: "🟡",
  LOW: "🟠",
  SAFE: "✅",
  UNKNOWN: "❓",
};

// ── Load production deps from package.json ────────────────────────────────────

function getProductionDeps() {
  const pkg = JSON.parse(readFileSync(PKG_JSON, "utf-8"));
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
  ]);
}

// ── Read package info from node_modules ──────────────────────────────────────

function readPackageInfo(pkgName) {
  const pkgPath = join(NODE_MODULES, pkgName, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return {
      name: raw.name ?? pkgName,
      version: raw.version ?? "?",
      license: raw.license ?? raw.licenses?.[0]?.type ?? "UNKNOWN",
      repo: raw.repository?.url ?? null,
    };
  } catch {
    return null;
  }
}

function normalizeL(license) {
  if (!license) return "UNKNOWN";
  if (typeof license !== "string") return "UNKNOWN";
  // Strip SPDX expression operators for simple check
  return license.replace(/[()]/g, "").split(/\s+(?:OR|AND|WITH)\s+/)[0].trim();
}

function riskLevel(license) {
  const normalized = normalizeL(license);
  // Exact match
  if (LICENSE_RISK[normalized]) return LICENSE_RISK[normalized];
  // Prefix match
  for (const [key, level] of Object.entries(LICENSE_RISK)) {
    if (normalized.toUpperCase().startsWith(key.toUpperCase())) return level;
  }
  return "UNKNOWN";
}

// ── Main ──────────────────────────────────────────────────────────────────────

const prodDeps = getProductionDeps();

// Also scan transitive deps (direct subdirs of node_modules)
const allPkgs = new Set([...prodDeps]);
try {
  for (const entry of readdirSync(NODE_MODULES, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      if (entry.name.startsWith("@")) {
        // Scoped package — scan sub-entries
        const scopedPath = join(NODE_MODULES, entry.name);
        for (const subEntry of readdirSync(scopedPath, { withFileTypes: true })) {
          if (subEntry.isDirectory()) {
            allPkgs.add(`${entry.name}/${subEntry.name}`);
          }
        }
      } else {
        allPkgs.add(entry.name);
      }
    }
  }
} catch {
  // Use prod deps only
}

const results = [];

for (const pkg of allPkgs) {
  const info = readPackageInfo(pkg);
  if (!info) continue;
  const risk = riskLevel(info.license);
  results.push({ ...info, risk, isProd: prodDeps.has(pkg) });
}

// Sort: violations first, then by risk level
const RISK_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN", "SAFE"];
results.sort((a, b) => {
  const aIdx = RISK_ORDER.indexOf(a.risk);
  const bIdx = RISK_ORDER.indexOf(b.risk);
  if (aIdx !== bIdx) return aIdx - bIdx;
  return a.name.localeCompare(b.name);
});

const violations = results.filter(
  (r) => r.risk === "CRITICAL" || r.risk === "HIGH"
);
const warnings = results.filter(
  (r) => r.risk === "MEDIUM" || r.risk === "LOW" || r.risk === "UNKNOWN"
);

if (JSON_OUT) {
  console.log(JSON.stringify({ violations, warnings, total: results.length }, null, 2));
  process.exit(violations.length > 0 ? 1 : 0);
}

// ── Human-readable output ─────────────────────────────────────────────────────

const w = process.stdout.columns || 80;
console.log("\n" + "─".repeat(w));
console.log(`  🔍 OSS License Audit — BJJ App`);
console.log(`  Scanned ${results.length} packages`);
console.log("─".repeat(w));

if (violations.length > 0) {
  console.log("\n🚨 LICENSE VIOLATIONS (require legal review before shipping):\n");
  for (const r of violations) {
    console.log(
      `  ${RISK_EMOJI[r.risk]} ${r.name}@${r.version}`.padEnd(50) +
      `  ${r.license}`
    );
  }
}

if (warnings.length > 0) {
  console.log("\n⚠️  WARNINGS (review recommended):\n");
  for (const r of warnings) {
    if (FULL || r.risk !== "SAFE") {
      console.log(
        `  ${RISK_EMOJI[r.risk]} ${r.name}@${r.version}`.padEnd(50) +
        `  ${r.license}`
      );
    }
  }
}

if (FULL) {
  console.log("\n✅ SAFE (permissive licenses):\n");
  for (const r of results.filter((r) => r.risk === "SAFE")) {
    console.log(
      `  ${RISK_EMOJI[r.risk]} ${r.name}@${r.version}`.padEnd(50) +
      `  ${r.license}`
    );
  }
}

console.log("\n" + "─".repeat(w));
console.log(
  `  Summary: ${violations.length} violations  |  ${warnings.length} warnings  |  ${results.filter((r) => r.risk === "SAFE").length} safe`
);
console.log("─".repeat(w) + "\n");

if (violations.length > 0) {
  console.error(
    `❌ License audit FAILED — ${violations.length} violation(s) found.\n` +
    `   Review the packages above before shipping to production.\n`
  );
  process.exit(1);
} else {
  console.log("✅ License audit PASSED — no critical violations found.\n");
  process.exit(0);
}
