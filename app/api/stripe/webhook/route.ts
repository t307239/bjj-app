import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import { buildTrialReminderEmail, type Locale } from "@/lib/trialReminderEmail";
import { canSendEmail, recordEmailSent } from "@/lib/emailRateLimit";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@bjj-app.net";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bjj-app.net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const stripe = new Stripe(serverEnv.stripeSecretKey());
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      serverEnv.stripeWebhookSecret()
    );
  } catch (err) {
    logger.error("stripe.webhook.sig_failed", { message: (err as Error).message });
    return new Response("Webhook signature verification failed", {
      status: 400,
    });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.supabaseServiceRoleKey()
  );

  // z172: Idempotency check — Stripe may deliver the same event multiple
  // times (https://stripe.com/docs/webhooks#best-practices). The
  // stripe_webhook_events table has a PRIMARY KEY on event_id, so a
  // duplicate insert fails with PostgreSQL code 23505 (unique_violation).
  // We treat that as "already processed" and return 200 immediately.
  const { error: insertError } = await supabase
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
    });

  if (insertError) {
    // 23505 = unique_violation = duplicate event = idempotent skip.
    if (insertError.code === "23505") {
      logger.info("stripe.webhook.duplicate_event_skipped", {
        eventId: event.id,
        eventType: event.type,
      });
      return new Response("ok (duplicate)", { status: 200 });
    }
    // Other DB errors are unexpected — log but proceed (don't block legitimate
    // webhook processing on a transient idempotency-table issue).
    logger.error(
      "stripe.webhook.idempotency_insert_failed",
      { eventId: event.id, code: insertError.code },
      insertError as Error,
    );
  }

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

        // z192: Retrieve subscription metadata.ref for paid attribution
        // (z181 で checkout 時に subscription_data.metadata.ref を渡してるので
        // subscription object に保存されてる)
        let paidRef: string | null = null;
        if (session.subscription) {
          try {
            const subscriptionId = typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            paidRef = sub.metadata?.ref ?? null;
          } catch (err) {
            logger.warn("stripe.webhook.subscription_retrieve_failed", {
              sessionId: session.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

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
            // z192: paid attribution (only set on first conversion via paid_at IS NULL)
            await supabase
              .from("profiles")
              .update({
                is_pro: true,
                stripe_customer_id: customerId,
                paid_ref: paidRef ?? "direct",
                paid_at: new Date().toISOString(),
                paid_plan: "b2b_gym",
              })
              .eq("id", userId)
              .is("paid_at", null);
            // separately ensure is_pro/customer_id always synced (even on re-conversion)
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
            // z192: paid attribution (first-conversion only)
            await supabase
              .from("profiles")
              .update({
                is_pro: true,
                stripe_customer_id: customerId,
                paid_ref: paidRef ?? "direct",
                paid_at: new Date().toISOString(),
                paid_plan: "b2c_pro",
              })
              .eq("id", userId)
              .is("paid_at", null);
            // separately keep is_pro/customer_id synced on re-conversion
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
              logger.info("stripe.webhook.b2c_upgraded", { userId, customerId, paidRef });
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

            // z172: resolve owner profile explicitly. If the profile lookup
            // fails (deleted user, customer ID drift), skip the gym update
            // rather than building an invalid SQL query with `?? ""`.
            const { data: ownerProfile } = await supabase
              .from("profiles")
              .select("id")
              .eq("stripe_customer_id", customerId)
              .single();
            if (ownerProfile?.id) {
              await supabase
                .from("gyms")
                .update({ is_active: false })
                .eq("owner_id", ownerProfile.id);
            } else {
              logger.warn("stripe.webhook.b2b_cancelled_no_owner_profile", { customerId });
            }

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

      case "customer.subscription.trial_will_end": {
        // z194 (F-3): Stripe fires 3 days before trial_end_date.
        // Send reminder email so user can decide to continue or cancel.
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : (subscription.customer as Stripe.Customer | null)?.id ?? null;
        if (!customerId) {
          logger.warn("stripe.webhook.trial_will_end_no_customer", { subId: subscription.id });
          break;
        }
        if (!RESEND_API_KEY) {
          logger.warn("stripe.webhook.trial_will_end_no_resend_key");
          break;
        }
        // Look up user
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, locale, email_marketing_opted_out")
          .eq("stripe_customer_id", customerId)
          .single();
        if (!profile) {
          logger.warn("stripe.webhook.trial_will_end_no_profile", { customerId });
          break;
        }
        // Get email
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id);
        if (!authUser?.email) {
          logger.warn("stripe.webhook.trial_will_end_no_email", { userId: profile.id });
          break;
        }
        // z189: 24h frequency cap (cross-cron)
        const allowed = await canSendEmail(supabase, profile.id, "trial_will_end");
        if (!allowed) {
          logger.info("stripe.webhook.trial_will_end_skipped_rate_limit", { userId: profile.id });
          break;
        }
        // Build Stripe Customer Portal URL via existing /stripe/portal endpoint helper
        // (For now, link to /pricing — user can resubscribe / cancel via /api/stripe/portal)
        const manageUrl = `${APP_URL}/pricing?from=trial_reminder`;
        const trialEndDate = subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : new Date(Date.now() + 3 * 86400000);
        const locale: Locale = (profile.locale as Locale) ?? "en";
        const { subject, html } = buildTrialReminderEmail({
          userId: profile.id,
          email: authUser.email,
          locale,
          trialEndDate,
          manageUrl,
        });
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: authUser.email,
              subject,
              html,
              tags: [
                { name: "type", value: "trial_will_end" },
                { name: "subscription_id", value: subscription.id },
              ],
            }),
          });
          if (!res.ok) {
            logger.error(
              "stripe.webhook.trial_will_end_send_failed",
              { userId: profile.id, statusCode: res.status },
              new Error(`Resend HTTP ${res.status}`),
            );
            break;
          }
          await recordEmailSent(supabase, profile.id, "trial_will_end", authUser.email, {
            subscriptionId: subscription.id,
          });
          logger.info("stripe.webhook.trial_will_end_sent", {
            userId: profile.id,
            customerId,
            trialEnd: trialEndDate.toISOString(),
          });
        } catch (err) {
          logger.error(
            "stripe.webhook.trial_will_end_threw",
            { userId: profile.id },
            err instanceof Error ? err : new Error(String(err)),
          );
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

    revalidatePath("/dashboard");
    revalidatePath("/gym/dashboard");
  } catch (err) {
    logger.error("stripe.webhook.processing_error", { eventType: event.type }, err as Error);
    return new Response("Internal server error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
