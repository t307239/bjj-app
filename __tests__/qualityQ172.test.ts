/**
 * Tests for Q-172: bundleOptimizer (Performance 94→95)
 */
import { describe, it, expect } from "vitest";

describe("Q-172: bundleOptimizer", () => {
  it("BUNDLE_BUDGETS constants", async () => {
    const m = await import("@/lib/bundleOptimizer");
    expect(m.BUNDLE_BUDGETS.maxInitialJS).toBe(250_000);
    expect(m.BUNDLE_BUDGETS.maxChunkSize).toBe(150_000);
    expect(m.BUNDLE_BUDGETS.maxInitialChunks).toBe(15);
  });

  it("LAZY_LOAD_CANDIDATES", async () => {
    const m = await import("@/lib/bundleOptimizer");
    expect(m.LAZY_LOAD_CANDIDATES.length).toBeGreaterThan(10);
    expect(m.LAZY_LOAD_CANDIDATES).toContain("recharts");
    expect(m.LAZY_LOAD_CANDIDATES).toContain("chart.js");
  });

  it("analyzeBundleChunks: under budget", async () => {
    const m = await import("@/lib/bundleOptimizer");
    const chunks: import("@/lib/bundleOptimizer").ChunkInfo[] = [
      { name: "main", sizeBytes: 100_000, modules: ["app.tsx"], isEntry: true, isDynamic: false },
      { name: "vendor", sizeBytes: 80_000, modules: ["react"], isEntry: true, isDynamic: false },
      { name: "lazy", sizeBytes: 50_000, modules: ["chart"], isEntry: false, isDynamic: true },
    ];
    const result = m.analyzeBundleChunks(chunks);
    expect(result.totalSizeBytes).toBe(230_000);
    expect(result.chunkCount).toBe(3);
    expect(result.entryChunks).toBe(2);
    expect(result.dynamicChunks).toBe(1);
    expect(result.budgetStatus.totalJS).toBe("pass");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("analyzeBundleChunks: over budget", async () => {
    const m = await import("@/lib/bundleOptimizer");
    const chunks: import("@/lib/bundleOptimizer").ChunkInfo[] = [
      { name: "main", sizeBytes: 200_000, modules: ["app.tsx", "recharts"], isEntry: true, isDynamic: false },
      { name: "vendor", sizeBytes: 200_000, modules: ["react"], isEntry: true, isDynamic: false },
    ];
    const result = m.analyzeBundleChunks(chunks);
    expect(result.budgetStatus.totalJS).toBe("fail");
    expect(result.budgetStatus.largestChunk).toBe("fail");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("generateSplittingRecommendations: detects lazy-load candidates in entry", async () => {
    const m = await import("@/lib/bundleOptimizer");
    const chunks: import("@/lib/bundleOptimizer").ChunkInfo[] = [
      { name: "main", sizeBytes: 200_000, modules: ["app.tsx", "node_modules/recharts/index.js"], isEntry: true, isDynamic: false },
    ];
    const recs = m.generateSplittingRecommendations(chunks);
    expect(recs.some((r) => r.type === "dynamic_import" && r.target === "recharts")).toBe(true);
    expect(recs.some((r) => r.type === "route_split")).toBe(true);
  });

  it("detectTreeShakeOpportunities", async () => {
    const m = await import("@/lib/bundleOptimizer");
    const deps: import("@/lib/bundleOptimizer").DependencyInfo[] = [
      { name: "lodash", sizeBytes: 70_000, usedBy: ["app.tsx"], isTreeShakeable: false },
      { name: "unused-lib", sizeBytes: 30_000, usedBy: [], isTreeShakeable: true },
      { name: "small-lib", sizeBytes: 5_000, usedBy: ["utils.ts"], isTreeShakeable: true },
    ];
    const recs = m.detectTreeShakeOpportunities(deps);
    expect(recs.some((r) => r.type === "tree_shake" && r.target === "lodash")).toBe(true);
    expect(recs.some((r) => r.type === "remove_unused" && r.target === "unused-lib")).toBe(true);
    // small-lib is used and tree-shakeable, no recommendation
    expect(recs.some((r) => r.target === "small-lib")).toBe(false);
  });

  it("classifyRoutes", async () => {
    const m = await import("@/lib/bundleOptimizer");
    const routes = [
      { path: "/", sizeBytes: 50_000 },
      { path: "/dashboard", sizeBytes: 80_000 },
      { path: "/records", sizeBytes: 60_000 },
      { path: "/admin/users", sizeBytes: 40_000 },
      { path: "/legal/privacy", sizeBytes: 20_000 },
    ];
    const classified = m.classifyRoutes(routes);
    expect(classified[0].category).toBe("critical");
    expect(classified[0].shouldPrefetch).toBe(true);
    expect(classified[1].category).toBe("critical");
    expect(classified[2].category).toBe("important");
    expect(classified[3].category).toBe("admin");
    expect(classified[3].shouldPrefetch).toBe(false);
    expect(classified[4].category).toBe("secondary");
  });

  it("estimateTotalSavings", async () => {
    const m = await import("@/lib/bundleOptimizer");
    const recs: import("@/lib/bundleOptimizer").SplittingRecommendation[] = [
      { type: "dynamic_import", target: "recharts", reason: "test", estimatedSavingsBytes: 50_000, priority: "high" },
      { type: "tree_shake", target: "lodash", reason: "test", estimatedSavingsBytes: 35_000, priority: "medium" },
      { type: "remove_unused", target: "unused", reason: "test", estimatedSavingsBytes: 10_000, priority: "low" },
    ];
    const savings = m.estimateTotalSavings(recs);
    expect(savings.totalSavingsBytes).toBe(95_000);
    expect(savings.byPriority.high).toBe(50_000);
    expect(savings.topOpportunities[0].target).toBe("recharts");
  });

  it("formatBundleAnalysis", async () => {
    const m = await import("@/lib/bundleOptimizer");
    const chunks: import("@/lib/bundleOptimizer").ChunkInfo[] = [
      { name: "main", sizeBytes: 100_000, modules: ["app.tsx"], isEntry: true, isDynamic: false },
    ];
    const analysis = m.analyzeBundleChunks(chunks);
    const formatted = m.formatBundleAnalysis(analysis);
    expect(formatted).toContain("Bundle Analysis");
    expect(formatted).toContain("Score:");
    expect(formatted).toContain("Budget Status:");
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("analyzeBundleChunks");
    expect(idx).toContain("BUNDLE_BUDGETS");
    expect(idx).toContain("classifyRoutes");
  });
});
