/**
 * lib/resourceTimingAnalyzer.ts — Resource timing analysis utilities
 *
 * Q-157: Performance pillar — provides resource timing analysis,
 * waterfall optimization suggestions, and render-blocking detection
 * for improving page load performance.
 *
 * Pure utility layer — no DB access, no UI.
 *
 * @example
 *   import { analyzeResourceTiming, detectRenderBlocking, RESOURCE_BUDGETS } from "@/lib/resourceTimingAnalyzer";
 *   const analysis = analyzeResourceTiming(entries);
 *   const blocking = detectRenderBlocking(entries);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface ResourceEntry {
  /** Resource name/URL */
  name: string;
  /** Resource type (script, stylesheet, img, font, fetch, xmlhttprequest, other) */
  initiatorType: ResourceType;
  /** Transfer size in bytes */
  transferSize: number;
  /** Duration in ms */
  duration: number;
  /** Start time in ms */
  startTime: number;
  /** Whether the resource is render-blocking */
  renderBlocking?: boolean;
  /** Cache status */
  cached: boolean;
}

export type ResourceType = "script" | "stylesheet" | "img" | "font" | "fetch" | "xmlhttprequest" | "other";

export interface ResourceAnalysis {
  /** Total resources */
  totalResources: number;
  /** Total transfer size in bytes */
  totalTransferBytes: number;
  /** Resources by type */
  byType: Record<ResourceType, TypeBreakdown>;
  /** Render-blocking resources */
  renderBlockingCount: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Slowest resources */
  slowest: ResourceEntry[];
  /** Largest resources */
  largest: ResourceEntry[];
  /** Optimization suggestions */
  suggestions: OptimizationSuggestion[];
}

export interface TypeBreakdown {
  /** Number of resources */
  count: number;
  /** Total bytes */
  totalBytes: number;
  /** Average duration */
  avgDuration: number;
}

export interface OptimizationSuggestion {
  /** Category */
  category: "size" | "blocking" | "cache" | "waterfall" | "count";
  /** Severity */
  severity: "high" | "medium" | "low";
  /** Description */
  description: string;
  /** Estimated impact */
  impact: string;
}

export interface ResourceBudget {
  /** Max total transfer size in KB */
  maxTotalKB: number;
  /** Max single resource KB */
  maxSingleResourceKB: number;
  /** Max resources count */
  maxResources: number;
  /** Max render-blocking resources */
  maxRenderBlocking: number;
  /** Target cache hit rate */
  targetCacheHitRate: number;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Performance budgets */
export const RESOURCE_BUDGETS: ResourceBudget = {
  maxTotalKB: 500,
  maxSingleResourceKB: 150,
  maxResources: 50,
  maxRenderBlocking: 2,
  targetCacheHitRate: 0.8,
};

/** Size thresholds (bytes) */
export const SIZE_THRESHOLDS = {
  /** Large resource (> 100KB) */
  large: 100 * 1024,
  /** Medium resource (> 50KB) */
  medium: 50 * 1024,
  /** Slow resource (> 1000ms) */
  slowMs: 1000,
} as const;

/** Resource types that can be render-blocking */
export const BLOCKING_TYPES: ResourceType[] = ["script", "stylesheet"];

// ── Analysis ────────────────────────────────────────────────────────────

/**
 * Analyze resource timing entries.
 */
export function analyzeResourceTiming(
  entries: ResourceEntry[],
  budget: ResourceBudget = RESOURCE_BUDGETS,
): ResourceAnalysis {
  const byType = initTypeBreakdown();
  let renderBlockingCount = 0;
  let cachedCount = 0;

  for (const entry of entries) {
    const type = byType[entry.initiatorType] ?? byType.other;
    type.count++;
    type.totalBytes += entry.transferSize;
    type.avgDuration += entry.duration;

    if (entry.renderBlocking) renderBlockingCount++;
    if (entry.cached) cachedCount++;
  }

  // Calculate averages
  for (const type of Object.values(byType)) {
    if (type.count > 0) {
      type.avgDuration = type.avgDuration / type.count;
    }
  }

  const totalTransferBytes = entries.reduce((sum, e) => sum + e.transferSize, 0);
  const cacheHitRate = entries.length > 0 ? cachedCount / entries.length : 0;

  const slowest = [...entries]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5);

  const largest = [...entries]
    .sort((a, b) => b.transferSize - a.transferSize)
    .slice(0, 5);

  const suggestions = generateSuggestions(entries, totalTransferBytes, renderBlockingCount, cacheHitRate, budget);

  return {
    totalResources: entries.length,
    totalTransferBytes,
    byType,
    renderBlockingCount,
    cacheHitRate,
    slowest,
    largest,
    suggestions,
  };
}

