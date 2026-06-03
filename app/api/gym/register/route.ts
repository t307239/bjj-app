import { NextRequest, NextResponse } from "next/server";
import { createRobustServerClient } from "@/lib/robust/supabase-server";
import { createCheckoutSession } from "@/lib/robust/payments";
import { getGymBySlug } from "@/lib/robust/member";
import { STRIPE_PRICE_IDS, PLAN_MONTHLY_AMOUNTS, PLAN_SETUP_FEES } from "@/lib/robust/types";
import { z } from "zod";

const bodySchema = z.object({
  gymSlug: z.string().min(1).max(50),
  planKey: z.enum(["fulltime_male", "fulltime_female", "twice_male", "twice_kids", "drop_in"]),
  // setupFee はクライアント送信値を使わない（PLAN_SETUP_FEES で確定）
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  sportsHistory: z.string().max(500).optional(),
  isMinor: z.boolean().optional(),
  guardianName: z.string().max(50).optional(),
  guardianContact: z.string().max(100).optional(),
  agreedToTerms: z.boolean().optional(),
  includeInsurance: z.boolean().optional(),
  familyDiscount: z.boolean().optional(),
  familyMemberName: z.string().max(50).optional(),
  // monthlyAmount はクライアント送信値を使わない（改ざん防止）
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
  const { gymSlug, planKey, phone, address, sportsHistory, isMinor, guardianName, guardianContact, includeInsurance, familyDiscount, familyMemberName, agreedToTerms } = parsed.data;

  // Why: monthlyAmount/setupFee はクライアント値を使わず planKey から確定（改ざん防止）
  const monthlyAmount = PLAN_MONTHLY_AMOUNTS[planKey] ?? 0;
  const setupFee = PLAN_SETUP_FEES[planKey] ?? 0;

  // サーバー側バリデーション（フロントの disabled バイパス対策）
  if (!agreedToTerms) {
    return NextResponse.json({ error: "利用規約への同意が必要です" }, { status: 400 });
  }
  if (isMinor && (!guardianName || !guardianContact)) {
    return NextResponse.json({ error: "18歳未満の場合は保護者情報が必要です" }, { status: 400 });
  }

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
    familyMemberName,
    monthlyAmount: monthlyAmount,
    planKeyLogical: planKey, // 論理キーをメタデータに渡す（webhook plan_type判定用）
  });

  return NextResponse.json({ url: checkoutUrl });
}
