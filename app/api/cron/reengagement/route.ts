/**
 * GET /api/cron/reengagement
 *
 * Called daily by Vercel Cron (see vercel.json: "0 12 * * *" = 12:00 UTC = 21:00 JST).
 * Finds users who haven't trained in 3+ days and sends a motivational Push notification.
 *
 * Logic:
 *   1. Fetch all push subscriptions with their user's latest training date
 *   2. Filter to users inactive >= 3 days
 *   3. Filter out silent hours (22:00-08:00 local time)
 *   4. Send personalized push notification
 *   5. Clean up stale/expired subscriptions (410/404)
 *
 * Security: Vercel automatically sends Authorization: Bearer <CRON_SECRET>
 * on scheduled invocations. We verify it to prevent unauthorized triggers.
 */

import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { filterSendableSubscriptions } from "@/lib/notificationSafeHours";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const INACTIVE_DAYS_THRESHOLD = 3;

if (VAPID_SUBJECT && VAPID_PRIVATE && VAPID_PUBLIC) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

/** Motivational messages — rotated by day-of-year */
const MESSAGES = [
  { title: "🥋 マットが呼んでいます", body: "最後の練習から{days}日。今日少しだけでもロールしませんか？" },
  { title: "💪 練習再開しよう", body: "{days}日ぶりのセッション、最高の気分になれますよ" },
  { title: "🔥 ストリークを取り戻そう", body: "練習を記録して、成長の軌跡を途切れさせないで" },
  { title: "🤙 Oss! 練習の時間です", body: "短いドリルでもOK。マットに立つことが大事" },
  { title: "📈 継続は力なり", body: "{days}日空いちゃったけど、今日から再スタート！" },
];

type SubWithActivity = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  timezone: string;
  user_id: string;
  last_trained: string | null;
};

export async function GET(request: Request) {
  // ── Auth: CRON_SECRET ─────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── VAPID check ───────────────────────────────────────────────────────────
  if (!VAPID_SUBJECT || !VAPID_PRIVATE || !VAPID_PUBLIC) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  }

  // ── Service role client (bypass RLS) ──────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const supabase = createServiceClient(supabaseUrl, supabaseServiceKey);

  // ── Fetch push subscriptions with latest training date ────────────────────
  // Uses a subquery: for each push subscription, get the user's most recent training_log date
  const { data: subs, error: dbError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key, timezone, user_id");

  if (dbError) {
    logger.error("reengagement.db_error", {}, dbError as Error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, message: "No subscriptions", sent: 0 });
  }

  // ── Get latest training date per user ─────────────────────────────────────
  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: latestLogs, error: logError } = await supabase
    .rpc("get_latest_training_dates", { user_ids: userIds });

  // Fallback: if RPC doesn't exist, query directly
  let userLastTrained: Map<string, string>;
  if (logError || !latestLogs) {
    // Direct query fallback
    const { data: directLogs } = await supabase
      .from("training_logs")
      .select("user_id, date")
      .in("user_id", userIds)
      .order("date", { ascending: false });

    userLastTrained = new Map();
    for (const log of directLogs ?? []) {
      if (!userLastTrained.has(log.user_id)) {
        userLastTrained.set(log.user_id, log.date);
      }
    }
  } else {
    userLastTrained = new Map(
      (latestLogs as Array<{ user_id: string; latest_date: string }>).map(
        (r) => [r.user_id, r.latest_date]
      )
    );
  }

  // ── Filter inactive users (3+ days since last training) ───────────────────
  const now = new Date();
  const thresholdMs = INACTIVE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000;

  const subsWithActivity: SubWithActivity[] = subs.map((s) => ({
    ...s,
    last_trained: userLastTrained.get(s.user_id) ?? null,
  }));

  const inactiveSubs = subsWithActivity.filter((s) => {
    if (!s.last_trained) return true; // Never trained = definitely inactive
    const lastDate = new Date(s.last_trained);
    return now.getTime() - lastDate.getTime() >= thresholdMs;
  });

  // ── Filter by silent hours ────────────────────────────────────────────────
  const sendable = filterSendableSubscriptions(inactiveSubs, (s) => s.timezone);

  if (sendable.length === 0) {
    return NextResponse.json({
      ok: true,
      totalSubs: subs.length,
      inactive: inactiveSubs.length,
      sendable: 0,
      sent: 0,
      message: "No sendable subscriptions (all in silent hours or active)",
    });
  }

  // ── Pick message (rotate by day-of-year) ──────────────────────────────────
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const msgTemplate = MESSAGES[dayOfYear % MESSAGES.length];

  // ── Send notifications ────────────────────────────────────────────────────
  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    sendable.map(async (sub) => {
      const daysSinceTraining = sub.last_trained
        ? Math.floor((now.getTime() - new Date(sub.last_trained).getTime()) / 86400000)
        : 7; // Default for never-trained users

      const title = msgTemplate.title;
      const body = msgTemplate.body.replace("{days}", String(daysSinceTraining));

      const payload = JSON.stringify({
        title,
        body,
        url: "/dashboard",
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          payload
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          logger.warn("reengagement.send_error", {
            endpoint: sub.endpoint,
            statusCode: status,
          });
        }
        failed++;
      }
    })
  );

  // ── Clean up stale subscriptions ──────────────────────────────────────────
  if (staleEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", staleEndpoints);
    logger.info("reengagement.stale_cleanup", {
      removed: staleEndpoints.length,
    });
  }

  logger.info("reengagement.completed", {
    totalSubs: subs.length,
    inactive: inactiveSubs.length,
    sendable: sendable.length,
    sent,
    failed,
    staleRemoved: staleEndpoints.length,
  });

  return NextResponse.json({
    ok: true,
    totalSubs: subs.length,
    inactive: inactiveSubs.length,
    sendable: sendable.length,
    sent,
    failed,
    staleRemoved: staleEndpoints.length,
  });
}
