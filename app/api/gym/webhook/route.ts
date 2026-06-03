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
    const admin = createRobustAdminClient();
    // Why: INSERT→handler の順だと handler 失敗時に event_id が残り Stripe の再送が 200 skipped になり
    //      永久に再処理されなくなる。正しい順序は「先に重複チェック→handler 成功後に記録」。
    const { data: already } = await admin
      .from("webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();
    if (already) {
      clientLogger.warn("robust.webhook.duplicate", { eventId: event.id });
      return NextResponse.json({ received: true, skipped: "duplicate" });
    }

    try {
      await handler(event);
    } catch (err) {
      clientLogger.error(`robust.webhook.handler_error.${event.type}`, {}, err);
      // 記録しない → Stripe が再送してリトライできる
      return NextResponse.json({ error: "Handler failed" }, { status: 500 });
    }

    // 成功後にのみ記録
    await admin.from("webhook_events").insert({ event_id: event.id });
  }

  return NextResponse.json({ received: true });
}
