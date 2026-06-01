import { NextRequest, NextResponse } from "next/server";
import { createRobustServerClient } from "@/lib/robust/supabase";
import { createCheckoutSession } from "@/lib/robust/payments";
import { getGymBySlug } from "@/lib/robust/member";
import { STRIPE_PRICE_IDS } from "@/lib/robust/types";
import { z } from "zod";

const bodySchema = z.object({
  gymSlug: z.string().min(1).max(50),
  planKey: z.enum(["fulltime_male", "fulltime_female", "twice_male", "twice_kids", "drop_in"]),
  setupFee: z.number().int().min(0).max(50000),
});

// auth: public — Supabase Auth で認証確認済みのユーザーのみ
export async function POST(req: NextRequest) {
  const supabase = await createRobustServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }
  const { gymSlug, planKey, setupFee } = parsed.data;

  const gym = await getGymBySlug(gymSlug);
  if (!gym) {
    return NextResponse.json({ error: "ジムが見つかりません" }, { status: 404 });
  }

  const priceId = STRIPE_PRICE_IDS[planKey];
  if (!priceId) {
    return NextResponse.json({ error: "無効なプランです" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const checkoutUrl = await createCheckoutSession({
    userId: user.id,
    email: user.email!,
    gymSlug,
    priceId,
    origin,
    setupFeeAmount: setupFee,
  });

  return NextResponse.json({ url: checkoutUrl });
}
