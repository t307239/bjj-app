/**
 * Tests for Q-175: sliDashboard (Obs 94→95)
 */
import { describe, it, expect } from "vitest";

describe("Q-175: sliDashboard", () => {
  it("SLO_DEFINITIONS", async () => {
    const m = await import("@/lib/sliDashboard");
    expect(m.SLO_DEFINITIONS.availability.target).toBe(99.9);
    expect(m.SLO_DEFINITIONS.latency_p95.target).toBe(2000);
    expect(m.SLO_DEFINITIONS.error_rate.target).toBe(0.1);
  });

  it("calculateErrorBudget: healthy availability", async () => {
    const m = await import("@/lib/sliDashboard");
    const result = m.calculateErrorBudget("availability", 99.99, 30, 15);
    expect(result.status).toBe("healthy");
    expect(result.budgetTotal).toBeCloseTo(0.1, 5); // 100 - 99.9
    expect(result.budgetConsumed).toBeCloseTo(0.01, 5); // 100 - 99.99
    expect(result.consumedPercent).toBe(10);
  });

  it("calculateErrorBudget: exhausted error_rate", async () => {
    const m = await import("@/lib/sliDashboard");
    const result = m.calculateErrorBudget("error_rate", 0.2, 30, 30);
    expect(result.status).toBe("exhausted");
    expect(result.consumedPercent).toBe(200);
  });

  it("calculateErrorBudget: throughput below target", async () => {
    const m = await import("@/lib/sliDashboard");
    const result = m.calculateErrorBudget("throughput", 80, 30, 10);
    expect(result.budgetConsumed).toBe(20); // 100 - 80
    expect(result.burnRate).toBeCloseTo(2, 1); // 20 / 10 days
  });

  it("calculatePercentile", async () => {
    const m = await import("@/lib/sliDashboard");
    expect(m.calculatePercentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 95)).toBe(100);
    expect(m.calculatePercentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 50)).toBe(50);
    expect(m.calculatePercentile([], 95)).toBe(0);
  });

  it("aggregateSLIMetrics", async () => {
    const m = await import("@/lib/sliDashboard");
    const dataPoints: import("@/lib/sliDashboard").SLIDataPoint[] = [
      { timestamp: "2026-04-01", value: 99.9, sloName: "availability" },
      { timestamp: "2026-04-02", value: 99.8, sloName: "availability" },
      { timestamp: "2026-04-01", value: 1500, sloName: "latency_p95" },
    ];
    const metrics = m.aggregateSLIMetrics(dataPoints);
    expect(metrics.availability.avg).toBeCloseTo(99.85, 1);
    expect(metrics.availability.count).toBe(2);
    expect(metrics.latency_p95.count).toBe(1);
  });

  it("generateComplianceReport: all healthy", async () => {
    const m = await import("@/lib/sliDashboard");
    const budgets = [
      m.calculateErrorBudget("availability", 99.95, 30, 30),
      m.calculateErrorBudget("error_rate", 0.05, 30, 30),
    ];
    const report = m.generateComplianceReport(budgets, "2026-04-01", "2026-04-30");
    expect(report.overallCompliance).toBe(true);
    expect(report.summary).toContain("healthy");
  });

  it("generateComplianceReport: exhausted", async () => {
    const m = await import("@/lib/sliDashboard");
    const budgets = [
      m.calculateErrorBudget("availability", 99.0, 30, 30), // Very bad
    ];
    const report = m.generateComplianceReport(budgets, "2026-04-01", "2026-04-30");
    expect(report.overallCompliance).toBe(false);
    expect(report.summary).toContain("exhausted");
  });

  it("detectSLOViolations", async () => {
    const m = await import("@/lib/sliDashboard");
    const dataPoints: import("@/lib/sliDashboard").SLIDataPoint[] = [
      { timestamp: "2026-04-01T10:00", value: 99.95, sloName: "availability" }, // OK
      { timestamp: "2026-04-01T11:00", value: 99.5, sloName: "availability" },  // Violation (< 99.9)
      { timestamp: "2026-04-01T10:00", value: 3000, sloName: "latency_p95" },   // Violation (> 2000)
      { timestamp: "2026-04-01T10:00", value: 1500, sloName: "latency_p95" },   // OK
    ];
    const violations = m.detectSLOViolations(dataPoints);
    expect(violations.length).toBe(2);
    expect(violations[0].sloName).toBe("availability");
    expect(violations[1].sloName).toBe("latency_p95");
  });

  it("formatComplianceReport", async () => {
    const m = await import("@/lib/sliDashboard");
    const budgets = [m.calculateErrorBudget("availability", 99.95, 30, 30)];
    const report = m.generateComplianceReport(budgets, "2026-04-01", "2026-04-30");
    const formatted = m.formatComplianceReport(report);
    expect(formatted).toContain("SLO Compliance Report");
    expect(formatted).toContain("availability");
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("calculateErrorBudget");
    expect(idx).toContain("SLO_DEFINITIONS");
    expect(idx).toContain("detectSLOViolations");
  });
});
