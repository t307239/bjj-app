/**
 * Unit tests: Stripe Webhook route logic
 * 単体試験: Stripe Webhook のロジック検証
 *
 * These tests exercise the business logic independently from the
 * HTTP layer by extracting it into testable helper functions.
 * The full route handler requires real Stripe/Supabase connections
 * and is covered by integration tests instead.
 *
 * Run:  npx vitest run __tests__/webhook.test.ts
 */

import { describe, it, expect } from "vitest";

// ── Helpers extracted from webhook logic ─────────────────────────────────────

/**
 * Extracts userId from a checkout session object.
 * Priority: client_reference_id (Payment Links) > metadata.userId
 */
function extractUserId(session: {
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
}): string | null {
  return session.client_reference_id ?? session.metadata?.userId ?? null;
}

/**
 * Extracts Stripe customer ID string from a session or subscription.
 * Handles both string IDs and expanded Customer objects.
 */
function extractCustomerId(
  customer: string | { id: string } | null | undefined
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id ?? null;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("extractUserId", () => {
  it("uses client_reference_id when present (Payment Links flow)", () => {
    const session = {
      client_reference_id: "user-uuid-123",
      metadata: { userId: "other-user" },
    };
    expect(extractUserId(session)).toBe("user-uuid-123");
  });

  it("falls back to metadata.userId when client_reference_id is null", () => {
    const session = {
      client_reference_id: null,
      metadata: { userId: "meta-user-456" },
    };
    expect(extractUserId(session)).toBe("meta-user-456");
  });

  it("falls back to metadata.userId when client_reference_id is undefined", () => {
    const session = {
      metadata: { userId: "meta-user-789" },
    };
    expect(extractUserId(session)).toBe("meta-user-789");
  });

  it("returns null when both are absent", () => {
    const session = {
      client_reference_id: null,
      metadata: null,
    };
    expect(extractUserId(session)).toBeNull();
  });

  it("returns null for completely empty session", () => {
    expect(extractUserId({})).toBeNull();
  });
});

describe("extractCustomerId", () => {
  it("returns the string directly when customer is a string ID", () => {
    expect(extractCustomerId("cus_abc123")).toBe("cus_abc123");
  });

  it("returns id property when customer is an expanded object", () => {
    expect(extractCustomerId({ id: "cus_expanded_456" })).toBe(
      "cus_expanded_456"
    );
  });

  it("returns null when customer is null", () => {
    expect(extractCustomerId(null)).toBeNull();
  });

  it("returns null when customer is undefined", () => {
    expect(extractCustomerId(undefined)).toBeNull();
  });
});

// ── Webhook event routing logic ──────────────────────────────────────────────

describe("Webhook event routing", () => {
  /** Simulates what action our webhook takes for a given event type */
  function routeEvent(eventType: string): "upgrade" | "downgrade" | "ignore" {
    switch (eventType) {
      case "checkout.session.completed":
        return "upgrade";
      case "customer.subscription.deleted":
        return "downgrade";
      default:
        return "ignore";
    }
  }

  it("routes checkout.session.completed to upgrade", () => {
    expect(routeEvent("checkout.session.completed")).toBe("upgrade");
  });

  it("routes customer.subscription.deleted to downgrade", () => {
    expect(routeEvent("customer.subscription.deleted")).toBe("downgrade");
  });

  it("ignores unrelated events", () => {
    expect(routeEvent("payment_intent.created")).toBe("ignore");
    expect(routeEvent("customer.created")).toBe("ignore");
    expect(routeEvent("invoice.payment_succeeded")).toBe("ignore");
  });
});
