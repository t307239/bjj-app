import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Webhook signature verification failed", {
      status: 400,
    });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;

        if (userId) {
          await supabase
            .from("profiles")
            .update({
              is_pro: true,
              stripe_customer_id: customerId,
            })
            .eq("id", userId);
          console.log(`✅ User ${userId} upgraded to Pro`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        // Downgrade when subscription is cancelled
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer;

        if (customerId) {
          await supabase
            .from("profiles")
            .update({ is_pro: false })
            .eq("stripe_customer_id", customerId);
          console.log(`⬇️ Customer ${customerId} downgraded from Pro`);
        }
        break;
      }

      case "invoice.payment_failed": {
        // Optional: handle failed payments (e.g., notify user)
        console.log("Payment failed for invoice:", event.data.object);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response("Internal server error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
