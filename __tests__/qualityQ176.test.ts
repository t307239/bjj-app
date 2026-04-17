/**
 * Tests for Q-176: prReviewChecklist (DX 94→95)
 */
import { describe, it, expect } from "vitest";

describe("Q-176: prReviewChecklist", () => {
  it("COMMIT_TYPES", async () => {
    const m = await import("@/lib/prReviewChecklist");
    expect(m.COMMIT_TYPES).toContain("feat");
    expect(m.COMMIT_TYPES).toContain("fix");
    expect(m.COMMIT_TYPES).toContain("refactor");
    expect(m.COMMIT_TYPES.length).toBe(11);
  });

  it("PR_SIZE_THRESHOLDS", async () => {
    const m = await import("@/lib/prReviewChecklist");
    expect(m.PR_SIZE_THRESHOLDS.xs).toBe(10);
    expect(m.PR_SIZE_THRESHOLDS.xl).toBe(1000);
  });

  it("validateCommitMessage: valid", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const result = m.validateCommitMessage("feat(auth): add login flow");
    expect(result.valid).toBe(true);
    expect(result.type).toBe("feat");
    expect(result.scope).toBe("auth");
    expect(result.subject).toBe("add login flow");
  });

  it("validateCommitMessage: no scope", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const result = m.validateCommitMessage("fix: resolve crash on startup");
    expect(result.valid).toBe(true);
    expect(result.type).toBe("fix");
    expect(result.scope).toBeNull();
  });

  it("validateCommitMessage: invalid format", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const result = m.validateCommitMessage("updated something");
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("validateCommitMessage: unknown type", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const result = m.validateCommitMessage("yolo: break things");
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain("Unknown commit type");
  });

  it("validateCommitMessage: subject too long", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const longSubject = "a".repeat(80);
    const result = m.validateCommitMessage(`feat: ${longSubject}`);
    expect(result.issues.some((i) => i.includes("too long"))).toBe(true);
  });

  it("classifyPRSize", async () => {
    const m = await import("@/lib/prReviewChecklist");
    expect(m.classifyPRSize(3, 2)).toBe("xs");
    expect(m.classifyPRSize(30, 10)).toBe("s");
    expect(m.classifyPRSize(100, 80)).toBe("m");
    expect(m.classifyPRSize(300, 150)).toBe("l");
    expect(m.classifyPRSize(600, 300)).toBe("xl");
    expect(m.classifyPRSize(1000, 500)).toBe("xxl");
  });

  it("detectCodeSmells: console.log", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const source = 'const x = 1;\nconsole.log("debug");\nreturn x;';
    const smells = m.detectCodeSmells(source, "app.ts");
    expect(smells.some((s) => s.type === "console_log")).toBe(true);
    expect(smells[0].line).toBe(2);
  });

  it("detectCodeSmells: skips console in test files", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const source = 'console.log("test output");';
    const smells = m.detectCodeSmells(source, "app.test.ts");
    expect(smells.some((s) => s.type === "console_log")).toBe(false);
  });

  it("detectCodeSmells: empty catch", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const source = "try { foo(); } catch (e) {}";
    const smells = m.detectCodeSmells(source, "app.ts");
    expect(smells.some((s) => s.type === "empty_catch")).toBe(true);
  });

  it("generateReviewChecklist: TS files", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const checklist = m.generateReviewChecklist(["ts", "tsx"], "m");
    expect(checklist.some((c) => c.check.includes("TypeScript types"))).toBe(true);
    expect(checklist.some((c) => c.check.includes("secrets"))).toBe(true);
  });

  it("generateReviewChecklist: XL PR", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const checklist = m.generateReviewChecklist(["ts"], "xl");
    expect(checklist.some((c) => c.check.includes("splitting"))).toBe(true);
  });

  it("assessPRRisk", async () => {
    const m = await import("@/lib/prReviewChecklist");
    expect(m.assessPRRisk("xs", 2, 0)).toBe("low");
    expect(m.assessPRRisk("l", 12, 3)).toBe("medium");
    expect(m.assessPRRisk("xxl", 25, 15)).toBe("high");
  });

  it("analyzePR", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const analysis = m.analyzePR({
      commits: [
        { hash: "abc", message: "feat: add feature", author: "dev", date: "2026-04-18" },
      ],
      linesAdded: 80,
      linesRemoved: 20,
      filesChanged: 5,
      fileExtensions: ["ts", "tsx"],
      sourceSnippets: [
        { fileName: "app.ts", content: 'console.log("debug");\nconst x: any = 1;' },
      ],
    });
    expect(analysis.size).toBe("m");
    expect(analysis.commitValidation[0].valid).toBe(true);
    expect(analysis.codeSmells.length).toBeGreaterThan(0);
    expect(analysis.checklist.length).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(analysis.riskLevel);
  });

  it("formatPRAnalysis", async () => {
    const m = await import("@/lib/prReviewChecklist");
    const analysis = m.analyzePR({
      commits: [{ hash: "abc", message: "feat: test", author: "dev", date: "2026-04-18" }],
      linesAdded: 30,
      linesRemoved: 10,
      filesChanged: 3,
      fileExtensions: ["ts"],
    });
    const formatted = m.formatPRAnalysis(analysis);
    expect(formatted).toContain("PR Analysis");
    expect(formatted).toContain("Size:");
    expect(formatted).toContain("Risk:");
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("validateCommitMessage");
    expect(idx).toContain("analyzePR");
    expect(idx).toContain("COMMIT_TYPES");
  });
});
