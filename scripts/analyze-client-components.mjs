#!/usr/bin/env node
/**
 * scripts/analyze-client-components.mjs
 *
 * Q-142: Performance pillar — Analyze "use client" components to find
 * Server Component migration candidates.
 *
 * Scans all .tsx/.ts files for "use client" directive, then checks whether
 * they actually use client-only APIs (hooks, browser globals, event handlers).
 * Produces a migration candidate report with ROI estimates.
 *
 * Usage:
 *   node scripts/analyze-client-components.mjs [--json] [--threshold <score>]
 *
 * Exit codes:
 *   0 — analysis complete (candidates found or not)
 *   1 — script error
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ── Config ──────────────────────────────────────────────────────────────

const APP_DIR = join(process.cwd(), "app");
const COMPONENTS_DIR = join(process.cwd(), "components");

/** Patterns that indicate genuine client-side need */
const CLIENT_INDICATORS = [
  // React hooks
  { pattern: /\buse(State|Effect|Ref|Callback|Memo|Reducer|Context|LayoutEffect|ImperativeHandle|SyncExternalStore|Transition|DeferredValue|Id)\b/, name: "React Hook", weight: 10 },
  // Event handlers in JSX
  { pattern: /\bon(Click|Change|Submit|KeyDown|KeyUp|KeyPress|Focus|Blur|Mouse|Touch|Drag|Scroll|Wheel|Pointer|Input|Paste|Copy|Cut)\b\s*[={]/, name: "Event Handler", weight: 8 },
  // Browser APIs
  { pattern: /\b(window|document|navigator|localStorage|sessionStorage|location\.href|history\.push|fetch)\b/, name: "Browser API", weight: 7 },
  // Dynamic imports / lazy
  { pattern: /\b(dynamic|lazy)\s*\(/, name: "Dynamic Import", weight: 5 },
  // useRouter / usePathname / useSearchParams (Next.js client hooks)
  { pattern: /\buse(Router|Pathname|SearchParams|SelectedLayoutSegment)\b/, name: "Next.js Client Hook", weight: 10 },
  // createContext / useContext consumer
  { pattern: /\b(createContext|useContext)\b/, name: "Context API", weight: 9 },
  // ref callbacks
  { pattern: /\bref\s*=\s*\{/, name: "Ref Assignment", weight: 6 },
  // Animation / intersection observer
  { pattern: /\b(IntersectionObserver|ResizeObserver|MutationObserver|requestAnimationFrame)\b/, name: "Observer/RAF", weight: 7 },
  // Third party client libs
  { pattern: /\bfrom\s+['"](@?sentry|framer-motion|recharts|react-hot-toast)/, name: "Client Library", weight: 8 },
];

/** Patterns that are common in server components */
const SERVER_INDICATORS = [
  { pattern: /\basync\s+function\s+\w+/, name: "Async Function", weight: 3 },
  { pattern: /\bawait\b/, name: "Await Expression", weight: 2 },
  { pattern: /\bexport\s+(const\s+)?metadata\b/, name: "Metadata Export", weight: 5 },
  { pattern: /\bimport.*from\s+['"]@\/lib\/supabase\/server['"]/, name: "Server Supabase", weight: 5 },
];

// ── Helpers ─────────────────────────────────────────────────────────────

function walkDir(dir, exts = [".tsx", ".ts"]) {
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory() && !entry.startsWith(".") && entry !== "node_modules" && entry !== "__tests__") {
        results.push(...walkDir(full, exts));
      } else if (exts.some((e) => entry.endsWith(e))) {
        results.push(full);
      }
    }
  } catch {
    // directory doesn't exist
  }
  return results;
}

function analyzeFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const hasUseClient = /^['"]use client['"];?\s*$/m.test(content);
  if (!hasUseClient) return null;

  const lines = content.split("\n").length;
  const clientHits = [];
  const serverHits = [];

  for (const indicator of CLIENT_INDICATORS) {
    const matches = content.match(new RegExp(indicator.pattern, "g"));
    if (matches) {
      clientHits.push({
        name: indicator.name,
        count: matches.length,
        weight: indicator.weight,
      });
    }
  }

  for (const indicator of SERVER_INDICATORS) {
    const matches = content.match(new RegExp(indicator.pattern, "g"));
    if (matches) {
      serverHits.push({
        name: indicator.name,
        count: matches.length,
        weight: indicator.weight,
      });
    }
  }

  const clientScore = clientHits.reduce((sum, h) => sum + h.weight * h.count, 0);
  const serverScore = serverHits.reduce((sum, h) => sum + h.weight * h.count, 0);

  // Migration ROI: high server score + low client score = good candidate
  const migrationScore = clientScore === 0
    ? 100
    : Math.max(0, Math.round((1 - clientScore / (clientScore + serverScore + 10)) * 100));

  return {
    path: relative(process.cwd(), filePath),
    lines,
    clientScore,
    serverScore,
    migrationScore,
    clientHits,
    serverHits,
    candidate: clientScore === 0,
    review: clientScore > 0 && clientScore <= 15,
  };
}

// ── Main ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const thresholdIdx = args.indexOf("--threshold");
const threshold = thresholdIdx >= 0 ? parseInt(args[thresholdIdx + 1], 10) : 50;

const allFiles = [...walkDir(APP_DIR), ...walkDir(COMPONENTS_DIR)];
const results = allFiles.map(analyzeFile).filter(Boolean);

// Sort by migration score descending
results.sort((a, b) => b.migrationScore - a.migrationScore);

const candidates = results.filter((r) => r.candidate);
const reviewable = results.filter((r) => r.review);
const total = results.length;

const summary = {
  totalClientComponents: total,
  readyToMigrate: candidates.length,
  needsReview: reviewable.length,
  heavilyClient: total - candidates.length - reviewable.length,
  migrationCandidates: candidates.map((c) => ({
    path: c.path,
    lines: c.lines,
    migrationScore: c.migrationScore,
    serverIndicators: c.serverHits.map((h) => h.name),
  })),
  reviewCandidates: reviewable.map((r) => ({
    path: r.path,
    lines: r.lines,
    migrationScore: r.migrationScore,
    clientBlockers: r.clientHits.map((h) => `${h.name}(${h.count})`),
    serverIndicators: r.serverHits.map((h) => h.name),
  })),
};

if (jsonMode) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log("═══ Server Component Migration Analysis ═══\n");
  console.log(`Total "use client" components: ${total}`);
  console.log(`  ✅ Ready to migrate (0 client APIs): ${candidates.length}`);
  console.log(`  🔍 Needs review (low client usage):  ${reviewable.length}`);
  console.log(`  🔒 Heavily client-side:              ${total - candidates.length - reviewable.length}`);
  console.log();

  if (candidates.length > 0) {
    console.log("── Ready to Migrate ──");
    for (const c of candidates) {
      console.log(`  ${c.path} (${c.lines} lines)`);
      if (c.serverHits.length > 0) {
        console.log(`    Server indicators: ${c.serverHits.map((h) => h.name).join(", ")}`);
      }
    }
    console.log();
  }

  if (reviewable.length > 0) {
    console.log("── Needs Review (might be extractable) ──");
    for (const r of reviewable) {
      console.log(`  ${r.path} (${r.lines} lines, score: ${r.migrationScore})`);
      console.log(`    Client blockers: ${r.clientHits.map((h) => `${h.name}(${h.count})`).join(", ")}`);
    }
    console.log();
  }

  console.log(`ROI: Migrating ${candidates.length} components would reduce client JS bundle.`);
}
