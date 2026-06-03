import Stripe from "stripe";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { getStripe } from "@/lib/robust/payments";

export async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;
  const supabase = createRobustAdminClient();

  // Why: Stripe は失敗後に Smart Retries で数日〜2週間リトライする（past_due）。
  //      1回目の失敗で即締め出すと回復可能な会員をドアで拒否することになる。
  //      subscription.status が "unpaid"（最終失敗確定）になった場合のみ paused に。
  //      それ以外（past_due=リトライ中）は status は変えずにチェックイン可能を維持。
  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription : null;
  let isUnpaid = false;

  if (subscriptionId) {
    try {
      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
      isUnpaid = sub.status === "unpaid" || sub.status === "canceled";
    } catch {
      // silent: ok — Stripe 取得失敗時は安全側（paused しない）でリトライ待ち
    }
  }

  if (isUnpaid) {
    await supabase
      .from("gym_members")
      .update({ status: "paused" })
      .eq("stripe_customer_id", customerId)
      .eq("status", "active");
  }
  // past_due（リトライ中）は DB を変更しない → 管理者への通知は Stripe Dashboard メールで対応
}
