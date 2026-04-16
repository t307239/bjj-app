/**
 * Unit tests: Admin API authorization + rate limit (Q-53)
 *
 * Admin endpoints (/api/admin/*) use email-based allowlist and a per-IP
 * rate limit. Non-admin requests must be rejected with 403. Rate-limited
 * IPs must be rejected with 429. These contracts are critical for
 * preventing info-leakage and abuse.
 *
 * Run:  npx vitest run __tests__/adminAuth.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Helpers mirroring app/api/admin/users/route.ts ───────────────────────────

function isAdminEmail(email: string | null | undefined, adminEmail: string | undefined): boolean {
  if (!email || !adminEmail) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}

/** Per-IP rate limiter: max 60 admin queries / 10 min. */
function makeRateLimiter(max = 60, windowMs = 10 * 60 * 1000) {
  const map = new Map<string, { count: number; resetAt: number }>();
  return function check(ip: string, now = Date.now()): boolean {
    const entry = map.get(ip);
    if (!entry || now > entry.resetAt) {
      map.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= max;
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("isAdminEmail", () => {
  it("returns true for exact email match", () => {
    expect(isAdminEmail("admin@example.com", "admin@example.com")).toBe(true);
  });

  it("is case-insensitive (both sides lowercased)", () => {
    expect(isAdminEmail("Admin@Example.COM", "admin@example.com")).toBe(true);
    expect(isAdminEmail("admin@example.com", "ADMIN@EXAMPLE.COM")).toBe(true);
  });

  it("rejects non-admin emails", () => {
    expect(isAdminEmail("user@example.com", "admin@example.com")).toBe(false);
  });

  it("rejects when user email is missing (unauthenticated)", () => {
    expect(isAdminEmail(null, "admin@example.com")).toBe(false);
    expect(isAdminEmail(undefined, "admin@example.com")).toBe(false);
    expect(isAdminEmail("", "admin@example.com")).toBe(false);
  });

  it("rejects when ADMIN_EMAIL env var is not set (fail-closed)", () => {
    expect(isAdminEmail("anything@example.com", undefined)).toBe(false);
    expect(isAdminEmail("anything@example.com", "")).toBe(false);
  });

  it("rejects substring matches (prevents user@admin.com bypass)", () => {
    expect(isAdminEmail("attacker.admin@example.com", "admin@example.com")).toBe(false);
    expect(isAdminEmail("admin@example.com.attacker.com", "admin@example.com")).toBe(false);
  });
});

describe("admin rate limiter", () => {
  let check: ReturnType<typeof makeRateLimiter>;

  beforeEach(() => {
    check = makeRateLimiter(5, 10_000); // 5 per 10s for test
  });

  it("allows the first request from a new IP", () => {
    expect(check("1.2.3.4")).toBe(true);
  });

  it("allows up to the configured max, then rejects", () => {
    for (let i = 0; i < 5; i++) expect(check("1.2.3.4")).toBe(true);
    expect(check("1.2.3.4")).toBe(false);
  });

  it("tracks IPs independently (one IP's limit does not affect another)", () => {
    for (let i = 0; i < 5; i++) expect(check("1.2.3.4")).toBe(true);
    expect(check("1.2.3.4")).toBe(false);
    // Other IP still fresh
    expect(check("5.6.7.8")).toBe(true);
  });

  it("resets the counter after the window expires", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(check("1.2.3.4", t0)).toBe(true);
    expect(check("1.2.3.4", t0)).toBe(false);

    // After the window
    expect(check("1.2.3.4", t0 + 10_001)).toBe(true);
  });
});
