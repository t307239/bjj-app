/**
 * Unit tests: Stripe Webhook business-logic paths (Q-52)
 *
 * Extends webhook.test.ts with plan_type routing, subscription state
 * transitions, and B2B/B2C decision logic. Pure functions defined inline
 * mirror the business rules in app/api/stripe/webhook/route.ts.
 *
 * Run:  npx vitest run __tests__/stripeWebhookLogic.test.ts
 */

import { describe, it, expect } from "vitest";

// ── Helpers mirroring webhook route logic ────────────────────────────────────

type PlanType = "b2c_pro" | "b2b_gym";

function extractPlanType(metadata?: Record<string, string> | null): PlanType {
  return (metadata?.plan_type as PlanType) ?? "b2c_pro";
}

/** Maps incoming Stripe event types to an action the webhook performs. */
function routeStripeEvent(
  eventType: string
): "upgrade" | "downgrade" | "past_due" | "recover" | "ignore" {
  switch (eventType) {
    case "checkout.session.completed":
      return "upgrade";
    case "customer.subscription.deleted":
      return "downgrade";
    case "invoice.payment_failed":
      return "past_due";
    case "invoice.paid":
      return "recover";
    default:
      return "ignore";
  }
}

/**
 * Decides whether `is_pro` should remain true when a B2B subscription
 * is cancelled. Rule: only remain Pro if there's still an active B2C Pro sub.
 */
function retainProAfterB2BCancel(
  activeSubs: Array<{ metadata?: { plan_type?: string } }>
): boolean {
  return activeSubs.some((s) => s.metadata?.plan_type === "b2c_pro");
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("extractPlanType", () => {
  it("returns b2c_pro when metadata is missing", () => {
    expect(extractPlanType(null)).toBe("b2c_pro");
    expect(extractPlanType(undefined)).toBe("b2c_pro");
    expect(extractPlanType({})).toBe("b2c_pro");
  });

  it("returns b2b_gym when plan_type is explicitly b2b_gym", () => {
    expect(extractPlanType({ plan_type: "b2b_gym" })).toBe("b2b_gym");
  });

  it("returns b2c_pro when plan_type is explicitly b2c_pro", () => {
    expect(extractPlanType({ plan_type: "b2c_pro" })).toBe("b2c_pro");
  });
});

describe("routeStripeEvent", () => {
  it("routes checkout.session.completed to upgrade", () => {
    expect(routeStripeEvent("checkout.session.completed")).toBe("upgrade");
  });

  it("routes customer.subscription.deleted to downgrade", () => {
    expect(routeStripeEvent("customer.subscription.deleted")).toBe("downgrade");
  });

  it("routes invoice.payment_failed to past_due (banner shown)", () => {
    expect(routeStripeEvent("invoice.payment_failed")).toBe("past_due");
  });

  it("routes invoice.paid to recover (clears past_due, restores is_pro)", () => {
    expect(routeStripeEvent("invoice.paid")).toBe("recover");
  });

  it("ignores unrelated events to avoid accidental state mutations", () => {
    expect(routeStripeEvent("payment_intent.created")).toBe("ignore");
    expect(routeStripeEvent("customer.created")).toBe("ignore");
    expect(routeStripeEvent("charge.succeeded")).toBe("ignore");
  });
});

describe("retainProAfterB2BCancel", () => {
  it("keeps is_pro=true when a parallel B2C Pro subscription is still active", () => {
    const active = [{ metadata: { plan_type: "b2c_pro" } }];
    expect(retainProAfterB2BCancel(active)).toBe(true);
  });

  it("sets is_pro=false when only B2B subs (now cancelled) existed", () => {
    const active: Array<{ metadata?: { plan_type?: string } }> = [];
    expect(retainProAfterB2BCancel(active)).toBe(false);
  });

  it("ignores non-B2C-Pro active subscriptions", () => {
    const active = [{ metadata: { plan_type: "b2b_gym" } }];
    expect(retainProAfterB2BCancel(active)).toBe(false);
  });
});

describe("subscription status transitions", () => {
  /** Contract: which subscription_status do we write to profiles per event? */
  function nextStatus(event: string): "canceled" | "past_due" | "active" | null {
    switch (event) {
      case "customer.subscription.deleted":
        return "canceled";
      case "invoice.payment_failed":
        return "past_due";
      case "invoice.paid":
        return "active";
      default:
        return null;
    }
  }

  it("cancelled subscription → subscription_status = canceled", () => {
    expect(nextStatus("customer.subscription.deleted")).toBe("canceled");
  });

  it("failed invoice → subscription_status = past_due", () => {
    expect(nextStatus("invoice.payment_failed")).toBe("past_due");
  });

  it("paid invoice → subscription_status = active (recovery from past_due)", () => {
    expect(nextStatus("invoice.paid")).toBe("active");
  });

  it("unrelated event → no status change", () => {
    expect(nextStatus("customer.created")).toBeNull();
  });
});
