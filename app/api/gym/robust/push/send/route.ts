import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { z } from "zod";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustManager } from "@/lib/robust/auth";
import { robustLogger } from "@/lib/robust/logger";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// ── VAPID setup（本体と共用の env を使用。新規発行不要） ──
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
if (VAPID_SUBJECT && VAPID_PRIVATE && VAPID_PUBLIC) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

// 深夜帯（JST 22:00–08:00）は通常配信を抑止。緊急連絡(urgent)のみ許可。
// Why: 台風の臨時休館など緊急連絡は深夜でも届ける必要がある一方、
//      通常のお知らせで会員を夜間に起こさない（Notification Terrorism 防止）。
const SILENT_START_HOUR = 22;
const SILENT_END_HOUR = 8;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 連投防止: プロセス内 1 分クールダウン（誤操作の二重送信抑止）
const SEND_COOLDOWN_MS = 60 * 1000;
let lastSentAt = 0;

// 依頼書 Section 15: 休館/イベント/緊急連絡の一斉プッシュ配信
// auth: public — requireRobustManager でオーナー/スタッフに限定
const sendSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  // click 遷移先は同一オリジンの ROBUST パスのみ許可（open-redirect / XSS 防止）
  url: z
    .string()
    .max(512)
    .optional()
    .default("/gym/robust/member/qr")
    .refine(
      (u) => u.startsWith("/gym/robust"),
      "url は /gym/robust 配下のパスのみ指定できます"
    ),
  urgent: z.boolean().optional().default(false),
});

type PushSubRow = { id: string; endpoint: string; p256dh: string; auth_key: string };

export async function POST(req: NextRequest) {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  if (!VAPID_SUBJECT || !VAPID_PRIVATE || !VAPID_PUBLIC) {
    return NextResponse.json({ error: "プッシュ通知が未設定です（VAPID）" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "不正なリクエスト", issues: parsed.error.issues }, { status: 400 });
  }
  const { title, body: message, url, urgent } = parsed.data;

  // 深夜帯ガード（緊急以外）
  const jstHour = new Date(Date.now() + JST_OFFSET_MS).getUTCHours();
  const isSilent = jstHour >= SILENT_START_HOUR || jstHour < SILENT_END_HOUR;
  if (isSilent && !urgent) {
    return NextResponse.json(
      { error: "深夜帯（22:00〜8:00）は通常のお知らせを送信できません。緊急連絡は「緊急」を選んでください。" },
      { status: 400 }
    );
  }

  // 連投防止
  const now = Date.now();
  if (now - lastSentAt < SEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil((SEND_COOLDOWN_MS - (now - lastSentAt)) / 1000);
    return NextResponse.json(
      { error: `送信間隔が短すぎます。${retryAfter}秒後に再試行してください。` },
      { status: 429 }
    );
  }

  const admin = createRobustAdminClient();

  // 有効会員(status=active)の会員IDのみに送る（退会/休会には送らない）
  const { data: activeMembers, error: memErr } = await admin
    .from("gym_members")
    .select("id")
    .eq("gym_id", GYM_ID)
    .eq("status", "active");
  if (memErr) {
    robustLogger.error("robust.push.member_query_failed", { error: memErr.message });
    return NextResponse.json({ error: "会員取得に失敗しました" }, { status: 500 });
  }
  const activeIds = (activeMembers ?? []).map((m) => m.id);
  if (activeIds.length === 0) {
    return NextResponse.json({ ok: true, total: 0, sent: 0, failed: 0, staleRemoved: 0 });
  }

  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("gym_id", GYM_ID)
    .in("member_id", activeIds);
  if (subErr) {
    robustLogger.error("robust.push.sub_query_failed", { error: subErr.message });
    return NextResponse.json({ error: "購読取得に失敗しました" }, { status: 500 });
  }

  const all: PushSubRow[] = subs ?? [];
  lastSentAt = Date.now();

  const payload = JSON.stringify({ title, body: message, url });
  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    all.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = 購読失効 → 後で掃除
        if (status === 404 || status === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          robustLogger.warn("robust.push.send_error", { statusCode: status, message: (err as Error).message });
        }
        failed++;
      }
    })
  );

  // 失効した購読を削除（次回以降の無駄打ちを防ぐ）
  if (staleEndpoints.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  robustLogger.info("robust.push.broadcast", { total: all.length, sent, failed, urgent });
  return NextResponse.json({ ok: true, total: all.length, sent, failed, staleRemoved: staleEndpoints.length });
}
