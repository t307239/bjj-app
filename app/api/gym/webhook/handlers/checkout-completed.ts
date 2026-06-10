import Stripe from "stripe";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { getGymBySlug } from "@/lib/robust/member";
import { robustLogger } from "@/lib/robust/logger";

export async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // client_reference_id = Supabase Auth の user_id
  const userId = session.client_reference_id;
  if (!userId) throw new Error("client_reference_id が未設定");

  // Why: success_url は checkout 作成時の origin ヘッダ(改ざん可能)から構築されるため
  //      正規表現パースに頼らず信頼できる metadata.gymSlug を一次情報として使用する。
  const gymSlug = session.metadata?.gymSlug;
  if (!gymSlug) throw new Error("metadata.gymSlug が未設定");

  const gym = await getGymBySlug(gymSlug);
  if (!gym) throw new Error(`ジムが見つかりません: ${gymSlug}`);

  const supabase = createRobustAdminClient();

  // 既存会員チェック
  // Why: drop_in は毎回新しい checkout を作るが gym_members.user_id は UNIQUE。
  //      2回目以降の drop_in は既存レコードが返る → 冪等スキップ。
  //      drop_in 会員は永続的に "active" 状態で QR を保持し、来館のたびにチェックイン。
  //      1回ごとの課金記録は Stripe の Payment 履歴で管理する（DB には残さない設計）。
  //      将来的に attendance ベースの1回券管理が必要になった場合は別テーブルで対応。
  const { data: existing } = await supabase
    .from("gym_members")
    .select("id, plan_type")
    .eq("user_id", userId)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (existing) {
    // 課金済みだが既にレコードあり（再送/二度押し）→ 正常スキップ。可視化して照合可能に。
    robustLogger.warn("robust.checkout.duplicate_skip", {
      userId,
      sessionId: session.id,
      customer: String(session.customer ?? ""),
    });
    return;
  }

  // Stripe Customer からメール取得
  const email = session.customer_email ?? session.customer_details?.email ?? "";

  // plan_type を metadata.planKey（論理キー）から確定
  // Why: "twice_male"/"twice_kids" → twice_weekly, "drop_in" → drop_in, それ以外 → fulltime
  const planKey = session.metadata?.planKey ?? "";
  const planType: "fulltime" | "twice_weekly" | "drop_in" =
    planKey === "twice_male" || planKey === "twice_kids" ? "twice_weekly"
    : planKey === "drop_in" ? "drop_in"
    : "fulltime";

  // Why: webhook_events の排他制御後もごく稀に同時実行が起こりうる。
  //      gym_members の user_id UNIQUE 制約を活かして INSERT onConflict doNothing で冪等化。
  const { error: memberInsertError } = await supabase.from("gym_members").insert({
    gym_id: gym.id,
    user_id: userId,
    email,
    name: session.customer_details?.name ?? "",
    // メタデータからプロフィール情報を復元
    name_kana: session.metadata?.name_kana || null,
    birth_date: session.metadata?.birth_date || null,
    phone: session.metadata?.phone || null,
    address: session.metadata?.address || null,
    sports_history: session.metadata?.sports_history || null,
    emergency_contact_name: session.metadata?.emergency_contact_name || null,
    emergency_contact_phone: session.metadata?.emergency_contact_phone || null,
    emergency_contact_relation: session.metadata?.emergency_contact_relation || null,
    medical_notes: session.metadata?.medical_notes || null,
    is_minor: session.metadata?.is_minor === "true",
    guardian_consent: session.metadata?.is_minor === "true",
    guardian_name: session.metadata?.guardian_name || null,
    guardian_contact: session.metadata?.guardian_contact || null,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string | null,
    payment_method: "stripe",
    qr_token: crypto.randomUUID(),
    plan_type: planType,
    plan_cap: planType === "twice_weekly" ? gym.plan_cap : null,
    status: "active",
    video_access: false,
    family_discount: session.metadata?.family_discount === "true",
    family_member_name: session.metadata?.family_member_name || null,
    // 保険有効期限: 加入した場合のみ記録（4月1日〜翌3月31日の年度管理）
    // Why: 記録がないと翌年度の重複加入防止・保険有効期限確認ができない
    insurance_expires_at: session.metadata?.include_insurance === "true"
      ? getInsuranceExpiry()
      : null,
  });

  // user_id UNIQUE 違反 = 別リクエストが先に INSERT 済み → 正常（冪等）
  if (memberInsertError && memberInsertError.code !== "23505") {
    // 課金済みなのに会員レコード作成に失敗 = 要手動照合の重大イベント
    robustLogger.error("robust.checkout.member_insert_failed", {
      userId,
      sessionId: session.id,
      customer: String(session.customer ?? ""),
      planType,
    }, memberInsertError);
    throw memberInsertError;
  }

  // 課金成功 → 会員作成完了。決済とレコードの突合を可能にする（最終失敗の検知用）
  robustLogger.info("robust.checkout.member_created", {
    userId,
    sessionId: session.id,
    customer: String(session.customer ?? ""),
    planType,
  });
}

/** スポーツ保険有効期限: 加入月が4月以降なら当年度末(翌3/31)、3月以前なら当年3/31 */
function getInsuranceExpiry(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year + 1}-03-31`;
}

