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
        // Payment Links use client_reference_id; programmatic checkout uses metadata.userId
        const userId = session.client_reference_id ?? session.metadata?.userId;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : (session.customer as Stripe.Customer | null)?.id ?? null;

        const planType = session.metadata?.plan_type ?? "b2c_pro";

        if (userId) {
          if (planType === "b2b_gym") {
            // B2B Gym plan: activate gym + mark owner as Pro + cancel any existing B2C Pro sub
            const gymId = session.metadata?.gym_id;

            if (gymId) {
              const { error: gymError } = await supabase
                .from("gyms")
                .update({ is_active: true })
                .eq("id", gymId)
                .eq("owner_id", userId);
              if (gymError) {
                console.error(`❌ Failed to activate gym ${gymId}:`, gymError);
              } else {
                console.log(`✅ Gym ${gymId} activated for owner ${userId}`);
              }
            }

            // B2B includes B2C Pro — ensure is_pro = true
            await supabase
              .from("profiles")
              .update({ is_pro: true, stripe_customer_id: customerId })
              .eq("id", userId);

            // Cancel any existing B2C Pro subscription to avoid double-billing
            if (customerId) {
              const existingSubs = await stripe.subscriptions.list({
                customer: customerId,
                status: "active",
              });
              for (const sub of existingSubs.data) {
                if (sub.metadata?.plan_type === "b2c_pro") {
                  await stripe.subscriptions.cancel(sub.id);
                  console.log(`✅ Cancelled B2C Pro sub ${sub.id} for B2B customer ${customerId}`);
                }
              }
            }
            console.log(`✅ B2B Gym checkout completed for user ${userId}`);
          } else {
            // B2C Pro plan
            const { error } = await supabase
              .from("profiles")
              .update({
                is_pro: true,
                stripe_customer_id: customerId,
              })
              .eq("id", userId);
            if (error) {
              console.error(`❌ Failed to update is_pro for user ${userId}:`, error);
            } else {
              console.log(`✅ User ${userId} upgraded to Pro (customer: ${customerId})`);
            }
          }
        } else {
          console.warn("⚠️ checkout.session.completed: no userId found in client_reference_id or metadata");
        }
        break;
      }

      case "customer.subscription.deleted": {
        // Downgrade when subscription is cancelled
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : typeof subscription.customer === "object" && subscription.customer !== null && "id" in subscription.customer
            ? (subscription.customer as Stripe.Customer).id
            : null;
        const cancelledPlanType = subscription.metadata?.plan_type ?? "b2c_pro";

        if (customerId) {
          if (cancelledPlanType === "b2b_gym") {
            // B2B cancelled: deactivate gym. is_pro goes to false only if no other active B2C Pro sub.
            const activeSubs = await stripe.subscriptions.list({
              customer: customerId,
              status: "active",
            });
            const hasB2cPro = activeSubs.data.some((s) => s.metadata?.plan_type === "b2c_pro");

            // Deactivate gym
            await supabase
              .from("gyms")
              .update({ is_active: false })
              .eq("owner_id", (await supabase.from("profiles").select("id").eq("stripe_customer_id", customerId).single()).data?.id ?? "");

            // Downgrade is_pro only if no B2C Pro
            await supabase
              .from("profiles")
              .update({ is_pro: hasB2cPro, subscription_status: "canceled" })
              .eq("stripe_customer_id", customerId);
            console.log(`⬇️ B2B cancelled for customer ${customerId}. is_pro set to ${hasB2cPro}`);
          } else {
            // B2C Pro cancelled
            await supabase
              .from("profiles")
              .update({ is_pro: false, subscription_status: "canceled" })
              .eq("stripe_customer_id", customerId);
            console.log(`⬇️ B2C Pro cancelled for customer ${customerId}`);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        // Mark subscription as past_due — shows ProStatusBanner warning in UI
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : null;
        if (customerId) {
          await supabase
            .from("profiles")
            .update({ subscription_status: "past_due" })
            .eq("stripe_customer_id", customerId);
          console.log(`⚠️ Payment failed for customer ${customerId} — marked past_due`);
        }
        break;
      }

      case "invoice.paid": {
        // Clear past_due when payment recovers
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : null;
        if (customerId) {
          await supabase
            .from("profiles")
            .update({ subscription_status: "active" })
            .eq("stripe_customer_id", customerId);
        }
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
