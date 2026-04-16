/**
 * Tests for lib/env.ts
 * Verifies requireServerEnv throws on missing vars and returns value when set.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { requireServerEnv, serverEnv } from "@/lib/env";

describe("requireServerEnv", () => {
  const TEST_KEY = "TEST_ONLY_ENV_VAR";

  afterEach(() => {
    delete process.env[TEST_KEY];
  });

  it("returns value when env var is set", () => {
    process.env[TEST_KEY] = "secret123";
    expect(requireServerEnv(TEST_KEY)).toBe("secret123");
  });

  it("throws with descriptive message when env var is missing", () => {
    delete process.env[TEST_KEY];
    expect(() => requireServerEnv(TEST_KEY)).toThrow(
      `[env] Missing required server environment variable: "${TEST_KEY}"`
    );
  });

  it("throws when env var is empty string", () => {
    process.env[TEST_KEY] = "";
    expect(() => requireServerEnv(TEST_KEY)).toThrow(TEST_KEY);
  });
});

describe("serverEnv shortcuts", () => {
  it("adminEmail returns empty string when ADMIN_EMAIL is not set", () => {
    delete process.env.ADMIN_EMAIL;
    expect(serverEnv.adminEmail()).toBe("");
  });

  it("adminEmail returns value when set", () => {
    process.env.ADMIN_EMAIL = "test@example.com";
    expect(serverEnv.adminEmail()).toBe("test@example.com");
    delete process.env.ADMIN_EMAIL;
  });

  it("supabaseServiceRoleKey throws when not set", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => serverEnv.supabaseServiceRoleKey()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("stripeSecretKey throws when not set", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => serverEnv.stripeSecretKey()).toThrow("STRIPE_SECRET_KEY");
  });
});
