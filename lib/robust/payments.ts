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
  monthlyAmount,
  phone,
  address,
  sportsHistory,
  isMinor,
  guardianName,
  guardianContact,
  includeInsurance,
  familyDiscount,
  familyMemberName,
  planKeyLogical,
}: {
  userId: string;
  email: string;
  gymSlug: string;
  priceId: string;
  origin: string;
  setupFeeAmount: number;
  monthlyAmount: number;
  phone?: string;
  address?: string;
  sportsHistory?: string;
  isMinor?: boolean;
  guardianName?: string;
  guardianContact?: string;
  includeInsurance?: boolean;
  familyDiscount?: boolean;
  familyMemberName?: string;
  planKeyLogical: string; // "fulltime_male" | "fulltime_female" | "twice_male" | "twice_kids" | "drop_in"
}): Promise<string> {
  // 課金モデル: 入会金 + 日割り（当月）+ 翌月分満額（前払い）+ 保険（任意）
  // Why: HP 記載「入会金とコース代金の翌月分をご用意ください」に準拠。
  //      日割りで当月の利用分を精算しつつ、翌月分を前払いで確保する。
  //      subscription 自体は翌々月末から開始（proration: "none"）。

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - now.getDate() + 1;

  // 家族割引適用後の月額
  const discountedMonthly = monthlyAmount - (familyDiscount ? 2000 : 0);

  // 日割り計算（切り上げ）
  const proratedAmount = Math.ceil(discountedMonthly * remainingDays / daysInMonth);

  // line_items: 入会金・日割り・翌月分・保険をすべて one-time で明示
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    // subscription（翌々月末から開始）
    { price: priceId, quantity: 1 },
  ];

  // 入会金
  if (setupFeeAmount > 0) {
    lineItems.push({
      price_data: { currency: "jpy", product_data: { name: "入会金" }, unit_amount: setupFeeAmount },
      quantity: 1,
    });
  }

  // 日割り（当月）
  if (proratedAmount > 0) {
    lineItems.push({
      price_data: {
        currency: "jpy",
        product_data: { name: `日割り（${remainingDays}日分）` },
        unit_amount: proratedAmount,
      },
      quantity: 1,
    });
  }

  // 翌月分満額（前払い）
  if (discountedMonthly > 0) {
    lineItems.push({
      price_data: {
        currency: "jpy",
        product_data: { name: "翌月分（前払い）" },
        unit_amount: discountedMonthly,
      },
      quantity: 1,
    });
  }

  // スポーツ保険（任意選択）
  if (includeInsurance) {
    const insuranceFee = isMinor ? 950 : 2150;
    lineItems.push({
      price_data: {
        currency: "jpy",
        product_data: { name: "スポーツ保険（年度分）" },
        unit_amount: insuranceFee,
      },
      quantity: 1,
    });
  }

  // subscription の定期課金は翌々月末から開始（日割り・翌月分は one-time で別途支払い済み）
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const billingAnchor = Math.floor(nextMonthEnd.getTime() / 1000);

  const session = await getStripe().checkout.sessions.create({
    client_reference_id: userId,
    customer_email: email,
    mode: "subscription",
    line_items: lineItems,
    metadata: {
      gymSlug,
      planKey: planKeyLogical, // Why: priceId(Stripe ID)ではなく論理キー("twice_male"等)を保存。webhook で plan_type を判定するために必要。
      // プロフィール情報をメタデータに保存（webhook で gym_members に書き込む）
      phone: phone ?? "",
      address: address ?? "",
      sports_history: sportsHistory ?? "",
      is_minor: String(isMinor ?? false),
      guardian_name: guardianName ?? "",
      guardian_contact: guardianContact ?? "",
      family_member_name: familyMemberName ?? "",
      family_discount: String(familyDiscount ?? false),
    },
    subscription_data: {
      // Why: 日割り・翌月分は line_items の one-time で手動処理済み。
      //      subscription 自体は翌々月末からフル課金開始。proration 不要。
      billing_cycle_anchor: billingAnchor,
      proration_behavior: "none",
    },
    success_url: `${origin}/gym/${gymSlug}/register/success`,
    cancel_url: `${origin}/gym/${gymSlug}/register`,
    payment_method_types: ["card"],
  });

  return session.url!;
}

export { getStripe };
