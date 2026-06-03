import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAdmin } from "@/lib/robust/auth";
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
  const { error } = await admin
    .from("gym_members")
    .update(updates)
    .eq("id", memberId)
    .eq("gym_id", GYM_ID); // // defence-in-depth: gym_id フィルタで他 gym の会員変更を防止

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
