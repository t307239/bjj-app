import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

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
    logger.error("stripe.webhook.sig_failed", { message: (err as Error).message });
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
                logger.error("stripe.webhook.gym_activate_failed", { gymId, userId }, gymError as Error);
              } else {
                logger.info("stripe.webhook.gym_activated", { gymId, userId });
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
                  logger.info("stripe.webhook.b2c_sub_cancelled", { subId: sub.id, customerId });
                }
              }
            }
            logger.info("stripe.webhook.b2b_checkout_completed", { userId });
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
              logger.error("stripe.webhook.b2c_upgrade_failed", { userId, customerId }, error as Error);
            } else {
              logger.info("stripe.webhook.b2c_upgraded", { userId, customerId });
            }
          }
        } else {
          logger.warn("stripe.webhook.checkout_no_user_id", { sessionId: session.id });
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
            logger.info("stripe.webhook.b2b_cancelled", { customerId, isProRetained: hasB2cPro });
          } else {
            // B2C Pro cancelled
            await supabase
              .from("profiles")
              .update({ is_pro: false, subscription_status: "canceled" })
              .eq("stripe_customer_id", customerId);
            logger.info("stripe.webhook.b2c_cancelled", { customerId });
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
          logger.warn("stripe.webhook.payment_failed", { customerId });
        }
        break;
      }

      case "invoice.paid": {
        // Clear past_due when payment recovers + ensure is_pro=true for active subscribers
        // Fixes: is_pro が false のまま subscription_status だけ active になるケース
        // （解約→再契約時に checkout.session.completed が is_pro を復元できなかった場合の安全弁）
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : null;
        if (customerId) {
          await supabase
            .from("profiles")
            .update({ subscription_status: "active", is_pro: true })
            .eq("stripe_customer_id", customerId);
          logger.info("stripe.webhook.invoice_paid", { customerId });
        }
        break;
      }

      default:
        logger.debug("stripe.webhook.unhandled_event", { eventType: event.type });
    }
  } catch (err) {
    logger.error("stripe.webhook.processing_error", { eventType: event.type }, err as Error);
    return new Response("Internal server error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
