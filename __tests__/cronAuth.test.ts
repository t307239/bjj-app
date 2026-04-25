/**
 * z169: cron fail-open prevention tests.
 *
 * Old pattern (vulnerable):
 *   ```
 *   if (cronSecret) {        // env var unset → all calls accepted!
 *     if (auth !== Bearer ...) return 401;
 *   }
 *   ```
 *
 * Fixed: verifyCronAuth always rejects when CRON_SECRET is unset.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyCronAuth } from "../lib/cronAuth";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

function makeReq(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set("authorization", authHeader);
  return new Request("https://bjj-app.net/api/cron/test", { headers });
}

describe("verifyCronAuth (z169)", () => {
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = ORIGINAL_SECRET;
    }
  });

  describe("CRON_SECRET unset (fail-closed)", () => {
    beforeEach(() => {
      delete process.env.CRON_SECRET;
    });

    it("rejects with 500 when no secret is configured (config error)", async () => {
      const result = verifyCronAuth(makeReq("Bearer anything"));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(500);
      }
    });

    it("rejects even with no Authorization header", async () => {
      const result = verifyCronAuth(makeReq());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(500);
      }
    });

    it("does not leak that the secret is missing in normal-attack flow (still rejects)", async () => {
      // Attacker tries common bypasses; all rejected.
      for (const a of ["", "Bearer ", "Bearer null", "Bearer undefined", "Basic xyz"]) {
        const r = verifyCronAuth(makeReq(a));
        expect(r.ok).toBe(false);
      }
    });
  });

  describe("CRON_SECRET set", () => {
    beforeEach(() => {
      process.env.CRON_SECRET = "test-secret-xyz";
    });

    it("accepts valid Bearer token", () => {
      const r = verifyCronAuth(makeReq("Bearer test-secret-xyz"));
      expect(r.ok).toBe(true);
    });

    it("rejects 401 with mismatched token", () => {
      const r = verifyCronAuth(makeReq("Bearer wrong-secret"));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.response.status).toBe(401);
      }
    });

    it("rejects 401 with no Authorization header", () => {
      const r = verifyCronAuth(makeReq());
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.response.status).toBe(401);
      }
    });

    it("rejects 401 with non-Bearer scheme", () => {
      const r = verifyCronAuth(makeReq("Basic test-secret-xyz"));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.response.status).toBe(401);
      }
    });

    it("is case-sensitive on token (no constant-time bypass)", () => {
      const r = verifyCronAuth(makeReq("Bearer TEST-SECRET-XYZ"));
      expect(r.ok).toBe(false);
    });
  });
});
