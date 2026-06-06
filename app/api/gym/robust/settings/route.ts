import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustManager, requireRobustAuth } from "@/lib/robust/auth";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// auth: public — admin または video_access を持つ active 会員のみ取得可
// Why: drive_folder_url は「リンクを知っている全員」共有のフォルダを指すため、URL 自体が
//      動画ペイウォールの鍵になる。ログイン済みなら誰でも返すと video_access 無し会員が
//      直接 API を叩いて課金オプションを回避できてしまうため、video_access を必須にする。
export async function GET() {
  const auth = await requireRobustAuth();
  if (!auth.ok) return auth.response;

  const admin = createRobustAdminClient();

  const { createRobustServerClient } = await import("@/lib/robust/supabase-server");
  const supabase = await createRobustServerClient();
  const { data: isStaff } = await supabase.rpc("is_gym_staff_or_owner", { target_gym_id: GYM_ID });

  if (!isStaff) {
    // 会員: active かつ video_access=true のみ許可
    const { data: member } = await admin
      .from("gym_members")
      .select("status, video_access")
      .eq("user_id", auth.userId)
      .eq("gym_id", GYM_ID)
      .maybeSingle();

    if (!member || member.status !== "active" || !member.video_access) {
      return NextResponse.json({ error: "閲覧権限がありません" }, { status: 403 });
    }
  }

  const { data } = await admin
    .from("gyms")
    .select("drive_folder_url")
    .eq("id", GYM_ID)
    .single();

  return NextResponse.json({ drive_folder_url: data?.drive_folder_url ?? null });
}

const settingsSchema = z.object({
  drive_folder_url: z.string().url().nullable().optional(),
});

// オーナー・管理者のみ更新可
export async function PATCH(req: NextRequest) {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const admin = createRobustAdminClient();
  const { error } = await admin
    .from("gyms")
    .update(parsed.data)
    .eq("id", GYM_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
