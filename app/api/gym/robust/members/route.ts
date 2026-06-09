import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustManager } from "@/lib/robust/auth";
import { getStripe } from "@/lib/robust/payments";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// auth: public — is_gym_staff_or_owner RLS で保護
export async function GET() {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  const admin = createRobustAdminClient();
  const { data: members, error } = await admin
    .from("gym_members")
    .select("id, name, email, phone, address, sports_history, video_access, family_discount, family_member_name, plan_type, plan_cap, status, payment_method, insurance_expires_at, is_minor, created_at")
    .eq("gym_id", GYM_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = members ?? [];

  // Why: A→B、B→A と互いに家族割引を申請すると両者が -¥2,000 を二重に受けられる。
  //      同一の family_member_name を複数会員が申請しているケースを検出し admin に警告。
  //      承認前(family_discount=false)の申請も対象にするため、氏名入力の有無で判定する。
  const familyNameCount: Record<string, number> = {};
  for (const m of list) {
    if (m.family_member_name) {
      const key = m.family_member_name.trim();
      familyNameCount[key] = (familyNameCount[key] ?? 0) + 1;
    }
  }
  const duplicateFamilyNames = new Set(
    Object.entries(familyNameCount).filter(([, c]) => c > 1).map(([k]) => k)
  );

  const membersWithWarning = list.map(m => ({
    ...m,
    family_discount_warning: m.family_member_name
      ? duplicateFamilyNames.has(m.family_member_name.trim())
      : false,
  }));

  return NextResponse.json({ members: membersWithWarning });
}

const updateSchema = z.object({
  memberId: z.string().uuid(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  plan_type: z.enum(["fulltime", "twice_weekly", "drop_in"]).optional(),
  plan_cap: z.number().int().min(1).max(99).nullable().optional(),
  video_access: z.boolean().optional(),
  family_discount_approved: z.boolean().optional(), // 家族割引 承認/却下
  payment_method: z.enum(["stripe", "bank_transfer"]).optional(), // 口座振替フラグ
  manual_checkin: z.boolean().optional(), // 手動チェックイン（true で当日記録）
});

export async function PATCH(req: NextRequest) {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  const { memberId, family_discount_approved, manual_checkin, ...updates } = parsed.data;
  const admin = createRobustAdminClient();

  // ステータス変更を Stripe subscription に連動させる。
  // Why: DB のステータスだけ変えても課金は止まらない。退会=期末解約、休会=請求停止、
  //      復帰=請求再開（休会/解約予約を解除）を Stripe 側にも反映する。
  if (updates.status === "cancelled" || updates.status === "paused" || updates.status === "active") {
    const { data: member } = await admin
      .from("gym_members")
      .select("stripe_subscription_id")
      .eq("id", memberId)
      .eq("gym_id", GYM_ID)
      .maybeSingle();

    const subId = member?.stripe_subscription_id;
    if (subId) {
      try {
        if (updates.status === "cancelled") {
          // 退会: 当月末まで使わせて期末に自動解約（即時返金しない）
          await getStripe().subscriptions.update(subId, { cancel_at_period_end: true });
        } else if (updates.status === "paused") {
          // 休会: 請求を停止（behavior:void = 休会中は請求書を発行しない＝課金されない）
          await getStripe().subscriptions.update(subId, { pause_collection: { behavior: "void" } });
        } else if (updates.status === "active") {
          // 復帰: 休会の請求停止と解約予約を解除して通常課金に戻す
          await getStripe().subscriptions.update(subId, { pause_collection: "", cancel_at_period_end: false });
        }
      } catch (stripeErr) {
        // Stripe エラーは DB 更新を止めない（手動フォローアップで対応）
        console.error("Stripe subscription status sync failed:", stripeErr);
      }
    }
  }

  // 家族割引 承認/却下: family_discount フラグ更新 + 既存 Stripe subscription に coupon を反映
  // Why: 登録時に DB 検証できなかった申請は coupon 未適用で family_discount=true のまま保存される。
  //      admin が承認したら既存 subscription に coupon を適用し、却下したら discount を除去する。
  //      フラグだけ更新しても実課金額は変わらないため、ここで Stripe 側も必ず同期させる。
  if (family_discount_approved !== undefined) {
    (updates as Record<string, unknown>).family_discount = family_discount_approved;

    const { data: target } = await admin
      .from("gym_members")
      .select("stripe_subscription_id")
      .eq("id", memberId)
      .eq("gym_id", GYM_ID)
      .maybeSingle();

    const familyCouponId = process.env.ROBUST_STRIPE_COUPON_FAMILY;
    if (target?.stripe_subscription_id) {
      try {
        if (family_discount_approved && familyCouponId) {
          // 承認: coupon(duration=forever 前提) を適用 → 翌月以降の定期課金にも -¥2,000
          await getStripe().subscriptions.update(target.stripe_subscription_id, {
            discounts: [{ coupon: familyCouponId }],
          });
        } else {
          // 却下: 既存の discount を全除去（空配列で coupon をクリア）
          await getStripe().subscriptions.update(target.stripe_subscription_id, {
            discounts: [],
          });
        }
      } catch (stripeErr) {
        // Stripe 失敗は DB 更新を止めない（手動フォローアップで対応）
        console.error("Family discount coupon sync failed:", stripeErr);
      }
    }
  }

  // 手動チェックイン: attendance_logs に当日記録を追加
  // Why: ボタン連打や「QR済みの会員をさらに手動」で同日二重記録が起きると、出席数・週2回上限が
  //      過大カウントされる。当日(JST)の既存チェックインがあれば二重作成せず冪等に返す。
  if (manual_checkin) {
    const { currentBillingPeriod, jstTodayStartUtc } = await import("@/lib/robust/attendance");
    const { count } = await admin
      .from("attendance_logs")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .eq("gym_id", GYM_ID)
      .gte("checked_in_at", jstTodayStartUtc().toISOString());
    if ((count ?? 0) > 0) {
      return NextResponse.json({ ok: true, checkedIn: true, alreadyCheckedIn: true });
    }
    const { error: ciError } = await admin.from("attendance_logs").insert({
      member_id: memberId,
      gym_id: GYM_ID,
      billing_period: currentBillingPeriod(),
      class_type: null,
    });
    if (ciError) return NextResponse.json({ error: `手動チェックイン失敗: ${ciError.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, checkedIn: true });
  }

  const { error } = await admin
    .from("gym_members")
    .update(updates)
    .eq("id", memberId)
    .eq("gym_id", GYM_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