/**
 * Detect render-blocking resources.
 */
export function detectRenderBlocking(entries: ResourceEntry[]): ResourceEntry[] {
  return entries.filter(
    (e) => e.renderBlocking || (BLOCKING_TYPES.includes(e.initiatorType) && e.startTime < 100),
  );
}

/**
 * Calculate waterfall efficiency — how much parallelism is being used.
 * Returns 0-1 where 1 is perfectly parallelized.
 */
export function calculateWaterfallEfficiency(entries: ResourceEntry[]): number {
  if (entries.length <= 1) return 1;

  const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);
  const wallTime = Math.max(...entries.map((e) => e.startTime + e.duration)) -
    Math.min(...entries.map((e) => e.startTime));

  if (wallTime <= 0) return 1;
  return Math.min(1, wallTime / totalDuration);
}

/**
 * Classify resource by size.
 */
export function classifyResourceSize(bytes: number): "small" | "medium" | "large" {
  if (bytes >= SIZE_THRESHOLDS.large) return "large";
  if (bytes >= SIZE_THRESHOLDS.medium) return "medium";
  return "small";
}

/**
 * Format analysis as human-readable string.
 */
export function formatResourceAnalysis(analysis: ResourceAnalysis): string {
  const totalKB = (analysis.totalTransferBytes / 1024).toFixed(0);
  const lines = [
    `📦 Resource Analysis: ${analysis.totalResources} resources, ${totalKB} KB total`,
    `   Cache hit rate: ${(analysis.cacheHitRate * 100).toFixed(0)}%`,
    `   Render-blocking: ${analysis.renderBlockingCount}`,
  ];

  if (analysis.suggestions.length > 0) {
    lines.push("", "Suggestions:");
    for (const s of analysis.suggestions.slice(0, 5)) {
      const icon = s.severity === "high" ? "🔴" : s.severity === "medium" ? "🟡" : "🟢";
      lines.push(`  ${icon} [${s.category}] ${s.description} (${s.impact})`);
    }
  }

  return lines.join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────

function initTypeBreakdown(): Record<ResourceType, TypeBreakdown> {
  const types: ResourceType[] = ["script", "stylesheet", "img", "font", "fetch", "xmlhttprequest", "other"];
  const result = {} as Record<ResourceType, TypeBreakdown>;
  for (const t of types) {
    result[t] = { count: 0, totalBytes: 0, avgDuration: 0 };
  }
  return result;
}

function generateSuggestions(
  entries: ResourceEntry[],
  totalBytes: number,
  renderBlockingCount: number,
  cacheHitRate: number,
  budget: ResourceBudget,
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  const totalKB = totalBytes / 1024;

  if (totalKB > budget.maxTotalKB) {
    suggestions.push({
      category: "size",
      severity: "high",
      description: `Total transfer size ${totalKB.toFixed(0)}KB exceeds budget of ${budget.maxTotalKB}KB`,
      impact: `Reduce by ${(totalKB - budget.maxTotalKB).toFixed(0)}KB`,
    });
  }

  const oversized = entries.filter((e) => e.transferSize > budget.maxSingleResourceKB * 1024);
  if (oversized.length > 0) {
    suggestions.push({
      category: "size",
      severity: "high",
      description: `${oversized.length} resource(s) exceed ${budget.maxSingleResourceKB}KB limit`,
      impact: "Code-split or compress large bundles",
    });
  }

  if (renderBlockingCount > budget.maxRenderBlocking) {
    suggestions.push({
      category: "blocking",
      severity: "high",
      description: `${renderBlockingCount} render-blocking resources (max: ${budget.maxRenderBlocking})`,
      impact: "Add async/defer to non-critical scripts",
    });
  }

  if (cacheHitRate < budget.targetCacheHitRate) {
    suggestions.push({
      category: "cache",
      severity: "medium",
      description: `Cache hit rate ${(cacheHitRate * 100).toFixed(0)}% below target ${(budget.targetCacheHitRate * 100).toFixed(0)}%`,
      impact: "Set Cache-Control headers for static assets",
    });
  }

  if (entries.length > budget.maxResources) {
    suggestions.push({
      category: "count",
      severity: "medium",
      description: `${entries.length} resources exceed budget of ${budget.maxResources}`,
      impact: "Bundle or inline small resources",
    });
  }

  const slowResources = entries.filter((e) => e.duration > SIZE_THRESHOLDS.slowMs);
  if (slowResources.length > 0) {
    suggestions.push({
      category: "waterfall",
      severity: "medium",
      description: `${slowResources.length} slow resource(s) > ${SIZE_THRESHOLDS.slowMs}ms`,
      impact: "Preload critical resources, use CDN",
    });
  }

  return suggestions;
}
