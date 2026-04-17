/**
 * Tests for Q-168: privacyImpactAssessment (Legal 93→94)
 */
import { describe, it, expect } from "vitest";

describe("Q-168: privacyImpactAssessment", () => {
  it("DATA_SENSITIVITY and PROCESSING_RISK constants", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    // Sensitivity ordering
    expect(m.DATA_SENSITIVITY.children).toBe(5);
    expect(m.DATA_SENSITIVITY.health).toBe(4);
    expect(m.DATA_SENSITIVITY.technical).toBe(1);

    // Processing risk ordering
    expect(m.PROCESSING_RISK.automated_decision).toBe(5);
    expect(m.PROCESSING_RISK.storage).toBe(1);
  });

  it("STANDARD_MITIGATIONS", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    expect(Object.keys(m.STANDARD_MITIGATIONS).length).toBeGreaterThanOrEqual(8);
    expect(m.STANDARD_MITIGATIONS.encryption_at_rest.residualRisk).toBe("low");
    expect(m.STANDARD_MITIGATIONS.breach_response.residualRisk).toBe("medium");
  });

  it("scoreRisk", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    // Low: 1×1=1
    expect(m.scoreRisk(1, 1)).toEqual({ score: 1, level: "low" });

    // Medium: 3×2=6
    expect(m.scoreRisk(3, 2)).toEqual({ score: 6, level: "medium" });

    // High: 4×3=12
    expect(m.scoreRisk(4, 3)).toEqual({ score: 12, level: "high" });

    // Critical: 5×4=20
    expect(m.scoreRisk(5, 4)).toEqual({ score: 20, level: "critical" });

    // Clamped at 5
    expect(m.scoreRisk(10, 10)).toEqual({ score: 25, level: "critical" });
  });

  it("checkDPIARequired: health data triggers DPIA", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const result = m.checkDPIARequired(["health"], ["collection", "storage"]);
    expect(result.required).toBe(true);
    expect(result.reasons).toContain("health data processing");
  });

  it("checkDPIARequired: children data triggers DPIA", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const result = m.checkDPIARequired(["children", "personal"], ["collection"]);
    expect(result.required).toBe(true);
    expect(result.reasons).toContain("children's data processing");
  });

  it("checkDPIARequired: profiling triggers DPIA", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const result = m.checkDPIARequired(["personal"], ["profiling"]);
    expect(result.required).toBe(true);
    expect(result.reasons).toContain("systematic profiling");
  });

  it("checkDPIARequired: no triggers → not required", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const result = m.checkDPIARequired(["technical"], ["storage"]);
    expect(result.required).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("identifyRiskFactors", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    // Health + profiling → multiple factors
    const factors = m.identifyRiskFactors(["health", "personal"], ["profiling", "storage"]);
    expect(factors.length).toBeGreaterThan(0);
    expect(factors.every((f) => f.id.startsWith("rf_"))).toBe(true);
    expect(factors.every((f) => f.score > 0)).toBe(true);

    // Health factor should be present
    expect(factors.some((f) => f.description.includes("health"))).toBe(true);

    // Profiling factor should be present
    expect(factors.some((f) => f.description.includes("profiling"))).toBe(true);
  });

  it("identifyRiskFactors: children data subject vulnerability", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const factors = m.identifyRiskFactors(["children"], ["collection"]);
    expect(factors.some((f) => f.category === "data_subject")).toBe(true);
  });

  it("identifyRiskFactors: third-party sharing", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const factors = m.identifyRiskFactors(["personal"], ["sharing_third_party"]);
    expect(factors.some((f) => f.category === "third_party")).toBe(true);
  });

  it("suggestMitigations: always includes basics", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const factors = m.identifyRiskFactors(["technical"], ["storage"]);
    const mitigations = m.suggestMitigations(factors, ["technical"]);

    // Always has encryption + access control
    expect(mitigations.some((mit) => mit.id === "mit_encrypt_rest")).toBe(true);
    expect(mitigations.some((mit) => mit.id === "mit_encrypt_transit")).toBe(true);
    expect(mitigations.some((mit) => mit.id === "mit_access_ctrl")).toBe(true);
  });

  it("suggestMitigations: health data adds consent + minimization", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const factors = m.identifyRiskFactors(["health"], ["collection"]);
    const mitigations = m.suggestMitigations(factors, ["health"]);

    expect(mitigations.some((mit) => mit.id === "mit_consent")).toBe(true);
    expect(mitigations.some((mit) => mit.id === "mit_minimize")).toBe(true);
  });

  it("createAssessment: BJJ App training feature", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const pia = m.createAssessment({
      name: "Training Log Feature",
      dataCategories: ["personal", "health", "behavioral"],
      processingActivities: ["collection", "storage", "analysis"],
    });

    expect(pia.name).toBe("Training Log Feature");
    expect(pia.dpiaRequired).toBe(true); // health data
    expect(pia.riskFactors.length).toBeGreaterThan(0);
    expect(pia.mitigations.length).toBeGreaterThan(0);
    expect(pia.recommendations.length).toBeGreaterThan(0);
    expect(["low", "medium", "high", "critical"]).toContain(pia.overallRisk);
    expect(pia.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("createAssessment: low-risk technical only", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const pia = m.createAssessment({
      name: "Analytics Dashboard",
      dataCategories: ["technical"],
      processingActivities: ["storage"],
    });

    expect(pia.dpiaRequired).toBe(false);
    expect(pia.overallRisk).toBe("low");
  });

  it("createAssessment: high-risk with children + profiling", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const pia = m.createAssessment({
      name: "Youth Program Feature",
      dataCategories: ["children", "health", "personal"],
      processingActivities: ["collection", "profiling", "cross_border_transfer"],
    });

    expect(pia.dpiaRequired).toBe(true);
    expect(["high", "critical"]).toContain(pia.overallRisk);
    expect(pia.recommendations.some((r) => r.includes("age verification"))).toBe(true);
    expect(pia.recommendations.some((r) => r.includes("opt-out"))).toBe(true);
    expect(pia.recommendations.some((r) => r.includes("Standard Contractual"))).toBe(true);
  });

  it("generatePIAReport", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    const pia = m.createAssessment({
      name: "Test Feature",
      dataCategories: ["personal", "health"],
      processingActivities: ["collection", "storage"],
    });

    const report = m.generatePIAReport(pia);
    expect(report).toContain("Privacy Impact Assessment");
    expect(report).toContain("Test Feature");
    expect(report).toContain("Risk Factors");
    expect(report).toContain("Mitigations");
    expect(report).toContain("Recommendations");
  });

  it("quickRiskCheck", async () => {
    const m = await import("@/lib/privacyImpactAssessment");

    // Low risk
    const low = m.quickRiskCheck(["technical"], ["storage"]);
    expect(low.overallRisk).toBe("low");
    expect(low.dpiaRequired).toBe(false);

    // Higher risk
    const high = m.quickRiskCheck(["health", "children"], ["profiling", "sharing_third_party"]);
    expect(high.dpiaRequired).toBe(true);
    expect(high.topRisks.length).toBeGreaterThan(0);
    expect(high.topRisks.length).toBeLessThanOrEqual(3);
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("createAssessment");
    expect(idx).toContain("scoreRisk");
    expect(idx).toContain("DATA_SENSITIVITY");
    expect(idx).toContain("generatePIAReport");
  });
});
