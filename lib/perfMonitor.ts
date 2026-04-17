/**
 * lib/perfMonitor.ts — Q-129: Performance monitoring utilities
 *
 * Provides server-side performance tracking helpers:
 * - Route render timing (Server Component / API)
 * - Memory usage snapshots
 * - Cache hit rate tracking
 *
 * Usage:
 *   import { measureAsync, getMemorySnapshot, PERF_BUDGETS } from "@/lib/perfMonitor";
 */

import { logger } from "./logger";

/**
 * Performance budgets for key operations (milliseconds).
 * Used by monitoring to flag slow operations.
 */
export const PERF_BUDGETS = {
  /** Page render should complete within 2s */
  PAGE_RENDER_MS: 2000,
  /** API response should complete within 1s */
  API_RESPONSE_MS: 1000,
  /** DB query should complete within 500ms */
  DB_QUERY_MS: 500,
  /** Image optimization should complete within 3s */
  IMAGE_OPT_MS: 3000,
} as const;

export type PerfCategory = keyof typeof PERF_BUDGETS;

export interface PerfMeasurement {
  name: string;
  duration_ms: number;
  budget_ms: number;
  within_budget: boolean;
  timestamp: string;
}

/**
 * Measure an async operation and log if it exceeds budget.
 * Returns the operation result and measurement data.
 *
 * @example
 * const { result, measurement } = await measureAsync("db_query", "DB_QUERY_MS", async () => {
 *   return await supabase.from("profiles").select("*");
 * });
 */
export async function measureAsync<T>(
  name: string,
  category: PerfCategory,
  fn: () => Promise<T>
): Promise<{ result: T; measurement: PerfMeasurement }> {
  const start = performance.now();
  const result = await fn();
  const duration = Math.round(performance.now() - start);
  const budget = PERF_BUDGETS[category];

  const measurement: PerfMeasurement = {
    name,
    duration_ms: duration,
    budget_ms: budget,
    within_budget: duration <= budget,
    timestamp: new Date().toISOString(),
  };

  if (!measurement.within_budget) {
    logger.warn(`perf_budget_exceeded: ${name}`, {
      event: "perf_budget_exceeded",
      name,
      duration_ms: duration,
      budget_ms: budget,
      overage_ms: duration - budget,
    });
  }

  return { result, measurement };
}

/**
 * Get a snapshot of current process memory usage.
 * Useful for monitoring memory leaks in serverless functions.
 */
export function getMemorySnapshot(): {
  rss_mb: number;
  heap_used_mb: number;
  heap_total_mb: number;
  external_mb: number;
} {
  const mem = process.memoryUsage();
  return {
    rss_mb: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
    heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
    heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024 * 10) / 10,
    external_mb: Math.round(mem.external / 1024 / 1024 * 10) / 10,
  };
}

/**
 * Simple in-memory cache hit rate tracker.
 * Reports hit/miss/total for a named cache.
 */
export class CacheHitTracker {
  private hits = 0;
  private misses = 0;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  hit(): void {
    this.hits += 1;
  }

  miss(): void {
    this.misses += 1;
  }

  get total(): number {
    return this.hits + this.misses;
  }

  get hitRate(): number {
    if (this.total === 0) return 0;
    return Math.round((this.hits / this.total) * 1000) / 10;
  }

  snapshot(): { name: string; hits: number; misses: number; total: number; hit_rate_percent: number } {
    return {
      name: this.name,
      hits: this.hits,
      misses: this.misses,
      total: this.total,
      hit_rate_percent: this.hitRate,
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
  }
}
