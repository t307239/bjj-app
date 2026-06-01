import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { robustStripe } from "@/lib/robust/payments";
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
    event = robustStripe.webhooks.constructEvent(
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
    try {
      await handler(event);
    } catch (err) {
      clientLogger.error(`robust.webhook.handler_error.${event.type}`, {}, err);
      return NextResponse.json({ error: "Handler failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
