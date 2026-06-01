import { NextRequest, NextResponse } from "next/server";
import { createRobustServerClient } from "@/lib/robust/supabase-server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// auth: public — is_gym_staff_or_owner RLS で保護
export async function GET() {
  const supabase = await createRobustServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // Why: RPC は service role だと auth.uid() が NULL になるため user client で呼ぶ
  const { data: isStaff } = await supabase.rpc("is_gym_staff_or_owner", { target_gym_id: GYM_ID });
  if (!isStaff) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const admin = createRobustAdminClient();
  const { data: members, error } = await admin
    .from("gym_members")
    .select("id, name, email, phone, plan_type, plan_cap, status, payment_method, insurance_expires_at, is_minor, created_at")
    .eq("gym_id", GYM_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: members ?? [] });
}

const updateSchema = z.object({
  memberId: z.string().uuid(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  plan_type: z.enum(["fulltime", "twice_weekly", "drop_in"]).optional(),
  plan_cap: z.number().int().min(1).max(99).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const supabase = await createRobustServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data: isStaff } = await supabase.rpc("is_gym_staff_or_owner", { target_gym_id: GYM_ID });
  if (!isStaff) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

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
