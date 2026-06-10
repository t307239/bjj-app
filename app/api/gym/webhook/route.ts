import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/robust/payments";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { handleCheckoutCompleted } from "./handlers/checkout-completed";
import { handleInvoicePaid } from "./handlers/invoice-paid";
import { handleInvoicePaymentFailed } from "./handlers/invoice-payment-failed";
import { handleSubscriptionDeleted } from "./handlers/subscription-deleted";
import { robustLogger } from "@/lib/robust/logger";

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
    robustLogger.error("robust.webhook.signature_error", {}, err);
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
    const admin = createRobustAdminClient();

    // Why: read → handler → insert の順では同時再送の TOCTOU レースを防げない。
    //      先に INSERT で排他権を確保し、23505（UNIQUE違反）なら処理済みとしてスキップ。
    //      handler が失敗した場合は DELETE で巻き戻し、Stripe が再送できるようにする。
    const { error: claimError } = await admin
      .from("webhook_events")
      .insert({ event_id: event.id });

    if (claimError) {
      if (claimError.code === "23505") {
        // 別リクエストが先に処理中 or 処理済み → 重複スキップ
        robustLogger.warn("robust.webhook.duplicate", { eventId: event.id });
        return NextResponse.json({ received: true, skipped: "duplicate" });
      }
      // その他のDBエラーは handler を実行せずエラー返却（Stripe がリトライ）
      robustLogger.error("robust.webhook.claim_error", { eventId: event.id }, claimError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    try {
      await handler(event);
    } catch (err) {
      robustLogger.error(`robust.webhook.handler_error.${event.type}`, { eventId: event.id }, err);
      // 巻き戻し: DELETE して Stripe の再送が再処理できるようにする
      await admin.from("webhook_events").delete().eq("event_id", event.id);
      return NextResponse.json({ error: "Handler failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
