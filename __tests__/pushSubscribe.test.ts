/**
 * pushSubscribe — validation logic tests
 *
 * Tests for the Zod schema, rate limiting, and timezone validation
 * used in app/api/push/subscribe/route.ts.
 *
 * Pure logic is re-implemented here since route handlers aren't
 * directly importable without Next.js runtime.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";

// ── Re-implement pure functions (mirrors push/subscribe/route.ts) ──────────

const SubscribeBodySchema = z.object({
  endpoint: z.string().url().max(2048),
  timezone: z.string().max(100).optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkPushRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  entry.count++;
  return entry.count <= 20;
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ── SubscribeBodySchema ─────────────────────────────────────────────────────

describe("SubscribeBodySchema", () => {
  const validBody = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    timezone: "Asia/Tokyo",
    keys: { p256dh: "BNcRdreALRFXTkO...", auth: "tBHItq..." },
  };

  it("accepts valid subscription body", () => {
    const result = SubscribeBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("accepts body without timezone (optional)", () => {
    const { timezone, ...noTz } = validBody;
    const result = SubscribeBodySchema.safeParse(noTz);
    expect(result.success).toBe(true);
  });

  it("rejects missing endpoint", () => {
    const { endpoint, ...noEndpoint } = validBody;
    const result = SubscribeBodySchema.safeParse(noEndpoint);
    expect(result.success).toBe(false);
  });

  it("rejects invalid endpoint URL", () => {
    const result = SubscribeBodySchema.safeParse({
      ...validBody,
      endpoint: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects endpoint longer than 2048 chars", () => {
    const result = SubscribeBodySchema.safeParse({
      ...validBody,
      endpoint: "https://example.com/" + "a".repeat(2048),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing keys", () => {
    const { keys, ...noKeys } = validBody;
    const result = SubscribeBodySchema.safeParse(noKeys);
    expect(result.success).toBe(false);
  });

  it("rejects empty p256dh", () => {
    const result = SubscribeBodySchema.safeParse({
      ...validBody,
      keys: { p256dh: "", auth: "abc" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty auth key", () => {
    const result = SubscribeBodySchema.safeParse({
      ...validBody,
      keys: { p256dh: "abc", auth: "" },
    });
    expect(result.success).toBe(false);
  });
});

// ── isValidTimezone ─────────────────────────────────────────────────────────

describe("isValidTimezone", () => {
  it("accepts Asia/Tokyo", () => {
    expect(isValidTimezone("Asia/Tokyo")).toBe(true);
  });

  it("accepts UTC", () => {
    expect(isValidTimezone("UTC")).toBe(true);
  });

  it("accepts America/New_York", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
  });

  it("accepts Europe/London", () => {
    expect(isValidTimezone("Europe/London")).toBe(true);
  });

  it("rejects invalid timezone", () => {
    expect(isValidTimezone("Not/A/Timezone")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidTimezone("")).toBe(false);
  });

  it("rejects numeric input", () => {
    expect(isValidTimezone("12345")).toBe(false);
  });
});

// ── checkPushRateLimit ──────────────────────────────────────────────────────

describe("checkPushRateLimit", () => {
  beforeEach(() => {
    rateMap.clear();
  });

  it("allows first request from new IP", () => {
    expect(checkPushRateLimit("1.2.3.4")).toBe(true);
  });

  it("allows up to 20 requests from same IP", () => {
    for (let i = 0; i < 19; i++) {
      expect(checkPushRateLimit("10.0.0.1")).toBe(true);
    }
    // 20th should still pass
    expect(checkPushRateLimit("10.0.0.1")).toBe(true);
  });

  it("rejects 21st request from same IP", () => {
    for (let i = 0; i < 20; i++) {
      checkPushRateLimit("10.0.0.2");
    }
    expect(checkPushRateLimit("10.0.0.2")).toBe(false);
  });

  it("different IPs are independent", () => {
    for (let i = 0; i < 20; i++) {
      checkPushRateLimit("10.0.0.3");
    }
    // Different IP should still be allowed
    expect(checkPushRateLimit("10.0.0.4")).toBe(true);
  });
});
