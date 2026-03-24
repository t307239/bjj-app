/**
 * B-18: Static Link Audit Script
 * Scans all TSX/TS files for href/src attributes and checks for 404s.
 *
 * Usage: node scripts/check-links.mjs
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname;
const INTERNAL_LINK_RE = /href=["'](\/?[a-z][^"'#?]*?)["']/g;

// Directories to skip
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "scripts"]);

function* walkTsx(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (!SKIP_DIRS.has(entry)) yield* walkTsx(full);
      } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
        yield full;
      }
    } catch { /* skip inaccessible */ }
  }
}

// Collect all internal links
const seen = new Map(); // href → [files]
for (const file of walkTsx(ROOT)) {
  const content = readFileSync(file, "utf8");
  const rel = file.replace(ROOT, "");
  for (const [, href] of content.matchAll(INTERNAL_LINK_RE)) {
    if (href.startsWith("http") || href.startsWith("mailto") || href === "/") continue;
    if (!seen.has(href)) seen.set(href, []);
    seen.get(href).push(rel);
  }
}

// Check each link maps to an existing app/ route
const APP_DIR = join(ROOT, "app");
function routeExists(href) {
  // Strip leading slash
  const parts = href.replace(/^\//, "").split("/").filter(Boolean);
  // Check app/[parts]/page.tsx or app/[parts]/route.ts
  const candidates = [
    join(APP_DIR, ...parts, "page.tsx"),
    join(APP_DIR, ...parts, "route.ts"),
    join(APP_DIR, ...parts, "page.ts"),
  ];
  return candidates.some(p => {
    try { statSync(p); return true; } catch { return false; }
  });
}

console.log("\n🔍 BJJ App — Static Link Audit\n");
let broken = 0;
let ok = 0;

for (const [href, files] of [...seen.entries()].sort()) {
  if (routeExists(href)) {
    ok++;
  } else {
    broken++;
    console.log(`❌ ${href}`);
    files.forEach(f => console.log(`   ↳ ${f}`));
  }
}

console.log(`\n✅ ${ok} links OK  |  ❌ ${broken} potentially broken`);
if (broken > 0) {
  console.log("\n⚠️  Note: Dynamic routes (e.g. /gym/join/[code]) may show as broken.");
  console.log("   Review manually before treating as actual 404s.\n");
  process.exit(1);
} else {
  console.log("\n🎉 All static internal links are valid!\n");
}
