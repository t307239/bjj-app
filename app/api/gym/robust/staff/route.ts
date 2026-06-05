import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAdmin } from "@/lib/robust/auth";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

type ManagerRole = "owner" | "admin";

// スタッフ管理は owner / admin のみ許可（instructor は不可）。
// Why: スタッフ追加＝権限付与なので、最小権限の原則で管理者層に限定する。
async function requireStaffManager(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const auth = await requireRobustAdmin();
  if (!auth.ok) return { ok: false, response: auth.response };

  const admin = createRobustAdminClient();
  const { data: gym } = await admin.from("gyms").select("owner_id").eq("id", GYM_ID).maybeSingle();
  if (gym?.owner_id === auth.userId) return { ok: true, userId: auth.userId };

  const { data: staff } = await admin
    .from("gym_staff")
    .select("role")
    .eq("gym_id", GYM_ID)
    .eq("user_id", auth.userId)
    .eq("status", "active")
    .maybeSingle();
  if (staff?.role === "admin") return { ok: true, userId: auth.userId };

  return { ok: false, response: NextResponse.json({ error: "スタッフ管理はオーナー・管理者のみ可能です" }, { status: 403 }) };
}

// メールアドレスから auth ユーザーを検索（service role の admin API を使用）
// Why: gym_staff.user_id は auth.users を参照するため、メールから user_id を引く必要がある。
//      小規模ジム想定で listUsers をページ走査（数百人規模までは十分）。
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createRobustAdminClient();
  const target = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    const hit = data.users.find(u => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < perPage) break;
  }
  return null;
}

export async function GET() {
  const mgr = await requireStaffManager();
  if (!mgr.ok) return mgr.response;

  const admin = createRobustAdminClient();
  const { data: gym } = await admin.from("gyms").select("owner_id").eq("id", GYM_ID).maybeSingle();

  const { data: staffRows } = await admin
    .from("gym_staff")
    .select("id, user_id, role, status, created_at")
    .eq("gym_id", GYM_ID)
    .order("created_at", { ascending: true });

  // user_id → email を解決
  const staff = await Promise.all((staffRows ?? []).map(async row => {
    const { data: u } = await admin.auth.admin.getUserById(row.user_id);
    return {
      id: row.id,
      role: row.role as string,
      status: row.status as string,
      email: u?.user?.email ?? "(不明)",
      is_owner: false,
    };
  }));

  // オーナー自身も一覧の先頭に表示（削除不可）
  let ownerEmail: string | null = null;
  if (gym?.owner_id) {
    const { data: ou } = await admin.auth.admin.getUserById(gym.owner_id);
    ownerEmail = ou?.user?.email ?? null;
  }

  return NextResponse.json({ owner_email: ownerEmail, staff });
}

const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "instructor"]),
});

export async function POST(req: NextRequest) {
  const mgr = await requireStaffManager();
  if (!mgr.ok) return mgr.response;

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "メールアドレスと役割を正しく入力してください" }, { status: 400 });

  const userId = await findUserIdByEmail(parsed.data.email);
  if (!userId) {
    // アカウント未作成 → 本人にまず登録してもらう必要がある
    return NextResponse.json({
      error: "このメールのアカウントが見つかりません。先に本人に会員登録ページでアカウントを作成してもらってください。",
    }, { status: 404 });
  }

  const admin = createRobustAdminClient();

  // 既にスタッフ登録済みかチェック
  const { data: existing } = await admin
    .from("gym_staff")
    .select("id")
    .eq("gym_id", GYM_ID)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: "このスタッフは既に登録されています" }, { status: 409 });

  const { error } = await admin.from("gym_staff").insert({
    gym_id: GYM_ID,
    user_id: userId,
    role: parsed.data.role,
    status: "active",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ staffId: z.string().uuid() });

export async function DELETE(req: NextRequest) {
  const mgr = await requireStaffManager();
  if (!mgr.ok) return mgr.response;

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const admin = createRobustAdminClient();
  const { error } = await admin
    .from("gym_staff")
    .delete()
    .eq("id", parsed.data.staffId)
    .eq("gym_id", GYM_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
