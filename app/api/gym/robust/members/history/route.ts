import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustManager } from "@/lib/robust/auth";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// 昇格履歴の取得（依頼書 Section 10・管理画面「一覧表示」）
// auth: public — requireRobustManager でオーナー/スタッフに限定
const querySchema = z.object({ memberId: z.string().uuid() });

export async function GET(req: NextRequest) {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  const parsed = querySchema.safeParse({
    memberId: req.nextUrl.searchParams.get("memberId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  const admin = createRobustAdminClient();
  const { data, error } = await admin
    .from("belt_history")
    .select("id, belt, stripes, promoted_on, note")
    .eq("member_id", parsed.data.memberId)
    .eq("gym_id", GYM_ID) // 他ジムの履歴混入を防ぐ defence-in-depth
    .order("promoted_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, 99);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data ?? [] });
}
