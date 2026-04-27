/**
 * dbCheck — unit tests for DB integrity check cron route
 *
 * Tests the auth guard and response structure.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROUTE_PATH = path.resolve(__dirname, "../app/api/cron/db-check/route.ts");

describe("db-check cron route", () => {
  it("route file exists", () => {
    expect(fs.existsSync(ROUTE_PATH)).toBe(true);
  });

  it("exports GET handler", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain("export async function GET");
  });

  it("requires CRON_SECRET auth", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    // z169: auth ロジックは lib/cronAuth.ts (verifyCronAuth) に集約済。
    // 401 / Bearer / fail-closed は helper 内 (cronAuth.test.ts でカバー)。
    expect(source).toContain("verifyCronAuth");
  });

  it("checks orphan training logs", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain("orphan_training_logs");
  });

  it("checks invalid belt values", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain("invalid_belt_values");
    expect(source).toContain("white");
    expect(source).toContain("black");
  });

  it("checks future-dated logs", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain("future_dated_logs");
  });

  it("checks duplicate push endpoints", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain("duplicate_push_endpoints");
  });

  it("logs results with logger", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toContain('logger.info');
    expect(source).toContain("db_integrity_check");
  });

  it("returns JSON with ok/warnings/criticals fields", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf-8");
    // Response uses shorthand: { ok: ..., warnings, criticals, results }
    expect(source).toContain("ok:");
    expect(source).toContain("warnings");
    expect(source).toContain("criticals");
  });

  it("is scheduled weekly in vercel.json", () => {
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../vercel.json"), "utf-8")
    );
    const dbCheckCron = vercelConfig.crons.find(
      (c: { path: string }) => c.path === "/api/cron/db-check"
    );
    expect(dbCheckCron).toBeDefined();
    expect(dbCheckCron.schedule).toBe("0 3 * * 0");
  });
});
