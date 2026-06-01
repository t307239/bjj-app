import { NextRequest, NextResponse } from "next/server";
import { createRobustServerClient } from "@/lib/robust/supabase-server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// auth: public — 会員は GET のみ、管理者は全操作
export async function GET() {
  const supabase = await createRobustServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const admin = createRobustAdminClient();

  // 管理者かチェック
  const { data: isStaff } = await supabase.rpc("is_gym_staff_or_owner", { target_gym_id: GYM_ID });

  if (isStaff) {
    // 管理者: 全動画（非公開含む）
    const { data: videos, error } = await admin
      .from("gym_videos")
      .select("id, title, description, drive_file_id, thumbnail_url, class_type, is_active, created_at")
      .eq("gym_id", GYM_ID)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ videos: videos ?? [], isAdmin: true });
  }

  // 会員: active かつ is_active = true の動画のみ
  const { data: member } = await admin
    .from("gym_members")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("gym_id", GYM_ID)
    .maybeSingle();

  if (!member || member.status !== "active") {
    return NextResponse.json({ error: "有効な会員のみ閲覧できます" }, { status: 403 });
  }

  const { data: videos, error } = await admin
    .from("gym_videos")
    .select("id, title, description, drive_file_id, thumbnail_url, class_type, created_at")
    .eq("gym_id", GYM_ID)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ videos: videos ?? [], isAdmin: false });
}

const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  drive_file_id: z.string().min(1),
  thumbnail_url: z.string().url().optional().nullable(),
  class_type: z.enum(["beginner", "basic", "regular", "nogi", "private", "other"]).optional().nullable(),
});

export async function POST(req: NextRequest) {
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  const admin = createRobustAdminClient();
  const { data, error } = await admin
    .from("gym_videos")
    .insert({ ...parsed.data, gym_id: GYM_ID, created_by: user.id })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

const toggleSchema = z.object({ videoId: z.string().uuid(), is_active: z.boolean() });

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
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  const admin = createRobustAdminClient();
  const { error } = await admin
    .from("gym_videos")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.videoId)
    .eq("gym_id", GYM_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
