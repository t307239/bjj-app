import { NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAuth } from "@/lib/robust/auth";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// 会員向け お知らせ一覧（アプリ内で文字でも読める）
// auth: public — requireRobustAuth（本人のみ）。ジム単位の配信なので gym_id で取得。
export async function GET() {
  const auth = await requireRobustAuth();
  if (!auth.ok) return auth.response;

  const admin = createRobustAdminClient();

  // ログインユーザーが当ジムの会員であることを確認（部外者に配信履歴を見せない）
  const { data: member } = await admin
    .from("gym_members")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("gym_id", GYM_ID)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "会員情報が見つかりません" }, { status: 404 });

  const { data, error } = await admin
    .from("announcements")
    .select("id, title, body, urgent, created_at")
    .eq("gym_id", GYM_ID)
    .order("created_at", { ascending: false })
    .range(0, 49);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data ?? [] });
}
