import Stripe from "stripe";
import { createRobustAdminClient } from "@/lib/robust/supabase";

export async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  const supabase = createRobustAdminClient();

  await supabase
    .from("gym_members")
    .update({ status: "cancelled", stripe_subscription_id: null })
    .eq("stripe_customer_id", customerId);
}
