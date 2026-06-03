// PaymentsService — Stripe 課金（他から呼ばれる側、循環依存禁止）
import Stripe from "stripe";
import { format } from "date-fns";
import { createRobustAdminClient } from "./supabase";
import type { GymMember } from "./types";
import { FAMILY_DISCOUNT_YEN, SPORTS_INSURANCE_YEN, SPORTS_INSURANCE_KIDS_YEN } from "./types";

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
  const isDropIn = planKeyLogical === "drop_in";

  // drop_in は単発参加のため日割り・翌月分前払いは不要
  // Why: monthlyAmount=2000 のまま日割り・翌月分を計算すると約¥5,000〜6,000の三重課金になる
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - now.getDate() + 1;
  const discountedMonthly = monthlyAmount - (familyDiscount ? FAMILY_DISCOUNT_YEN : 0);
  // 日割りは Math.round（会員中立な丸め）
  const proratedAmount = Math.round(discountedMonthly * remainingDays / daysInMonth);

  // line_items 構築
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
  ];

  if (!isDropIn) {
    // 月額プランのみ: 入会金・日割り・翌月分を追加
    if (setupFeeAmount > 0) {
      lineItems.push({
        price_data: { currency: "jpy", product_data: { name: "入会金" }, unit_amount: setupFeeAmount },
        quantity: 1,
      });
    }
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
  }

  // スポーツ保険（drop_in でも任意で追加可能）
  if (includeInsurance) {
    const insuranceFee = isMinor ? SPORTS_INSURANCE_KIDS_YEN : SPORTS_INSURANCE_YEN;
    lineItems.push({
      price_data: {
        currency: "jpy",
        product_data: { name: "スポーツ保険（年度分）" },
        unit_amount: insuranceFee,
      },
      quantity: 1,
    });
  }

  const sharedMetadata = {
    gymSlug,
    planKey: planKeyLogical,
    phone: phone ?? "",
    address: address ?? "",
    sports_history: sportsHistory ?? "",
    is_minor: String(isMinor ?? false),
    guardian_name: guardianName ?? "",
    guardian_contact: guardianContact ?? "",
    family_member_name: familyMemberName ?? "",
    family_discount: String(familyDiscount ?? false),
    include_insurance: String(includeInsurance ?? false),
  };

  // Why: drop_in はビジター単発参加（¥2,000/回）。
  //      subscription モードに乗せると毎月課金になるため payment モードで一回払い。
  if (planKeyLogical === "drop_in") {
    const session = await getStripe().checkout.sessions.create({
      client_reference_id: userId,
      customer_email: email,
      mode: "payment",
      line_items: lineItems, // drop_in price_data (one-time) + 保険
      metadata: sharedMetadata,
      success_url: `${origin}/gym/${gymSlug}/register/success`,
      cancel_url: `${origin}/gym/${gymSlug}/register`,
      payment_method_types: ["card"],
    });
    return session.url!;
  }

  // 月額プラン: subscription + 日割り・翌月分・保険を one-time で同時決済
  // billing_cycle_anchor = 翌々月1日（常に未来日・月末当日入会でも安全）
  // Why: 今月（日割り）と翌月分は line_items one-time で別途請求済み。
  //      subscription の定期課金は翌々月1日から開始し、以降毎月1日に課金。
  //      翌々月末ではなく翌々月1日にする理由: Stripe は anchor 日が近すぎると
  //      即時 proration が走る場合があるため、月初で確実に未来になるよう固定。
  const anchorDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const billingAnchor = Math.floor(anchorDate.getTime() / 1000);

  // 家族割引: Stripe coupon を subscription_data に適用（翌々月以降の定期課金にも反映）
  // Why: line_items の one-time 割引は初回のみ。coupon を使えば subscription の毎月請求にも -¥2,000 が永続適用。
  //      ROBUST_STRIPE_COUPON_FAMILY env var に事前作成した Stripe coupon ID を設定すること。
  const familyCouponId = process.env.ROBUST_STRIPE_COUPON_FAMILY;
  const discounts = familyDiscount && familyCouponId
    ? [{ coupon: familyCouponId }]
    : undefined;

  const session = await getStripe().checkout.sessions.create({
    client_reference_id: userId,
    customer_email: email,
    mode: "subscription",
    line_items: lineItems,
    metadata: sharedMetadata,
    subscription_data: {
      billing_cycle_anchor: billingAnchor,
      proration_behavior: "none",
      ...(discounts ? { discounts } : {}),
    },
    success_url: `${origin}/gym/${gymSlug}/register/success`,
    cancel_url: `${origin}/gym/${gymSlug}/register`,
    payment_method_types: ["card"],
  });

  return session.url!;
}

export { getStripe };
