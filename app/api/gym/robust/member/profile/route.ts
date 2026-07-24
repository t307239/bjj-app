import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAuth } from "@/lib/robust/auth";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// auth: public — 本人のみ
export async function GET() {
  const auth = await requireRobustAuth();
  if (!auth.ok) return auth.response;

  const admin = createRobustAdminClient();
  const { data, error } = await admin
    .from("gym_members")
    .select("id, name, email, phone, address, sports_history, plan_type, status, video_access, belt, stripes, created_at")
    .eq("user_id", auth.userId)
    .eq("gym_id", GYM_ID)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "会員情報が見つかりません" }, { status: 404 });

  // 昇格履歴（依頼書 Section 10）: 本人分を新しい順で取得。
  // Why: member_id で絞り、RLS とは別に defence-in-depth で own レコードのみ返す。
  const { data: promotions } = await admin
    .from("belt_history")
    .select("id, belt, stripes, promoted_on, note")
    .eq("member_id", data.id)
    .eq("gym_id", GYM_ID)
    .order("promoted_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, 49);

  return NextResponse.json({ member: data, promotions: promotions ?? [] });
}

const updateSchema = z.object({
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  sports_history: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireRobustAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const admin = createRobustAdminClient();
  const { error } = await admin
    .from("gym_members")
    .update(parsed.data)
    .eq("user_id", auth.userId) // defence-in-depth: 本人のみ更新可能
    .eq("gym_id", GYM_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
