import { NextResponse } from "next/server";
import { createRobustServerClient } from "./supabase-server";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/** 認証 + スタッフ/オーナー権限チェックを一括実施 */
export async function requireRobustAdmin(): Promise<AuthResult> {
  const supabase = await createRobustServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }) };
  }
  // Why: RPC は service role だと auth.uid()=NULL → user client で呼ぶ
  const { data: isStaff } = await supabase.rpc("is_gym_staff_or_owner", { target_gym_id: GYM_ID });
  if (!isStaff) {
    return { ok: false, response: NextResponse.json({ error: "権限がありません" }, { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}

/** 認証のみ（スタッフ権限不要の会員向けエンドポイント用） */
export async function requireRobustAuth(): Promise<AuthResult> {
  const supabase = await createRobustServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }) };
  }
  return { ok: true, userId: user.id };
}
