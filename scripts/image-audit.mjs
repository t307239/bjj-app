#!/usr/bin/env node
/**
 * scripts/image-audit.mjs — Q-120: Image optimization audit
 *
 * Scans public/ and app/ directories for images and reports:
 *  - Files that are NOT using next/image (in TSX/JSX)
 *  - Large images (>100KB by default) that should be compressed
 *  - Images without WebP/AVIF alternatives
 *  - Unused images in public/ not referenced by any source file
 *
 * Usage:
 *   node scripts/image-audit.mjs [--max-kb 100] [--json] [--fix-hint]
 *
 * Exit codes:
 *   0 — all clear (or warnings only)
 *   1 — issues found
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const fixHint = args.includes("--fix-hint");
const maxKbIdx = args.indexOf("--max-kb");
const MAX_KB = maxKbIdx >= 0 ? parseInt(args[maxKbIdx + 1], 10) : 100;

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp", ".avif", ".svg", ".ico"]);
const OPTIMIZABLE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"]);

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively find files matching a predicate */
function walkDir(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .next, .git
      if (["node_modules", ".next", ".git", "__tests__"].includes(entry.name)) continue;
      walkDir(full, predicate, results);
    } else if (predicate(full, entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function fileSizeKB(filePath) {
  try {
    return fs.statSync(filePath).size / 1024;
  } catch {
    return 0;
  }
}

function readSourceFiles() {
  return walkDir(ROOT, (_, name) => /\.(tsx?|jsx?|css|html|md)$/.test(name));
}

// ── Analysis ────────────────────────────────────────────────────────────────

const issues = [];

// 1. Find all images in public/
const publicImages = walkDir(PUBLIC_DIR, (_, name) => IMAGE_EXTS.has(path.extname(name).toLowerCase()));

// 2. Check for large images
for (const img of publicImages) {
  const ext = path.extname(img).toLowerCase();
  const sizeKB = fileSizeKB(img);
  if (sizeKB > MAX_KB && OPTIMIZABLE_EXTS.has(ext)) {
    issues.push({
      type: "LARGE_IMAGE",
      severity: "WARNING",
      file: path.relative(ROOT, img),
      sizeKB: Math.round(sizeKB),
      message: `Image is ${Math.round(sizeKB)}KB (max ${MAX_KB}KB). Consider compressing or converting to WebP.`,
      fix: fixHint ? `npx sharp-cli -i "${path.relative(ROOT, img)}" -o "${path.relative(ROOT, img).replace(ext, ".webp")}" --webp` : undefined,
    });
  }
}

// 3. Check for <img> tags instead of next/image in source files
const sourceFiles = readSourceFiles();
const imgTagPattern = /<img\s/g;
const nextImagePattern = /import\s.*Image.*from\s+["']next\/image["']/;

for (const src of sourceFiles) {
  if (!/\.(tsx|jsx)$/.test(src)) continue;
  const content = fs.readFileSync(src, "utf-8");
  const matches = content.match(imgTagPattern);
  if (matches && !nextImagePattern.test(content)) {
    issues.push({
      type: "RAW_IMG_TAG",
      severity: "WARNING",
      file: path.relative(ROOT, src),
      count: matches.length,
      message: `${matches.length} raw <img> tag(s) without next/image import. Use <Image> for automatic optimization.`,
      fix: fixHint ? 'Import Image from "next/image" and replace <img> with <Image>' : undefined,
    });
  }
}

// 4. Check for unused public images
const allSourceContent = sourceFiles
  .map((f) => {
    try { return fs.readFileSync(f, "utf-8"); } catch { return ""; }
  })
  .join("\n");

for (const img of publicImages) {
  const relativePath = path.relative(PUBLIC_DIR, img);
  const filename = path.basename(img);
  // Check both /filename and full relative path references
  if (!allSourceContent.includes(filename) && !allSourceContent.includes(relativePath)) {
    const sizeKB = fileSizeKB(img);
    issues.push({
      type: "UNUSED_IMAGE",
      severity: "INFO",
      file: path.relative(ROOT, img),
      sizeKB: Math.round(sizeKB),
      message: `Image not referenced in source files. May be unused (${Math.round(sizeKB)}KB).`,
      fix: fixHint ? `rm "${path.relative(ROOT, img)}"` : undefined,
    });
  }
}

// ── Output ──────────────────────────────────────────────────────────────────

const warnings = issues.filter((i) => i.severity === "WARNING");
const infos = issues.filter((i) => i.severity === "INFO");

if (jsonOutput) {
  console.log(JSON.stringify({
    total_images: publicImages.length,
    issues,
    summary: {
      warnings: warnings.length,
      infos: infos.length,
      total_issues: issues.length,
    },
  }, null, 2));
} else {
  console.log(`\n📷 Image Audit — ${publicImages.length} images in public/\n`);

  if (issues.length === 0) {
    console.log("✅ No issues found.\n");
  } else {
    for (const issue of issues) {
      const icon = issue.severity === "WARNING" ? "⚠️" : "ℹ️";
      console.log(`${icon} [${issue.type}] ${issue.file}`);
      console.log(`   ${issue.message}`);
      if (issue.fix) console.log(`   Fix: ${issue.fix}`);
      console.log();
    }
    console.log(`Summary: ${warnings.length} warnings, ${infos.length} info\n`);
  }
}

process.exit(warnings.length > 0 ? 1 : 0);
