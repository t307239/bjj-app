import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAdmin } from "@/lib/robust/auth";
import { getStripe } from "@/lib/robust/payments";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// auth: public — is_gym_staff_or_owner RLS で保護
export async function GET() {
  const auth = await requireRobustAdmin();
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
  const familyNameCount: Record<string, number> = {};
  for (const m of list) {
    if (m.family_discount && m.family_member_name) {
      const key = m.family_member_name.trim();
      familyNameCount[key] = (familyNameCount[key] ?? 0) + 1;
    }
  }
  const duplicateFamilyNames = new Set(
    Object.entries(familyNameCount).filter(([, c]) => c > 1).map(([k]) => k)
  );

  const membersWithWarning = list.map(m => ({
    ...m,
    family_discount_warning: m.family_discount && m.family_member_name
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
  const auth = await requireRobustAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  const { memberId, ...updates } = parsed.data;
  const admin = createRobustAdminClient();

  // Why: admin が status="cancelled" に変更した場合、DB 更新だけでは Stripe subscription が
  //      active のまま毎月課金が継続してしまう。期末キャンセルで月額を止める。
  if (updates.status === "cancelled") {
    const { data: member } = await admin
      .from("gym_members")
      .select("stripe_subscription_id")
      .eq("id", memberId)
      .eq("gym_id", GYM_ID)
      .maybeSingle();

    if (member?.stripe_subscription_id) {
      try {
        // cancel_at_period_end=true: 当月末まで使わせて期末に自動解約（即時返金しない）
        await getStripe().subscriptions.update(member.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      } catch (stripeErr) {
        // Stripe エラーは DB 更新を止めない（手動フォローアップで対応）
        console.error("Stripe subscription cancel failed:", stripeErr);
      }
    }
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
