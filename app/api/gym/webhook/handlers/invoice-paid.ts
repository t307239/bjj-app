import Stripe from "stripe";
import { format } from "date-fns";
import { createRobustAdminClient } from "@/lib/robust/supabase";

export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;

  const supabase = createRobustAdminClient();

  const { data: member } = await supabase
    .from("gym_members")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!member) return;

  const billingPeriod = format(
    new Date((invoice.period_start ?? Date.now() / 1000) * 1000),
    "yyyy-MM"
  );

  // 当該期間の未回収チェックインを一括で charged = true に更新
  await supabase
    .from("attendance_logs")
    .update({ charged: true })
    .eq("member_id", member.id)
    .eq("billing_period", billingPeriod)
    .eq("charged", false);
}
