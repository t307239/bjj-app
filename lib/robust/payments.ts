// PaymentsService — Stripe 課金（他から呼ばれる側、循環依存禁止）
import Stripe from "stripe";
import { format } from "date-fns";
import { createRobustAdminClient } from "./supabase";
import type { GymMember } from "./types";

// ROBUST 専用 Stripe インスタンス（bjj-app の Stripe とは別アカウント）
const robustStripe = new Stripe(process.env.ROBUST_STRIPE_SECRET_KEY!);

/** 超過課金: PaymentIntents 都度ではなく Invoice Items に積む（翌月合算） */
export async function addOverageToNextInvoice(
  member: GymMember,
  gymId: string
): Promise<void> {
  if (!member.stripe_customer_id) return;

  const supabase = createRobustAdminClient();
  const { data: gym } = await supabase
    .from("gyms")
    .select("overage_yen")
    .eq("id", gymId)
    .single();

  const overageYen = gym?.overage_yen ?? 1000;
  const period = format(new Date(), "yyyy年MM月");

  await robustStripe.invoiceItems.create({
    customer: member.stripe_customer_id,
    amount: overageYen,
    currency: "jpy",
    description: `超過チェックイン 1回分 (${period})`,
    subscription: member.stripe_subscription_id ?? undefined,
  });
}

/** Stripe Checkout Session 作成（登録フロー用） */
export async function createCheckoutSession({
  userId,
  email,
  gymSlug,
  priceId,
  origin,
  setupFeeAmount,
}: {
  userId: string;
  email: string;
  gymSlug: string;
  priceId: string;
  origin: string;
  setupFeeAmount: number; // 入会金（円）
}): Promise<string> {
  // 入会金は line_items に one_time price_data として追加
  // Why: subscription_data.add_invoice_items は Stripe v17 では非対応。
  //      subscription mode では recurring + one_time を line_items に混在可能。
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
  ];
  if (setupFeeAmount > 0) {
    lineItems.push({
      price_data: {
        currency: "jpy",
        product_data: { name: "入会金" },
        unit_amount: setupFeeAmount,
        // recurring なし = one_time
      },
      quantity: 1,
    });
  }

  const session = await robustStripe.checkout.sessions.create({
    client_reference_id: userId,
    customer_email: email,
    mode: "subscription",
    line_items: lineItems,
    metadata: { gymSlug, planKey: priceId },
    success_url: `${origin}/gym/${gymSlug}/register/success`,
    cancel_url: `${origin}/gym/${gymSlug}/register`,
    payment_method_types: ["card"],
  });

  return session.url!;
}

export { robustStripe };
