/**
 * POST /api/wiki/submit-video
 *
 * UGC 動画投稿エンドポイント。
 * - クライアントから slug / lang / youtube_url / video_id を受け取る
 * - ugc_video_submissions テーブルに status: 'pending' で挿入
 * - wiki_pages.video_url への直接反映は行わない（AI トリアージ後に ugc_triage.py が更新）
 *
 * 認証不要（anonymous 投稿可）。
 * RLS: anon に INSERT のみ許可済み（20260326_ugc_video_submissions.sql 参照）。
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// ── レート制限定数 ─────────────────────────────────────────────────────────
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MINS = 10;

// ── Zod schema for submission body ────────────────────────────────────────
const SubmitVideoSchema = z.object({
  slug: z.string().min(1).max(200),
  lang: z.enum(["en", "ja", "pt"]),
  youtube_url: z.string().url().max(300),
  video_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Invalid YouTube video ID"),
});

export async function POST(req: NextRequest) {
  // ── IP 取得 ──────────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // ── Supabase クライアント（anon key — レート制限チェック + 挿入共用）────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  // ── DB ベースレート制限（cold start を跨いでも有効）──────────────────
  // ugc_video_submissions.submitter_ip を使って直近 10 分の投稿件数を確認。
  // NOTE: anon RLS が SELECT を許可していない場合は count = 0 扱いでスキップ。
  {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINS * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("ugc_video_submissions")
      .select("*", { count: "exact", head: true })
      .eq("submitter_ip", ip)
      .gte("created_at", windowStart);
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }
  }

  // ── リクエストボディ検証（Zodスキーマ）────────────────────────────────────
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { rawBody = null; }
  const parsed = SubmitVideoSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { slug, lang, youtube_url, video_id } = parsed.data;

  const { error } = await supabase.from("ugc_video_submissions").insert({
    slug,
    lang,
    youtube_url,
    video_id,
    submitter_ip: ip,
    status: "pending",
  });

  if (error) {
    logger.error("wiki.submit_video_insert_error", { slug, lang }, error as Error);
    return NextResponse.json(
      { error: "Failed to save submission. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
