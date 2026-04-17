/**
 * qualityQ130_133 — tests for Q-130 through Q-133 quality improvements
 *
 * Tests:
 * - Q-130: Feature flags / A/B testing (featureFlags.ts)
 * - Q-131: i18n coverage analysis (i18nCoverage.ts)
 * - Q-132: Churn prediction (churnPredictor.ts)
 * - Q-133: Type safety guard script (check-types-strict.mjs)
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.resolve(ROOT, "lib");

// ── Q-130: Feature Flags ─────────────────────────────────────────────────
describe("Q-130: Conversion — featureFlags", () => {
  let getVariant: typeof import("../lib/featureFlags").getVariant;
  let isFeatureEnabled: typeof import("../lib/featureFlags").isFeatureEnabled;
  let getAllAssignments: typeof import("../lib/featureFlags").getAllAssignments;
  let EXPERIMENTS: typeof import("../lib/featureFlags").EXPERIMENTS;

  beforeAll(async () => {
    const mod = await import("../lib/featureFlags");
    getVariant = mod.getVariant;
    isFeatureEnabled = mod.isFeatureEnabled;
    getAllAssignments = mod.getAllAssignments;
    EXPERIMENTS = mod.EXPERIMENTS;
  });

  it("EXPERIMENTS has progate_copy enabled", () => {
    expect(EXPERIMENTS.progate_copy.enabled).toBe(true);
    expect(EXPERIMENTS.progate_copy.variants).toContain("a");
    expect(EXPERIMENTS.progate_copy.variants).toContain("b");
  });

  it("getVariant returns consistent result for same user", () => {
    const v1 = getVariant("progate_copy", "user-123");
    const v2 = getVariant("progate_copy", "user-123");
    expect(v1).toBe(v2);
  });

  it("getVariant returns 'a' for disabled experiments", () => {
    expect(getVariant("pricing_layout", "user-123")).toBe("a");
    expect(getVariant("onboarding_flow", "user-456")).toBe("a");
  });

  it("getVariant returns 'a' or 'b' only", () => {
    const variants = new Set<string>();
    for (let i = 0; i < 50; i++) {
      variants.add(getVariant("progate_copy", `user-${i}`));
    }
    expect(variants.size).toBeLessThanOrEqual(2);
    for (const v of variants) {
      expect(["a", "b"]).toContain(v);
    }
  });

  it("isFeatureEnabled returns boolean", () => {
    const result = isFeatureEnabled("progate_copy", "user-123");
    expect(typeof result).toBe("boolean");
  });

  it("getAllAssignments returns all experiments", () => {
    const assignments = getAllAssignments("user-123");
    expect(assignments).toHaveProperty("progate_copy");
    expect(assignments).toHaveProperty("pricing_layout");
    expect(assignments).toHaveProperty("onboarding_flow");
  });

  it("barrel export includes featureFlags", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("getVariant");
    expect(barrel).toContain("isFeatureEnabled");
    expect(barrel).toContain("EXPERIMENTS");
  });
});

// ── Q-131: i18n Coverage ─────────────────────────────────────────────────
describe("Q-131: i18n — i18nCoverage", () => {
  let flattenKeys: typeof import("../lib/i18nCoverage").flattenKeys;
  let findMissingKeys: typeof import("../lib/i18nCoverage").findMissingKeys;
  let findExtraKeys: typeof import("../lib/i18nCoverage").findExtraKeys;
  let analyzeCoverage: typeof import("../lib/i18nCoverage").analyzeCoverage;
  let generateCoverageSummary: typeof import("../lib/i18nCoverage").generateCoverageSummary;

  beforeAll(async () => {
    const mod = await import("../lib/i18nCoverage");
    flattenKeys = mod.flattenKeys;
    findMissingKeys = mod.findMissingKeys;
    findExtraKeys = mod.findExtraKeys;
    analyzeCoverage = mod.analyzeCoverage;
    generateCoverageSummary = mod.generateCoverageSummary;
  });

  it("flattenKeys flattens nested object", () => {
    const keys = flattenKeys({ a: { b: "c", d: { e: "f" } }, g: "h" });
    expect(keys).toContain("a.b");
    expect(keys).toContain("a.d.e");
    expect(keys).toContain("g");
    expect(keys.length).toBe(3);
  });

  it("flattenKeys handles empty object", () => {
    expect(flattenKeys({})).toEqual([]);
  });

  it("findMissingKeys detects missing keys", () => {
    const missing = findMissingKeys(["a", "b", "c"], ["a", "c"]);
    expect(missing).toEqual(["b"]);
  });

  it("findExtraKeys detects extra keys", () => {
    const extra = findExtraKeys(["a", "b"], ["a", "b", "c"]);
    expect(extra).toEqual(["c"]);
  });

  it("analyzeCoverage calculates correct percentage", () => {
    const result = analyzeCoverage("pt", ["a", "b", "c", "d"], ["a", "b"]);
    expect(result.coveragePercent).toBe(50);
    expect(result.missingKeys).toEqual(["c", "d"]);
    expect(result.coveredKeys).toBe(2);
  });

  it("analyzeCoverage handles 100% coverage", () => {
    const result = analyzeCoverage("ja", ["a", "b"], ["a", "b"]);
    expect(result.coveragePercent).toBe(100);
    expect(result.missingKeys.length).toBe(0);
  });

  it("generateCoverageSummary works with real-like data", () => {
    const summary = generateCoverageSummary({
      en: { nav: { home: "Home", records: "Records" }, common: { save: "Save" } },
      ja: { nav: { home: "ホーム", records: "記録" }, common: { save: "保存" } },
      pt: { nav: { home: "Início" } },
    });
    expect(summary.referenceKeyCount).toBe(3);
    expect(summary.locales.length).toBe(2);
    // ja should be 100%
    const ja = summary.locales.find((l) => l.locale === "ja");
    expect(ja?.coveragePercent).toBe(100);
    // pt should be ~33%
    const pt = summary.locales.find((l) => l.locale === "pt");
    expect(pt?.coveragePercent).toBeCloseTo(33.3, 0);
  });

  it("barrel export includes i18nCoverage", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("flattenKeys");
    expect(barrel).toContain("analyzeCoverage");
    expect(barrel).toContain("generateCoverageSummary");
  });
});

// ── Q-132: Churn Prediction ──────────────────────────────────────────────
describe("Q-132: Retention — churnPredictor", () => {
  let predictChurnRisk: typeof import("../lib/churnPredictor").predictChurnRisk;
  let suggestWinBackAction: typeof import("../lib/churnPredictor").suggestWinBackAction;
  let batchChurnPredictions: typeof import("../lib/churnPredictor").batchChurnPredictions;

  const baseEngagement = {
    score: 50,
    tier: "casual" as const,
    dimensions: {
      frequency: 50,
      consistency: 50,
      recency: 50,
      breadth: 50,
      investment: 50,
    },
    suggestedAction: "test",
  };

  beforeAll(async () => {
    const mod = await import("../lib/churnPredictor");
    predictChurnRisk = mod.predictChurnRisk;
    suggestWinBackAction = mod.suggestWinBackAction;
    batchChurnPredictions = mod.batchChurnPredictions;
  });

  it("active user = low risk", () => {
    const result = predictChurnRisk(
      { ...baseEngagement, tier: "champion", score: 85 },
      0
    );
    expect(result.risk).toBe("low");
    expect(result.riskScore).toBeLessThan(20);
  });

  it("14+ days inactive + churning tier = critical", () => {
    const result = predictChurnRisk(
      {
        ...baseEngagement,
        tier: "churning",
        score: 10,
        dimensions: { frequency: 0, consistency: 0, recency: 0, breadth: 0, investment: 0 },
      },
      14
    );
    expect(result.risk).toBe("critical");
    expect(result.riskScore).toBeGreaterThanOrEqual(70);
  });

  it("7 days inactive = medium or high risk", () => {
    const result = predictChurnRisk(baseEngagement, 7);
    expect(["medium", "high"]).toContain(result.risk);
  });

  it("prediction includes factors", () => {
    const result = predictChurnRisk(
      { ...baseEngagement, tier: "at_risk", dimensions: { ...baseEngagement.dimensions, investment: 10 } },
      10
    );
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it("critical risk has immediate priority", () => {
    const result = predictChurnRisk(
      {
        ...baseEngagement,
        tier: "churning",
        score: 5,
        dimensions: { frequency: 0, consistency: 0, recency: 0, breadth: 0, investment: 0 },
      },
      30
    );
    expect(result.actionPriority).toBe("immediate");
    expect(result.daysUntilLikelyChurn).toBe(3);
  });

  it("suggestWinBackAction returns push for critical", () => {
    const prediction = predictChurnRisk(
      {
        ...baseEngagement,
        tier: "churning",
        score: 5,
        dimensions: { frequency: 0, consistency: 0, recency: 0, breadth: 0, investment: 0 },
      },
      30
    );
    const action = suggestWinBackAction(prediction);
    expect(action.type).toBe("push");
    expect(action.urgency).toBe("high");
  });

  it("suggestWinBackAction returns none for low risk", () => {
    const prediction = predictChurnRisk(
      { ...baseEngagement, tier: "champion", score: 90 },
      0
    );
    const action = suggestWinBackAction(prediction);
    expect(action.type).toBe("none");
  });

  it("batchChurnPredictions sorts by risk descending", () => {
    const results = batchChurnPredictions([
      { id: "active", engagement: { ...baseEngagement, tier: "champion", score: 90 }, daysSinceLastSession: 0 },
      { id: "churning", engagement: { ...baseEngagement, tier: "churning", score: 5, dimensions: { frequency: 0, consistency: 0, recency: 0, breadth: 0, investment: 0 } }, daysSinceLastSession: 30 },
    ]);
    expect(results[0].id).toBe("churning");
    expect(results[1].id).toBe("active");
  });

  it("barrel export includes churnPredictor", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("predictChurnRisk");
    expect(barrel).toContain("suggestWinBackAction");
    expect(barrel).toContain("ChurnRisk");
  });
});

// ── Q-133: Type Safety Guard ─────────────────────────────────────────────
describe("Q-133: DX — check-types-strict", () => {
  it("check-types-strict.mjs exists", () => {
    expect(fs.existsSync(path.resolve(ROOT, "scripts/check-types-strict.mjs"))).toBe(true);
  });

  it("script detects AS_ANY pattern", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "scripts/check-types-strict.mjs"), "utf-8");
    expect(source).toContain("AS_ANY");
    expect(source).toContain("as\\s+any");
  });

  it("script detects TS_IGNORE pattern", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "scripts/check-types-strict.mjs"), "utf-8");
    expect(source).toContain("TS_IGNORE");
    expect(source).toContain("@ts-ignore");
  });

  it("script has baseline thresholds", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "scripts/check-types-strict.mjs"), "utf-8");
    expect(source).toContain("BASELINE");
    expect(source).toContain("AS_ANY");
    expect(source).toContain("BARE_CATCH");
  });

  it("script supports --json and --fix-hint flags", () => {
    const source = fs.readFileSync(path.resolve(ROOT, "scripts/check-types-strict.mjs"), "utf-8");
    expect(source).toContain("--json");
    expect(source).toContain("--fix-hint");
  });

  it("package.json has check:types-strict script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts["check:types-strict"]).toContain("check-types-strict.mjs");
  });
});
