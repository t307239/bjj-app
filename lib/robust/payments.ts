// PaymentsService — Stripe 課金（他から呼ばれる側、循環依存禁止）
import Stripe from "stripe";
import { format } from "date-fns";
import { createRobustAdminClient } from "./supabase";
import type { GymMember } from "./types";

// ROBUST 専用 Stripe インスタンス（bjj-app の Stripe とは別アカウント）
const robustStripe = new Stripe(process.env.ROBUST_STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

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
  const session = await robustStripe.checkout.sessions.create({
    // Supabase Auth の user_id を橋渡し
    client_reference_id: userId,
    customer_email: email,
    mode: "subscription",
    line_items: [
      { price: priceId, quantity: 1 },
    ],
    // 入会金を Invoice Item として追加
    invoice_creation: setupFeeAmount > 0 ? {
      enabled: true,
    } : undefined,
    subscription_data: setupFeeAmount > 0 ? {
      add_invoice_items: [{
        price_data: {
          currency: "jpy",
          product_data: { name: "入会金" },
          unit_amount: setupFeeAmount,
        },
      }],
    } : undefined,
    success_url: `${origin}/gym/${gymSlug}/register/success`,
    cancel_url: `${origin}/gym/${gymSlug}/register`,
    payment_method_types: ["card"],
  });

  return session.url!;
}

export { robustStripe };
