/**
 * Tests for Q-170: runbookGenerator (Ops 93→94)
 */
import { describe, it, expect } from "vitest";

describe("Q-170: runbookGenerator", () => {
  it("RUNBOOK_TEMPLATES", async () => {
    const m = await import("@/lib/runbookGenerator");

    const keys = m.getTemplateKeys();
    expect(keys.length).toBe(6);
    expect(keys).toContain("database_migration");
    expect(keys).toContain("deploy_rollback");
    expect(keys).toContain("incident_response");
    expect(keys).toContain("backup_restore");
    expect(keys).toContain("security_patch");
    expect(keys).toContain("performance_investigation");
  });

  it("template structure: database_migration", async () => {
    const m = await import("@/lib/runbookGenerator");
    const t = m.RUNBOOK_TEMPLATES.database_migration;

    expect(t.category).toBe("database");
    expect(t.severity).toBe("major");
    expect(t.prerequisites.length).toBeGreaterThan(0);
    expect(t.steps.length).toBe(5);
    expect(t.rollbackProcedure.length).toBeGreaterThan(0);
    expect(t.escalationPaths.length).toBeGreaterThan(0);
  });

  it("createRunbook", async () => {
    const m = await import("@/lib/runbookGenerator");

    const rb = m.createRunbook(m.RUNBOOK_TEMPLATES.deploy_rollback, "rb_test");
    expect(rb.id).toBe("rb_test");
    expect(rb.title).toBe("Deployment Rollback");
    expect(rb.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rb.steps.length).toBe(4);
  });

  it("createRunbook: auto-generated ID", async () => {
    const m = await import("@/lib/runbookGenerator");
    const rb = m.createRunbook(m.RUNBOOK_TEMPLATES.security_patch);
    expect(rb.id).toMatch(/^rb_/);
  });

  it("startExecution", async () => {
    const m = await import("@/lib/runbookGenerator");
    const rb = m.createRunbook(m.RUNBOOK_TEMPLATES.database_migration, "rb_1");
    const exec = m.startExecution(rb);

    expect(exec.runbookId).toBe("rb_1");
    expect(exec.currentStep).toBe(0);
    expect(exec.status).toBe("in_progress");
    expect(exec.stepStatuses.length).toBe(5);
    expect(exec.stepStatuses.every((s) => s === "pending")).toBe(true);
  });

  it("advanceStep: success flow", async () => {
    const m = await import("@/lib/runbookGenerator");
    const rb = m.createRunbook(m.RUNBOOK_TEMPLATES.deploy_rollback, "rb_2");
    let exec = m.startExecution(rb);

    exec = m.advanceStep(exec, "completed", "Step 1 done");
    expect(exec.currentStep).toBe(1);
    expect(exec.stepStatuses[0]).toBe("completed");
    expect(exec.notes.length).toBe(1);

    exec = m.advanceStep(exec, "completed");
    exec = m.advanceStep(exec, "completed");
    exec = m.advanceStep(exec, "completed");
    expect(exec.status).toBe("completed");
  });

  it("advanceStep: failure", async () => {
    const m = await import("@/lib/runbookGenerator");
    const rb = m.createRunbook(m.RUNBOOK_TEMPLATES.deploy_rollback, "rb_3");
    let exec = m.startExecution(rb);

    exec = m.advanceStep(exec, "completed");
    exec = m.advanceStep(exec, "failed", "Deployment failed");
    expect(exec.status).toBe("failed");
    expect(exec.stepStatuses[1]).toBe("failed");
  });

  it("getEscalationPath", async () => {
    const m = await import("@/lib/runbookGenerator");
    const rb = m.createRunbook(m.RUNBOOK_TEMPLATES.database_migration, "rb_4");

    // Critical → telegram
    const critical = m.getEscalationPath(rb, "critical");
    expect(critical).not.toBeNull();
    expect(critical!.channel).toBe("telegram");

    // Major → email
    const major = m.getEscalationPath(rb, "major");
    expect(major).not.toBeNull();
    expect(major!.channel).toBe("email");

    // Minor → falls back to available path
    const minor = m.getEscalationPath(rb, "minor");
    expect(minor).not.toBeNull();
  });

  it("formatRunbook", async () => {
    const m = await import("@/lib/runbookGenerator");
    const rb = m.createRunbook(m.RUNBOOK_TEMPLATES.incident_response, "rb_5");
    const formatted = m.formatRunbook(rb);

    expect(formatted).toContain("Runbook: Incident Response");
    expect(formatted).toContain("Prerequisites:");
    expect(formatted).toContain("Steps:");
    expect(formatted).toContain("Rollback:");
  });

  it("all templates have valid structure", async () => {
    const m = await import("@/lib/runbookGenerator");
    const keys = m.getTemplateKeys();

    for (const key of keys) {
      const t = m.RUNBOOK_TEMPLATES[key];
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.steps.length).toBeGreaterThan(0);
      expect(t.estimatedTotalMinutes).toBeGreaterThan(0);
      expect(t.escalationPaths.length).toBeGreaterThan(0);
      // Steps are ordered
      for (let i = 0; i < t.steps.length; i++) {
        expect(t.steps[i].order).toBe(i + 1);
      }
    }
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("createRunbook");
    expect(idx).toContain("RUNBOOK_TEMPLATES");
    expect(idx).toContain("formatRunbook");
  });
});
