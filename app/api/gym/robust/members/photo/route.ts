import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustManager } from "@/lib/robust/auth";
import { robustLogger } from "@/lib/robust/logger";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";
const BUCKET = "member-photos";
// base64 は元データの約1.37倍。5MB画像 ≒ 約6.8MB の base64 を上限に。
const MAX_BASE64_LEN = 7_000_000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// 会員写真のアップロード/削除（オーナー/スタッフのみ・本人確認用）
const postSchema = z.object({
  memberId: z.string().uuid(),
  contentType: z.enum(ALLOWED_TYPES),
  // data URL プレフィックス無しの純粋な base64
  imageBase64: z.string().min(1).max(MAX_BASE64_LEN),
});

export async function POST(req: NextRequest) {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "画像が不正、またはサイズ超過（5MBまで・JPEG/PNG/WebP）" }, { status: 400 });
  }
  const { memberId, contentType, imageBase64 } = parsed.data;

  const admin = createRobustAdminClient();

  // 対象が自ジムの会員か確認（他ジムの member_id を弾く defence-in-depth）
  const { data: member } = await admin
    .from("gym_members")
    .select("id")
    .eq("id", memberId)
    .eq("gym_id", GYM_ID)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "会員が見つかりません" }, { status: 404 });

  // base64 → バイナリ
  let buffer: Buffer;
  try {
    buffer = Buffer.from(imageBase64, "base64");
  } catch {
    return NextResponse.json({ error: "画像のデコードに失敗しました" }, { status: 400 });
  }

  // オブジェクト名は member_id のみ（拡張子無し）。upsert で再アップロードは上書き。
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(memberId, buffer, { contentType, upsert: true });
  if (upErr) {
    robustLogger.error("robust.member_photo.upload_failed", { memberId, error: upErr.message });
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(memberId);
  // Why: 同一URLのため再アップロード時にブラウザ/CDNキャッシュで古い画像が残る。
  //      ?t= のクエリでキャッシュを破棄し、即時に新しい写真を表示する。
  const url = `${pub.publicUrl}?t=${Date.now()}`;

  const { error: updErr } = await admin
    .from("gym_members")
    .update({ photo_url: url })
    .eq("id", memberId)
    .eq("gym_id", GYM_ID);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, url });
}

const deleteSchema = z.object({ memberId: z.string().uuid() });

export async function DELETE(req: NextRequest) {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const admin = createRobustAdminClient();
  await admin.storage.from(BUCKET).remove([parsed.data.memberId]);
  const { error } = await admin
    .from("gym_members")
    .update({ photo_url: null })
    .eq("id", parsed.data.memberId)
    .eq("gym_id", GYM_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
