/**
 * GET /api/cron/weekly-goal
 *
 * Called every Monday by Vercel Cron (see vercel.json: "0 10 * * 1" = 10:00 UTC = 19:00 JST).
 * Sends a Push notification to users about their weekly training goal progress.
 *
 * Logic:
 *   1. Fetch users with push subscriptions who have a weekly_goal > 0
 *   2. Count their training sessions in the current week (Mon-Sun)
 *   3. Send motivational Push notification with progress
 *   4. Clean up stale subscriptions
 *
 * Security: CRON_SECRET bearer token
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

if (VAPID_SUBJECT && VAPID_PRIVATE && VAPID_PUBLIC) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

/** Get Monday of current week (UTC) */
function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

/** Pick message based on progress ratio */
function pickMessage(completed: number, goal: number): { title: string; body: string } {
  if (completed >= goal) {
    return {
      title: "🏆 週間目標達成！",
      body: `今週${completed}回の練習、目標${goal}回をクリア！この調子で来週も頑張ろう`,
    };
  }
  const remaining = goal - completed;
  const ratio = completed / goal;
  if (ratio >= 0.5) {
    return {
      title: "🔥 あと少し！",
      body: `今週${completed}/${goal}回完了。あと${remaining}回で目標達成！`,
    };
  }
  if (completed > 0) {
    return {
      title: "💪 良いスタート！",
      body: `今週${completed}/${goal}回完了。残り${remaining}回、マットに行こう！`,
    };
  }
  return {
    title: "🥋 今週の練習を始めよう",
    body: `週間目標は${goal}回。最初の一歩を踏み出そう！`,
  };
}

export async function GET(request: Request) {
  // ── Auth: CRON_SECRET ─────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!VAPID_SUBJECT || !VAPID_PRIVATE || !VAPID_PUBLIC) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = createServiceClient(supabaseUrl, supabaseServiceKey);
  const weekStart = getWeekStart();

  // Fetch push subscriptions joined with profile weekly_goal
  const { data: subs, error: subErr } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key, timezone, user_id, profiles!inner(weekly_goal)")
    .gt("profiles.weekly_goal", 0);

  if (subErr || !subs) {
    logger.error("weekly-goal: failed to fetch subscriptions", { error: subErr?.message });
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // For each user, count training logs this week
  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: logCounts } = await supabase
    .from("training_logs")
    .select("user_id")
    .gte("date", weekStart)
    .in("user_id", userIds);

  // Build count map
  const countMap = new Map<string, number>();
  for (const log of logCounts ?? []) {
    countMap.set(log.user_id, (countMap.get(log.user_id) ?? 0) + 1);
  }

  // Filter sendable & send
  const mappedSubs = subs.map((s) => ({
    id: s.id,
    endpoint: s.endpoint,
    p256dh: s.p256dh,
    auth_key: s.auth_key,
    timezone: s.timezone ?? "Asia/Tokyo",
    user_id: s.user_id,
    profiles: s.profiles,
  }));
  const sendable = filterSendableSubscriptions(
    mappedSubs,
    (s) => s.timezone,
  );

  let sent = 0;
  let stale = 0;

  for (const sub of sendable) {
    const weeklyGoal = (sub.profiles as unknown as { weekly_goal: number })?.weekly_goal ?? 0;
    if (weeklyGoal <= 0) continue;

    const completed = countMap.get(sub.user_id) ?? 0;
    const msg = pickMessage(completed, weeklyGoal);

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        },
        JSON.stringify({
          title: msg.title,
          body: msg.body,
          url: "/dashboard",
        })
      );
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        stale++;
      }
    }
  }

  logger.info("weekly-goal cron completed", {
    event: "weekly_goal_push",
    totalSubs: subs.length,
    sendable: sendable.length,
    sent,
    stale,
  });

  return NextResponse.json({ ok: true, sent, stale, total: subs.length });
}
