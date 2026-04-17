/**
 * Tests for Q-177: disasterRecovery (Infra 94→95)
 */
import { describe, it, expect } from "vitest";

describe("Q-177: disasterRecovery", () => {
  it("RTO_CLASSIFICATIONS", async () => {
    const m = await import("@/lib/disasterRecovery");
    expect(m.RTO_CLASSIFICATIONS.tier1.maxMinutes).toBe(15);
    expect(m.RTO_CLASSIFICATIONS.tier2.maxMinutes).toBe(60);
    expect(m.RTO_CLASSIFICATIONS.tier4.maxMinutes).toBe(1440);
  });

  it("RPO_CLASSIFICATIONS", async () => {
    const m = await import("@/lib/disasterRecovery");
    expect(m.RPO_CLASSIFICATIONS.zero.maxMinutes).toBe(0);
    expect(m.RPO_CLASSIFICATIONS.near_zero.maxMinutes).toBe(5);
    expect(m.RPO_CLASSIFICATIONS.daily.maxMinutes).toBe(1440);
  });

  it("DR_SCENARIOS", async () => {
    const m = await import("@/lib/disasterRecovery");
    expect(Object.keys(m.DR_SCENARIOS).length).toBe(5);
    expect(m.DR_SCENARIOS.database_failure.steps.length).toBeGreaterThan(3);
    expect(m.DR_SCENARIOS.data_breach.rtoTier).toBe("tier1");
  });

  it("isRTOCompliant", async () => {
    const m = await import("@/lib/disasterRecovery");
    const comp: import("@/lib/disasterRecovery").ServiceComponent = {
      name: "API", rtoTier: "tier1", rpoClass: "near_zero",
      dependencies: [], backupMethod: "PITR",
    };
    expect(m.isRTOCompliant(comp, 10)).toBe(true);
    expect(m.isRTOCompliant(comp, 20)).toBe(false);
  });

  it("isRPOCompliant", async () => {
    const m = await import("@/lib/disasterRecovery");
    const comp: import("@/lib/disasterRecovery").ServiceComponent = {
      name: "DB", rtoTier: "tier2", rpoClass: "near_zero",
      dependencies: [], backupMethod: "PITR",
    };
    expect(m.isRPOCompliant(comp, 3)).toBe(true);
    expect(m.isRPOCompliant(comp, 10)).toBe(false);
  });

  it("validateBackup: valid", async () => {
    const m = await import("@/lib/disasterRecovery");
    const comp: import("@/lib/disasterRecovery").ServiceComponent = {
      name: "DB", rtoTier: "tier2", rpoClass: "hourly",
      dependencies: [], backupMethod: "snapshot",
    };
    const result = m.validateBackup(comp, "2026-04-18T10:00:00Z", "2026-04-18T10:30:00Z");
    expect(result.status).toBe("valid");
    expect(result.rpoCompliant).toBe(true);
    expect(result.ageMinutes).toBe(30);
  });

  it("validateBackup: expired", async () => {
    const m = await import("@/lib/disasterRecovery");
    const comp: import("@/lib/disasterRecovery").ServiceComponent = {
      name: "DB", rtoTier: "tier2", rpoClass: "hourly",
      dependencies: [], backupMethod: "snapshot",
    };
    const result = m.validateBackup(comp, "2026-04-18T08:00:00Z", "2026-04-18T10:00:00Z");
    expect(result.status).toBe("expired"); // 120 min, 60-120 range
    expect(result.rpoCompliant).toBe(false);
  });

  it("identifyDRGaps", async () => {
    const m = await import("@/lib/disasterRecovery");
    const components: import("@/lib/disasterRecovery").ServiceComponent[] = [
      { name: "API", rtoTier: "tier1", rpoClass: "zero", dependencies: [], backupMethod: "none" },
    ];
    const gaps = m.identifyDRGaps(components, [], []);
    expect(gaps.some((g) => g.includes("backup never verified"))).toBe(true);
    expect(gaps.some((g) => g.includes("No DR plan"))).toBe(true);
  });

  it("generateDRReadinessReport: not ready", async () => {
    const m = await import("@/lib/disasterRecovery");
    const report = m.generateDRReadinessReport([], [], []);
    // No components, no plans — should flag missing scenario plans
    expect(report.gaps.length).toBeGreaterThan(0);
    expect(report.overallReadiness).toBe("not_ready");
  });

  it("generateDRReadinessReport: ready", async () => {
    const m = await import("@/lib/disasterRecovery");
    const components: import("@/lib/disasterRecovery").ServiceComponent[] = [
      { name: "API", rtoTier: "tier1", rpoClass: "zero", dependencies: [], backupMethod: "replication", lastBackupVerified: "2026-04-18" },
    ];
    const plans: import("@/lib/disasterRecovery").DRPlanEntry[] = Object.keys(m.DR_SCENARIOS).map((s) => ({
      scenario: s as import("@/lib/disasterRecovery").DRScenario,
      components: ["API"],
      estimatedRecoveryMinutes: 10,
      lastTested: "2026-04-18",
      owner: "dev",
    }));
    const report = m.generateDRReadinessReport(components, plans, []);
    expect(report.overallReadiness).toBe("ready");
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  it("getDRSteps", async () => {
    const m = await import("@/lib/disasterRecovery");
    const steps = m.getDRSteps("deployment_failure");
    expect(steps.length).toBeGreaterThan(3);
    expect(steps[0]).toContain("Detect");
  });

  it("formatDRReport", async () => {
    const m = await import("@/lib/disasterRecovery");
    const report = m.generateDRReadinessReport([], [], []);
    const formatted = m.formatDRReport(report);
    expect(formatted).toContain("Disaster Recovery");
    expect(formatted).toContain("Score:");
    expect(formatted).toContain("Gaps:");
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("isRTOCompliant");
    expect(idx).toContain("DR_SCENARIOS");
    expect(idx).toContain("generateDRReadinessReport");
  });
});
