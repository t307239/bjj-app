import Stripe from "stripe";
import { createRobustAdminClient } from "@/lib/robust/supabase";

export async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;

  const supabase = createRobustAdminClient();

  // 支払い失敗フラグを立てる（管理者ダッシュボードで表示）
  await supabase
    .from("gym_members")
    .update({ status: "paused" })
    .eq("stripe_customer_id", customerId)
    .eq("status", "active");
}
