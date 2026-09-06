import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustManager } from "@/lib/robust/auth";
import { getStripe } from "@/lib/robust/payments";
import { STRIPE_PRICE_IDS } from "@/lib/robust/types";
import { getGymBySlug } from "@/lib/robust/member";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";
const GYM_SLUG = process.env.NEXT_PUBLIC_ROBUST_GYM_SLUG ?? "robust";

/**
 * カード登録リンク発行（オーナー・管理者のみ）。
 * Why: 口座振替など非カード会員を、後からカード払いに切り替えるためのリンクを発行する。
 *      料金は男女・キッズで異なり、会員データからは正確に復元できないため、オーナーが
 *      planKey を明示選択して発行する（誤課金防止）。会員がリンクでカードを登録すると
 *      翌月1日からカード課金が始まる（即時課金なし）。カード情報はオーナー/アプリは触らない。
 */
const bodySchema = z.object({
  memberId: z.string().uuid(),
  planKey: z.enum(["fulltime_male", "fulltime_female", "twice_male", "twice_kids", "drop_in"]),
});

// JSTの「翌月1日 00:00」の unix 秒。サブスクの課金開始アンカー（今は課金しない）。
function nextMonthFirstUnixJst(): number {
  const now = new Date();
  const y = Number(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo", year: "numeric" }));
  const m = Number(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }));
  let ny = y;
  let nm = m + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  return Math.floor(new Date(`${ny}-${String(nm).padStart(2, "0")}-01T00:00:00+09:00`).getTime() / 1000);
}

export async function POST(req: NextRequest) {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }
  const { memberId, planKey } = parsed.data;

  const priceId = STRIPE_PRICE_IDS[planKey];
  if (!priceId) {
    return NextResponse.json({ error: "この料金プランのStripe価格が未設定です" }, { status: 503 });
  }

  const admin = createRobustAdminClient();
  const { data: member } = await admin
    .from("gym_members")
    .select("id, user_id, email, status, stripe_customer_id, family_discount")
    .eq("id", memberId)
    .eq("gym_id", GYM_ID)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "会員が見つかりません" }, { status: 404 });
  }
  if (member.stripe_customer_id) {
    return NextResponse.json({ error: "この会員は既にカード登録済みです" }, { status: 409 });
  }

  const gym = await getGymBySlug(GYM_SLUG);
  if (!gym) return NextResponse.json({ error: "ジムが見つかりません" }, { status: 404 });

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // 家族割引: この会員が家族割引適用中ならカード切替後も割引を継続する。
  // Why: 登録フローと同じ forever クーポンを毎月請求に当てないと、切替を機に -¥2,000 が消える。
  const familyCouponId = process.env.ROBUST_STRIPE_COUPON_FAMILY;
  const discounts = member.family_discount && familyCouponId ? [{ coupon: familyCouponId }] : undefined;

  // Why: billing_cycle_anchor=翌月1日 ＋ proration_behavior=none で、カード登録時は課金せず
  //      翌月1日から定期課金を開始する。入会金・日割り等は付けない（切替なので）。
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    ...(discounts ? { discounts } : {}),
    client_reference_id: member.user_id ?? undefined,
    customer_email: member.email ?? undefined,
    subscription_data: {
      billing_cycle_anchor: nextMonthFirstUnixJst(),
      proration_behavior: "none",
      metadata: { gymSlug: GYM_SLUG, memberId: member.id, mode: "card_setup" },
    },
    // Why: webhook で「カード切替(既存会員の更新)」と「新規入会」を区別するため mode を必ず渡す。
    metadata: { mode: "card_setup", gymSlug: GYM_SLUG, memberId: member.id, planKey },
    success_url: `${origin}/gym/${GYM_SLUG}/member/qr?card=done`,
    cancel_url: `${origin}/gym/${GYM_SLUG}/member/qr?card=cancel`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "リンクの生成に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
