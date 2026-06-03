import { NextRequest, NextResponse } from "next/server";
import { createRobustServerClient } from "@/lib/robust/supabase-server";
import { createCheckoutSession } from "@/lib/robust/payments";
import { getGymBySlug } from "@/lib/robust/member";
import { STRIPE_PRICE_IDS } from "@/lib/robust/types";
import { z } from "zod";

const bodySchema = z.object({
  gymSlug: z.string().min(1).max(50),
  planKey: z.enum(["fulltime_male", "fulltime_female", "twice_male", "twice_kids", "drop_in"]),
  setupFee: z.number().int().min(0).max(50000),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  sportsHistory: z.string().max(500).optional(),
  isMinor: z.boolean().optional(),
  guardianName: z.string().max(50).optional(),
  guardianContact: z.string().max(100).optional(),
  includeInsurance: z.boolean().optional(),
  familyDiscount: z.boolean().optional(),
  monthlyAmount: z.number().int().min(0).max(100000),
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
  const { gymSlug, planKey, setupFee, phone, address, sportsHistory, isMinor, guardianName, guardianContact, includeInsurance, familyDiscount, monthlyAmount } = parsed.data;

  const gym = await getGymBySlug(gymSlug);
  if (!gym) {
    return NextResponse.json({ error: "ジムが見つかりません" }, { status: 404 });
  }

  const priceId = STRIPE_PRICE_IDS[planKey];
  if (!priceId) {
    // Why: Stripe Price ID が未設定（空文字）は「無効なプラン」ではなく「決済未設定」
    return NextResponse.json({ error: "現在オンライン決済の準備中です。直接ご連絡ください。" }, { status: 503 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const checkoutUrl = await createCheckoutSession({
    userId: user.id,
    email: user.email!,
    gymSlug,
    priceId,
    origin,
    setupFeeAmount: setupFee,
    phone,
    address,
    sportsHistory,
    isMinor: isMinor ?? false,
    guardianName,
    guardianContact,
    includeInsurance: includeInsurance ?? false,
    familyDiscount: familyDiscount ?? false,
    monthlyAmount: monthlyAmount,
  });

  return NextResponse.json({ url: checkoutUrl });
}
