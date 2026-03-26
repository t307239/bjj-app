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

export const dynamic = "force-dynamic";

// ── レート制限（サーバー側メモリ / Edge-compatible な簡易実装）──────────────
// 同一 IP から 10 分以内の連続投稿を 5 件に制限。
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 分
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // OK
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false; // NG
  return true; // OK
}

// ── YouTube video ID バリデーション ─────────────────────────────────────────
const VALID_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export async function POST(req: NextRequest) {
  // ── IP 取得 ──────────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // ── レート制限チェック ─────────────────────────────────────────────────
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    );
  }

  // ── リクエストボディ検証 ────────────────────────────────────────────────
  let body: { slug?: string; lang?: string; youtube_url?: string; video_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug, lang, youtube_url, video_id } = body;

  if (!slug || typeof slug !== "string" || slug.length > 200) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  if (!lang || !["en", "ja", "pt"].includes(lang)) {
    return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  }
  if (!youtube_url || typeof youtube_url !== "string" || youtube_url.length > 300) {
    return NextResponse.json({ error: "Invalid youtube_url" }, { status: 400 });
  }
  if (!video_id || !VALID_VIDEO_ID.test(video_id)) {
    return NextResponse.json({ error: "Invalid video_id" }, { status: 400 });
  }

  // ── Supabase 挿入（service_role ではなく anon key を使用）──────────────
  // RLS で anon の INSERT を許可しているため、anon key で INSERT 可能。
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { error } = await supabase.from("ugc_video_submissions").insert({
    slug,
    lang,
    youtube_url,
    video_id,
    submitter_ip: ip,
    status: "pending",
  });

  if (error) {
    console.error("[submit-video] Supabase insert error:", error.message);
    return NextResponse.json(
      { error: "Failed to save submission. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
