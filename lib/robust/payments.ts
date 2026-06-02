// PaymentsService — Stripe 課金（他から呼ばれる側、循環依存禁止）
import Stripe from "stripe";
import { format } from "date-fns";
import { createRobustAdminClient } from "./supabase";
import type { GymMember } from "./types";

// Why: モジュールレベルで new Stripe(undefined) を呼ぶと
//      ROBUST_STRIPE_SECRET_KEY 未設定の Vercel build 環境でクラッシュする。
//      遅延初期化パターンで関数呼び出し時にのみインスタンスを生成する。
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.ROBUST_STRIPE_SECRET_KEY;
    if (!key) throw new Error("ROBUST_STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

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

  await getStripe().invoiceItems.create({
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
  phone,
  address,
  sportsHistory,
}: {
  userId: string;
  email: string;
  gymSlug: string;
  priceId: string;
  origin: string;
  setupFeeAmount: number;
  phone?: string;
  address?: string;
  sportsHistory?: string;
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

  // A案: billing_cycle_anchor で月末統一 + 日割り自動計算
  // Why: 入会日が異なっても毎月同じ日に請求を統一する（オーナー運用の簡略化）。
  //      月末 = 各月の最終日に固定。proration_behavior で月中入会の日割りを Stripe が自動算出。
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const billingAnchor = Math.floor(lastDayOfMonth.getTime() / 1000);

  const session = await getStripe().checkout.sessions.create({
    client_reference_id: userId,
    customer_email: email,
    mode: "subscription",
    line_items: lineItems,
    metadata: {
      gymSlug,
      planKey: priceId,
      // プロフィール情報をメタデータに保存（webhook で gym_members に書き込む）
      phone: phone ?? "",
      address: address ?? "",
      sports_history: sportsHistory ?? "",
    },
    subscription_data: {
      billing_cycle_anchor: billingAnchor,
      proration_behavior: "create_prorations",
    },
    success_url: `${origin}/gym/${gymSlug}/register/success`,
    cancel_url: `${origin}/gym/${gymSlug}/register`,
    payment_method_types: ["card"],
  });

  return session.url!;
}

export { getStripe };
