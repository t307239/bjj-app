#!/usr/bin/env node
/**
 * scripts/bundle-size-check.mjs — Next.js bundle size monitoring
 *
 * Q-114: Cost pillar — tracks build output sizes to prevent bundle bloat.
 * Parses .next/build-manifest.json and reports page-level JS sizes.
 *
 * Usage:
 *   node scripts/bundle-size-check.mjs                  # after `next build`
 *   node scripts/bundle-size-check.mjs --max-page 200   # custom per-page limit (KB)
 *   node scripts/bundle-size-check.mjs --json            # JSON output for CI
 *
 * Exit codes:
 *   0 — all pages within budget
 *   1 — one or more pages exceed budget
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.resolve(__dirname, "..", ".next");
const DEFAULT_MAX_PAGE_KB = 200; // per-page JS budget

function parseArgs() {
  const args = process.argv.slice(2);
  let maxPageKb = DEFAULT_MAX_PAGE_KB;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--max-page" && args[i + 1]) {
      maxPageKb = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === "--json") jsonOutput = true;
  }

  return { maxPageKb, jsonOutput };
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function main() {
  const { maxPageKb, jsonOutput } = parseArgs();

  const manifestPath = path.join(BUILD_DIR, "build-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    const msg = ".next/build-manifest.json not found. Run `next build` first.";
    if (jsonOutput) {
      console.log(JSON.stringify({ status: "error", message: msg }));
    } else {
      console.error(`❌ ${msg}`);
    }
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const pages = manifest.pages ?? {};

  // Calculate shared chunks (loaded on every page)
  const sharedChunks = new Set(
    [...(pages["/_app"] ?? []), ...(pages["/_error"] ?? [])]
  );
  let sharedSize = 0;
  for (const chunk of sharedChunks) {
    sharedSize += getFileSize(path.join(BUILD_DIR, chunk));
  }

  // Analyze per-page sizes
  const results = [];
  for (const [pageName, chunks] of Object.entries(pages)) {
    if (pageName.startsWith("/_")) continue; // skip internal pages

    let pageOnlySize = 0;
    for (const chunk of chunks) {
      if (!sharedChunks.has(chunk)) {
        pageOnlySize += getFileSize(path.join(BUILD_DIR, chunk));
      }
    }

    const totalKb = (pageOnlySize + sharedSize) / 1024;
    const pageOnlyKb = pageOnlySize / 1024;

    results.push({
      page: pageName,
      pageOnlyKb: Math.round(pageOnlyKb * 10) / 10,
      totalKb: Math.round(totalKb * 10) / 10,
      chunks: chunks.length,
      overBudget: totalKb > maxPageKb,
    });
  }

  results.sort((a, b) => b.totalKb - a.totalKb);

  const overBudget = results.filter((r) => r.overBudget);

  if (jsonOutput) {
    console.log(JSON.stringify({
      status: overBudget.length > 0 ? "warn" : "ok",
      sharedKb: Math.round((sharedSize / 1024) * 10) / 10,
      maxPageKb,
      totalPages: results.length,
      overBudgetCount: overBudget.length,
      pages: results,
    }));
  } else {
    console.log(`📦 Bundle Size Report (budget: ${maxPageKb}KB/page)\n`);
    console.log(`  Shared chunks: ${formatKB(sharedSize)}\n`);

    for (const r of results.slice(0, 20)) {
      const icon = r.overBudget ? "🔴" : "✅";
      console.log(`  ${icon} ${r.page.padEnd(40)} ${String(r.totalKb).padStart(7)}KB (page: ${r.pageOnlyKb}KB, ${r.chunks} chunks)`);
    }

    if (results.length > 20) {
      console.log(`  ... and ${results.length - 20} more pages`);
    }

    console.log(`\n  ${overBudget.length === 0 ? "✅ All pages within budget" : `🔴 ${overBudget.length} page(s) over ${maxPageKb}KB budget`}`);
  }

  process.exit(overBudget.length > 0 ? 1 : 0);
}

main();
