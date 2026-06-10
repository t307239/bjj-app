import { NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAuth } from "@/lib/robust/auth";
import { getStripe, getRobustPortalConfigId } from "@/lib/robust/payments";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// auth: public — 本人のみ
export async function GET() {
  const auth = await requireRobustAuth();
  if (!auth.ok) return auth.response;

  const admin = createRobustAdminClient();
  const { data: member } = await admin
    .from("gym_members")
    .select("stripe_customer_id")
    .eq("user_id", auth.userId)
    .eq("gym_id", GYM_ID)
    .maybeSingle();

  if (!member?.stripe_customer_id) {
    return NextResponse.json({ error: "Stripe 顧客情報が見つかりません" }, { status: 404 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";
  // カード変更のみ許可する ROBUST 専用ポータル設定を適用（自己解約は不可）
  const configuration = await getRobustPortalConfigId();
  const session = await getStripe().billingPortal.sessions.create({
    customer: member.stripe_customer_id,
    return_url: `${origin}/gym/robust/member/profile`,
    configuration,
  });

  return NextResponse.json({ url: session.url });
}
