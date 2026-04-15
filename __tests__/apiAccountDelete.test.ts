/**
 * Q-36: Verify /api/account/delete route structure — soft delete + rate limit.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const filePath = path.resolve(__dirname, "../app/api/account/delete/route.ts");

describe("/api/account/delete route", () => {
  const source = fs.readFileSync(filePath, "utf-8");

  it("exports POST handler", () => {
    expect(source).toContain("export async function POST");
  });

  it("implements rate limiting (3 attempts per 15 min)", () => {
    expect(source).toContain("checkDeleteRateLimit");
    expect(source).toContain("entry.count <= 3");
  });

  it("performs soft delete (sets deleted_at, not hard delete)", () => {
    expect(source).toContain("deleted_at");
    expect(source).toContain(".update(");
    expect(source).not.toContain(".delete(");
  });

  it("uses service role client for privileged operation", () => {
    expect(source).toContain("createServiceClient");
    expect(source).toContain("supabaseServiceRoleKey");
  });

  it("logs the deletion event", () => {
    expect(source).toContain('logger.info("account.softDelete"');
  });

  it("returns 429 on rate limit exceeded", () => {
    expect(source).toContain("status: 429");
  });

  it("returns 401 for unauthenticated users", () => {
    expect(source).toContain("status: 401");
  });
});
