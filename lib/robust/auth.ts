import { NextResponse } from "next/server";
import { createRobustServerClient } from "./supabase-server";
import { createRobustAdminClient } from "./supabase";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

type ManagerResult =
  | { ok: true; userId: string; role: "owner" | "admin" }
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

/**
 * 認証 + 管理者権限（owner / admin のみ）チェック。
 * Why: 会員管理・動画管理・売上系は instructor に見せない。requireRobustAdmin は
 *      instructor も通すため、管理系エンドポイントはこちらを使って instructor を締め出す。
 */
export async function requireRobustManager(): Promise<ManagerResult> {
  const auth = await requireRobustAdmin();
  if (!auth.ok) return { ok: false, response: auth.response };

  const admin = createRobustAdminClient();
  const { data: gym } = await admin.from("gyms").select("owner_id").eq("id", GYM_ID).maybeSingle();
  if (gym?.owner_id === auth.userId) return { ok: true, userId: auth.userId, role: "owner" };

  const { data: staff } = await admin
    .from("gym_staff")
    .select("role")
    .eq("gym_id", GYM_ID)
    .eq("user_id", auth.userId)
    .eq("status", "active")
    .maybeSingle();
  if (staff?.role === "admin") return { ok: true, userId: auth.userId, role: "admin" };

  return { ok: false, response: NextResponse.json({ error: "この操作はオーナー・管理者のみ可能です" }, { status: 403 }) };
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
