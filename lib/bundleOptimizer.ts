/**
 * bundleOptimizer.ts — Bundle optimization analysis & code-splitting strategy
 *
 * Pure-function utility for analyzing JavaScript bundle composition,
 * detecting optimization opportunities, and recommending code-splitting strategies.
 *
 * @module bundleOptimizer
 * @since Q-172
 */

/* ---------- Constants ---------- */

/** Budget thresholds in bytes */
export const BUNDLE_BUDGETS = {
  /** Max total JS for initial page load */
  maxInitialJS: 250_000,
  /** Max single chunk size */
  maxChunkSize: 150_000,
  /** Max number of chunks for initial load */
  maxInitialChunks: 15,
  /** Target for above-the-fold JS */
  maxCriticalPathJS: 100_000,
  /** Threshold for "large dependency" */
  largeDependencyThreshold: 50_000,
} as const;

/** Common libraries that should be lazy-loaded */
export const LAZY_LOAD_CANDIDATES = [
  "chart.js",
  "recharts",
  "d3",
  "three",
  "moment",
  "lodash",
  "date-fns",
  "pdf-lib",
  "xlsx",
  "marked",
  "highlight.js",
  "katex",
  "mapbox-gl",
  "leaflet",
] as const;

/** Route-based splitting categories */
export const ROUTE_CATEGORIES = {
  critical: { priority: 1, prefetch: true, label: "Above the fold" },
  important: { priority: 2, prefetch: true, label: "Likely navigation" },
  secondary: { priority: 3, prefetch: false, label: "On-demand only" },
  admin: { priority: 4, prefetch: false, label: "Admin/debug" },
} as const;

export type RouteCategory = keyof typeof ROUTE_CATEGORIES;

/* ---------- Types ---------- */

export interface ChunkInfo {
  name: string;
  sizeBytes: number;
  modules: string[];
  isEntry: boolean;
  isDynamic: boolean;
}

export interface DependencyInfo {
  name: string;
  sizeBytes: number;
  usedBy: string[];
  isTreeShakeable: boolean;
}

export interface SplittingRecommendation {
  type: "dynamic_import" | "route_split" | "vendor_chunk" | "tree_shake" | "remove_unused";
  target: string;
  reason: string;
  estimatedSavingsBytes: number;
  priority: "high" | "medium" | "low";
}

export interface BundleAnalysis {
  totalSizeBytes: number;
  chunkCount: number;
  entryChunks: number;
  dynamicChunks: number;
  largestChunk: ChunkInfo;
  budgetStatus: {
    totalJS: "pass" | "warn" | "fail";
    largestChunk: "pass" | "warn" | "fail";
    chunkCount: "pass" | "warn" | "fail";
  };
  recommendations: SplittingRecommendation[];
  score: number;
}

/* ---------- Analysis functions ---------- */

/**
 * Classify bundle budget status
 */
function classifyBudget(value: number, budget: number): "pass" | "warn" | "fail" {
  if (value <= budget) return "pass";
  if (value <= budget * 1.2) return "warn";
  return "fail";
}

/**
 * Analyze bundle chunks and produce optimization report
 */
export function analyzeBundleChunks(chunks: ChunkInfo[]): BundleAnalysis {
  const totalSizeBytes = chunks.reduce((sum, c) => sum + c.sizeBytes, 0);
  const entryChunks = chunks.filter((c) => c.isEntry);
  const dynamicChunks = chunks.filter((c) => c.isDynamic);
  const largestChunk = chunks.reduce(
    (max, c) => (c.sizeBytes > max.sizeBytes ? c : max),
    chunks[0] || { name: "", sizeBytes: 0, modules: [], isEntry: false, isDynamic: false },
  );

  const entrySizeBytes = entryChunks.reduce((sum, c) => sum + c.sizeBytes, 0);

  const budgetStatus = {
    totalJS: classifyBudget(entrySizeBytes, BUNDLE_BUDGETS.maxInitialJS),
    largestChunk: classifyBudget(largestChunk.sizeBytes, BUNDLE_BUDGETS.maxChunkSize),
    chunkCount: classifyBudget(entryChunks.length, BUNDLE_BUDGETS.maxInitialChunks),
  };

  const recommendations = generateSplittingRecommendations(chunks);

  // Score 0-100 based on budget status
  const penalties = {
    pass: 0,
    warn: 10,
    fail: 25,
  };
  const budgetPenalty =
    penalties[budgetStatus.totalJS] +
    penalties[budgetStatus.largestChunk] +
    penalties[budgetStatus.chunkCount];
  const score = Math.max(0, 100 - budgetPenalty - recommendations.filter((r) => r.priority === "high").length * 5);

  return {
    totalSizeBytes,
    chunkCount: chunks.length,
    entryChunks: entryChunks.length,
    dynamicChunks: dynamicChunks.length,
    largestChunk,
    budgetStatus,
    recommendations,
    score,
  };
}

/**
 * Generate code-splitting recommendations from chunk analysis
 */
