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
  name: z.string().max(50).optional(), // アプリ入力の氏名（会員名の正）。未送信時は webhook が Stripe カード名義にフォールバック
  nameKana: z.string().min(1).max(50),
  // 生年月日は YYYY-MM-DD のみ許可（不正値で DB date 型を壊さない）
  // 必須化（依頼: 登録情報の必須化）。フリガナと合わせ、連絡先・緊急連絡先・生年月日を必須にする。
  // 健康情報・血液型・運動経歴は要配慮個人情報/任意のため optional のまま維持。
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().min(1).max(20),
  address: z.string().min(1).max(200),
  sportsHistory: z.string().max(500).optional(),
  emergencyName: z.string().min(1).max(50),
  emergencyPhone: z.string().min(1).max(20),
  emergencyRelation: z.string().min(1).max(20),
  medicalNotes: z.string().max(500).optional(),
  chronicConditions: z.string().max(200).optional(),
  allergies: z.string().max(200).optional(),
  injuryHistory: z.string().max(200).optional(),
  bloodType: z.enum(["A", "B", "O", "AB"]).optional(),
  isMinor: z.boolean().optional(),
  guardianName: z.string().max(50).optional(),
  guardianContact: z.string().max(100).optional(),
  agreedToTerms: z.boolean().optional(),
  // カード登録をスキップして口座振替(後日)で入会する。Stripeを通さず会員を直接作成する。
  skipPayment: z.boolean().optional(),
  includeInsurance: z.boolean().optional(),
  familyDiscount: z.boolean().optional(),
  familyMemberName: z.string().max(50).optional(),
  simultaneousFamily: z.boolean().optional(), // 同時入会: 相手も今回入会のため自己申告で割引適用
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
  const { gymSlug, planKey, name, nameKana, birthDate, phone, address, sportsHistory, emergencyName, emergencyPhone, emergencyRelation, medicalNotes, chronicConditions, allergies, injuryHistory, bloodType, isMinor, guardianName, guardianContact, includeInsurance, familyDiscount, familyMemberName, simultaneousFamily, agreedToTerms, skipPayment } = parsed.data;

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

  const { createRobustAdminClient } = await import("@/lib/robust/supabase");
  const admin = createRobustAdminClient();

  // 既存会員の二重入会防止（致命的な課金バグの防御）
  // Why: 登録フローは Stripe Checkout で入会金＋日割り＋翌月分を即時請求する。
  //      既に会員レコードがある user が再度この API を叩くと（UI バイパス・二度押し・
  //      カゴ落ち再開等）、checkout が作られ入会金を二重請求してしまう。
  //      webhook 側の重複スキップは「課金後」に効くため救済にならない。
  //      ここで existing レコードを検出したら checkout を作らず 409 で弾く。
  //      退会済み会員の再入会はオーナーが管理画面の「再入会」で行う（再課金なし）。
  const { data: existingMember } = await admin
    .from("gym_members")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("gym_id", gym.id)
    .maybeSingle();
  if (existingMember) {
    return NextResponse.json(
      {
        error: existingMember.status === "cancelled"
          ? "退会済みのため、再入会は道場へお問い合わせください。"
          : "既に会員登録済みです。マイページをご利用ください。",
        alreadyMember: true,
      },
      { status: 409 }
    );
  }

  // 家族割引の事前検証: 同一 gym 内に該当氏名の active 会員が存在するか確認
  // Why: familyDiscount は自己申告のみだと coupon(forever) を無検証で適用できる。
  //      DB に存在する active 会員名と突き合わせて申請の妥当性を検証する。
  //      氏名表記ゆれ（"柔術太郎" vs "柔術 太郎"）は trim+normalize で緩和。
  let verifiedFamilyDiscount = false;
  if (familyDiscount && familyMemberName?.trim()) {
    const normalizedInput = familyMemberName.trim().replace(/\s+/g, "");
    const { data: members } = await admin
      .from("gym_members")
      .select("name")
      .eq("gym_id", gym.id)
      .eq("status", "active");

    verifiedFamilyDiscount = (members ?? []).some(
      m => m.name.replace(/\s+/g, "") === normalizedInput
    );

    if (!verifiedFamilyDiscount) {
      // 割引申請は記録するが coupon は適用しない（admin が後日確認して手動調整可能）
      // → familyDiscount=true でメタデータに保存、coupon は false として処理
    }
  }

  // 同時入会の自己申告: 相手も今回入会のため DB に未登録 → 照合できない。
  // Why: 一人目が登録時に照合相手が居らず割引漏れする非対称を、自己申告で初月から
  //      coupon 適用して解消する。悪用時はオーナーが管理画面の「家族割引を解除」で取消可能。
  //      氏名未入力での誤適用を防ぐため familyMemberName 必須。
  const applyCoupon =
    verifiedFamilyDiscount || (simultaneousFamily === true && !!familyMemberName?.trim());

  // 論理プランキー → DBの plan_type
  const planType: "fulltime" | "twice_weekly" | "drop_in" =
    planKey === "twice_male" || planKey === "twice_kids" ? "twice_weekly"
    : planKey === "drop_in" ? "drop_in"
    : "fulltime";

  // ── カード登録スキップ（口座振替で後日）: Stripeを通さず会員を直接作成 ──
  // Why: 口座振替など現地払いの会員を、自己登録でもカード無しで作れるようにする。
  //      入会金・保険料はジム側で後日徴収。カードは後からオーナー発行のリンクで登録可能。
  if (skipPayment) {
    const { error: insErr } = await admin.from("gym_members").insert({
      gym_id: gym.id,
      user_id: user.id,
      email: user.email!,
      name: name ?? "",
      name_kana: nameKana,
      birth_date: birthDate,
      phone,
      address,
      sports_history: sportsHistory ?? null,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      emergency_contact_relation: emergencyRelation,
      medical_notes: medicalNotes ?? null,
      chronic_conditions: chronicConditions ?? null,
      allergies: allergies ?? null,
      injury_history: injuryHistory ?? null,
      blood_type: bloodType ?? null,
      is_minor: isMinor ?? false,
      guardian_consent: isMinor ?? false,
      guardian_name: guardianName ?? null,
      guardian_contact: guardianContact ?? null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      payment_method: "bank", // 口座振替（現地/後日徴収）
      qr_token: crypto.randomUUID(),
      plan_type: planType,
      plan_cap: planType === "twice_weekly" ? gym.plan_cap : null,
      status: "active",
      video_access: false,
      family_discount: applyCoupon,
      family_member_name: familyMemberName ?? null,
      insurance_expires_at: (includeInsurance ?? false) ? getInsuranceExpiry() : null,
    });
    if (insErr) {
      // user_id UNIQUE 違反 = 既に会員（二度押し等）→ 正常扱い
      if (insErr.code === "23505") {
        return NextResponse.json({ error: "既に会員登録済みです。", alreadyMember: true }, { status: 409 });
      }
      return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ skipped: true });
  }

  const priceId = STRIPE_PRICE_IDS[planKey];
  if (!priceId) {
    // Why: Stripe Price ID が未設定（空文字）は「無効なプラン」ではなく「決済未設定」
    return NextResponse.json({ error: "現在オンライン決済の準備中です。直接ご連絡ください。" }, { status: 503 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const checkoutUrl = await createCheckoutSession({
    name,
    userId: user.id,
    email: user.email!,
    gymSlug,
    priceId,
    origin,
    setupFeeAmount: setupFee,
    nameKana,
    birthDate,
    phone,
    address,
    sportsHistory,
    emergencyName,
    emergencyPhone,
    emergencyRelation,
    medicalNotes,
    chronicConditions,
    allergies,
    injuryHistory,
    bloodType,
    isMinor: isMinor ?? false,
    guardianName,
    guardianContact,
    includeInsurance: includeInsurance ?? false,
    familyDiscount: applyCoupon,               // DB検証済み or 同時入会の自己申告で coupon 適用
    familyMemberName,                          // 申請氏名は常に保存（admin確認用）
    monthlyAmount: monthlyAmount,
    planKeyLogical: planKey, // 論理キーをメタデータに渡す（webhook plan_type判定用）
  });

  return NextResponse.json({ url: checkoutUrl });
}

/** スポーツ保険有効期限: 加入月が4月以降なら翌3/31、3月以前なら当年3/31（webhookと同一ロジック） */
function getInsuranceExpiry(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year + 1}-03-31`;
}
