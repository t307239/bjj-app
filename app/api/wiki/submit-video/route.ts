/**
 * POST /api/wiki/submit-video
 *
 * UGC 動画投稿エンドポイント。
 * - クライアントから slug / lang / youtube_url / video_id を受け取る
 * - ugc_video_submissions テーブルに status: 'pending' で挿入
 * - wiki_pages.video_url への直接反映は行わない（AI トリアージ後に ugc_triage.py が更新）
 *
 * 認証不要（anonymous 投稿可）。
 *
 * z199 (security): server-side で service_role client を使用。
 *   - anon は INSERT 不可 (20260427_revoke_ugc_anon_insert.sql で REVOKE)
 *   - rate limit (5 / 10min / IP) は service_role の SELECT で実際に効く
 *     (旧実装は anon RLS で SELECT 不可だったため count=0 で fail-open していた)
 *   - Zod 検証 + 多層防衛として保持
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // ── Supabase クライアント (service_role — RLS bypass で rate limit + INSERT)──
  const supabase = createAdminClient();

  // ── DB ベースレート制限（cold start を跨いでも有効）──────────────────
  // service_role は RLS bypass するため SELECT count が実際に取れる。
  // unknown IP (取得失敗時) は rate limit を skip — 全 unknown を 1 つの bucket に
  // 入れると共有 NAT 等で誤 ban が起きるため。
  if (ip !== "unknown") {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINS * 60 * 1000).toISOString();
    const { count, error: rateErr } = await supabase
      .from("ugc_video_submissions")
      .select("*", { count: "exact", head: true })
      .eq("submitter_ip", ip)
      .gte("created_at", windowStart);
    if (rateErr) {
      // rate limit 自体が失敗した場合 fail-closed (spam 対策優先)
      logger.error("wiki.submit_video_rate_limit_error", { ip }, rateErr as Error);
      return NextResponse.json(
        { error: "Service temporarily unavailable." },
        { status: 503 }
      );
    }
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
