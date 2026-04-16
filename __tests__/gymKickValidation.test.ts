/**
 * gymKickValidation — validation + rate limit tests
 *
 * Tests for Zod schema and rate limiting in app/api/gym/kick/route.ts.
 * Pure logic re-implemented since route handlers need Next.js runtime.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";

// ── Re-implement pure logic (mirrors gym/kick/route.ts) ──────────────────

const KickBodySchema = z.object({
  member_id: z.string().uuid("Invalid member ID"),
});

const kickRateMap = new Map<string, { count: number; resetAt: number }>();
function checkKickRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = kickRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    kickRateMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  entry.count++;
  return entry.count <= 20;
}

// ── KickBodySchema ──────────────────────────────────────────────────────────

describe("KickBodySchema", () => {
  const validUUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  it("accepts valid UUID member_id", () => {
    const result = KickBodySchema.safeParse({ member_id: validUUID });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID string", () => {
    const result = KickBodySchema.safeParse({ member_id: "not-a-uuid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid member ID");
    }
  });

  it("rejects empty string", () => {
    const result = KickBodySchema.safeParse({ member_id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing member_id", () => {
    const result = KickBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects null", () => {
    const result = KickBodySchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it("rejects numeric member_id", () => {
    const result = KickBodySchema.safeParse({ member_id: 12345 });
    expect(result.success).toBe(false);
  });

  it("ignores extra fields (strips unknown)", () => {
    const result = KickBodySchema.safeParse({
      member_id: validUUID,
      extra_field: "malicious",
    });
    expect(result.success).toBe(true);
  });
});

// ── checkKickRateLimit ──────────────────────────────────────────────────────

describe("checkKickRateLimit", () => {
  beforeEach(() => {
    kickRateMap.clear();
  });

  it("allows first request", () => {
    expect(checkKickRateLimit("10.0.0.1")).toBe(true);
  });

  it("allows up to 20 requests", () => {
    for (let i = 0; i < 20; i++) {
      expect(checkKickRateLimit("10.0.0.2")).toBe(true);
    }
  });

  it("rejects 21st request", () => {
    for (let i = 0; i < 20; i++) {
      checkKickRateLimit("10.0.0.3");
    }
    expect(checkKickRateLimit("10.0.0.3")).toBe(false);
  });

  it("isolates different IPs", () => {
    for (let i = 0; i < 20; i++) {
      checkKickRateLimit("10.0.0.4");
    }
    expect(checkKickRateLimit("10.0.0.5")).toBe(true);
  });
});
