import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/robust/payments";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { handleCheckoutCompleted } from "./handlers/checkout-completed";
import { handleInvoicePaid } from "./handlers/invoice-paid";
import { handleInvoicePaymentFailed } from "./handlers/invoice-payment-failed";
import { handleSubscriptionDeleted } from "./handlers/subscription-deleted";
import { clientLogger } from "@/lib/clientLogger";

// auth: webhook — Stripe 署名検証で代替
export async function POST(req: NextRequest) {
  const body = await req.text(); // raw text 必須（JSON.parse 前）
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "署名がありません" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.ROBUST_STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    clientLogger.error("robust.webhook.signature_error", {}, err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const handlers: Record<string, (e: Stripe.Event) => Promise<void>> = {
    "checkout.session.completed":      handleCheckoutCompleted,
    "invoice.paid":                    handleInvoicePaid,
    "invoice.payment_failed":          handleInvoicePaymentFailed,
    "customer.subscription.deleted":   handleSubscriptionDeleted,
  };

  const handler = handlers[event.type];
  if (handler) {
    // Why: Stripe は同一イベントを再送することがある。
    //      webhook_events テーブルで event.id を冪等キーとして管理し二重処理を防ぐ。
    const admin = createRobustAdminClient();
    const { error: insertError } = await admin
      .from("webhook_events")
      .insert({ event_id: event.id });
    if (insertError) {
      // PK 重複 (23505) = 処理済み → 200 を返して Stripe のリトライを止める
      if (insertError.code === "23505") {
        clientLogger.warn("robust.webhook.duplicate", { eventId: event.id });
        return NextResponse.json({ received: true, skipped: "duplicate" });
      }
      clientLogger.error("robust.webhook.idempotency_error", { eventId: event.id }, insertError);
    }
    try {
      await handler(event);
    } catch (err) {
      clientLogger.error(`robust.webhook.handler_error.${event.type}`, {}, err);
      return NextResponse.json({ error: "Handler failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