export function generateSplittingRecommendations(chunks: ChunkInfo[]): SplittingRecommendation[] {
  const recs: SplittingRecommendation[] = [];

  for (const chunk of chunks) {
    // Large entry chunks should be split
    if (chunk.isEntry && chunk.sizeBytes > BUNDLE_BUDGETS.maxChunkSize) {
      recs.push({
        type: "route_split",
        target: chunk.name,
        reason: `Entry chunk ${chunk.name} is ${formatBytes(chunk.sizeBytes)} (budget: ${formatBytes(BUNDLE_BUDGETS.maxChunkSize)})`,
        estimatedSavingsBytes: Math.round(chunk.sizeBytes * 0.3),
        priority: "high",
      });
    }

    // Detect lazy-load candidates in entry chunks
    if (chunk.isEntry) {
      for (const mod of chunk.modules) {
        const lazyCandidate = LAZY_LOAD_CANDIDATES.find((lib) => mod.includes(lib));
        if (lazyCandidate) {
          recs.push({
            type: "dynamic_import",
            target: lazyCandidate,
            reason: `${lazyCandidate} is loaded in entry chunk but should be lazy-loaded`,
            estimatedSavingsBytes: BUNDLE_BUDGETS.largeDependencyThreshold,
            priority: "high",
          });
        }
      }
    }
  }

  return recs;
}

/**
 * Detect dependencies that could benefit from tree-shaking
 */
export function detectTreeShakeOpportunities(deps: DependencyInfo[]): SplittingRecommendation[] {
  const recs: SplittingRecommendation[] = [];

  for (const dep of deps) {
    if (!dep.isTreeShakeable && dep.sizeBytes > BUNDLE_BUDGETS.largeDependencyThreshold) {
      recs.push({
        type: "tree_shake",
        target: dep.name,
        reason: `${dep.name} (${formatBytes(dep.sizeBytes)}) is not tree-shakeable — consider a lighter alternative`,
        estimatedSavingsBytes: Math.round(dep.sizeBytes * 0.5),
        priority: dep.sizeBytes > 100_000 ? "high" : "medium",
      });
    }

    if (dep.usedBy.length === 0) {
      recs.push({
        type: "remove_unused",
        target: dep.name,
        reason: `${dep.name} appears unused — can be safely removed`,
        estimatedSavingsBytes: dep.sizeBytes,
        priority: dep.sizeBytes > BUNDLE_BUDGETS.largeDependencyThreshold ? "high" : "low",
      });
    }
  }

  return recs;
}

/**
 * Classify routes for prefetch priority
 */
export function classifyRoutes(
  routes: Array<{ path: string; sizeBytes: number }>,
): Array<{ path: string; sizeBytes: number; category: RouteCategory; shouldPrefetch: boolean }> {
  return routes.map((route) => {
    let category: RouteCategory;
    if (route.path === "/" || route.path === "/dashboard" || route.path === "/login") {
      category = "critical";
    } else if (route.path.startsWith("/admin")) {
      category = "admin";
    } else if (
      route.path === "/records" ||
      route.path === "/techniques" ||
      route.path === "/profile"
    ) {
      category = "important";
    } else {
      category = "secondary";
    }

    return {
      ...route,
      category,
      shouldPrefetch: ROUTE_CATEGORIES[category].prefetch,
    };
  });
}

/**
 * Calculate potential savings from all recommendations
 */
export function estimateTotalSavings(recs: SplittingRecommendation[]): {
  totalSavingsBytes: number;
  byPriority: Record<string, number>;
  topOpportunities: SplittingRecommendation[];
} {
  const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };
  let totalSavingsBytes = 0;

  for (const rec of recs) {
    totalSavingsBytes += rec.estimatedSavingsBytes;
    byPriority[rec.priority] = (byPriority[rec.priority] || 0) + rec.estimatedSavingsBytes;
  }

  const topOpportunities = [...recs]
    .sort((a, b) => b.estimatedSavingsBytes - a.estimatedSavingsBytes)
    .slice(0, 5);

  return { totalSavingsBytes, byPriority, topOpportunities };
}

/* ---------- Formatting ---------- */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function formatBundleAnalysis(analysis: BundleAnalysis): string {
  const lines: string[] = [
    "=== Bundle Analysis ===",
    "",
    `Total Size: ${formatBytes(analysis.totalSizeBytes)}`,
    `Chunks: ${analysis.chunkCount} (${analysis.entryChunks} entry, ${analysis.dynamicChunks} dynamic)`,
    `Largest Chunk: ${analysis.largestChunk.name} (${formatBytes(analysis.largestChunk.sizeBytes)})`,
    `Score: ${analysis.score}/100`,
    "",
    "Budget Status:",
    `  Total JS: ${analysis.budgetStatus.totalJS.toUpperCase()}`,
    `  Largest Chunk: ${analysis.budgetStatus.largestChunk.toUpperCase()}`,
    `  Chunk Count: ${analysis.budgetStatus.chunkCount.toUpperCase()}`,
  ];

  if (analysis.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const rec of analysis.recommendations) {
      lines.push(`  [${rec.priority.toUpperCase()}] ${rec.type}: ${rec.reason}`);
    }
  }

  return lines.join("\n");
}
