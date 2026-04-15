/**
 * Q-36: Verify /api/health route structure and response contract.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const filePath = path.resolve(__dirname, "../app/api/health/route.ts");

describe("/api/health route", () => {
  const source = fs.readFileSync(filePath, "utf-8");

  it("exports GET handler", () => {
    expect(source).toContain("export async function GET");
  });

  it("uses edge runtime", () => {
    expect(source).toContain('export const runtime = "edge"');
  });

  it("disables caching", () => {
    expect(source).toContain("Cache-Control");
    expect(source).toContain("no-store");
  });

  it("returns status ok/degraded", () => {
    expect(source).toContain('"ok"');
    expect(source).toContain('"degraded"');
  });

  it("includes uptime in response", () => {
    expect(source).toContain("uptimeSeconds");
  });

  it("includes version and region for operational visibility (Q-35)", () => {
    expect(source).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(source).toContain("VERCEL_REGION");
  });

  it("checks DB connectivity", () => {
    expect(source).toContain('from("profiles")');
    expect(source).toContain("select");
  });

  it("returns 503 on DB failure", () => {
    expect(source).toContain("status: 503");
  });
});
