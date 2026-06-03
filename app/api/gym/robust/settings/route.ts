import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAdmin, requireRobustAuth } from "@/lib/robust/auth";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// auth: public — ログイン済みで取得可（Drive フォルダ URL の表示用）
export async function GET() {
  const auth = await requireRobustAuth();
  if (!auth.ok) return auth.response;

  const admin = createRobustAdminClient();
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

// admin のみ更新可
export async function PATCH(req: NextRequest) {
  const auth = await requireRobustAdmin();
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
