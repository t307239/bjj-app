/**
 * POST /api/push/send
 *
 * Admin-only endpoint. Sends a Web Push notification to all subscribed users,
 * respecting the silent-hours rule (22:00–08:00 local time per user timezone).
 *
 * Auth:
 *   Requires authenticated user whose email === ADMIN_EMAIL env var,
 *   OR a request that includes the header X-Push-Secret matching PUSH_SEND_SECRET.
 *
 * Body:
 *   {
 *     title: string,       // notification title
 *     body:  string,       // notification body text
 *     url?:  string,       // click-through URL (default "/")
 *   }
 *
 * Rate limit: 1 broadcast per hour (server-side in-process map).
 * Per-subscription failures are logged and skipped; one bad endpoint
 * never blocks the rest of the send.
 *
 * Env vars required (server-side, never expose to client):
 *   VAPID_SUBJECT          e.g. "mailto:307239t777@gmail.com"
 *   VAPID_PRIVATE_KEY      from `npx web-push generate-vapid-keys`
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (also needed server-side for setVapidDetails)
 *   ADMIN_EMAIL            admin user email
 *   PUSH_SEND_SECRET       optional secret-header auth for cron/automation
 */

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { filterSendableSubscriptions } from "@/lib/notificationSafeHours";
import { logger } from "@/lib/logger";

// ── VAPID setup ───────────────────────────────────────────────────────────────
const VAPID_SUBJECT    = process.env.VAPID_SUBJECT ?? "";
const VAPID_PRIVATE    = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_PUBLIC     = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const ADMIN_EMAIL      = process.env.ADMIN_EMAIL ?? "";
const PUSH_SEND_SECRET = process.env.PUSH_SEND_SECRET ?? "";

if (VAPID_SUBJECT && VAPID_PRIVATE && VAPID_PUBLIC) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

// ── Rate limit: 1 broadcast per hour ─────────────────────────────────────────
let lastSentAt = 0;
const SEND_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// ── Type for push_subscriptions row ──────────────────────────────────────────
type PushSub = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  timezone: string;
};

export async function POST(req: NextRequest) {
  // ── VAPID not configured — misconfigured server ────────────────────────────
  if (!VAPID_SUBJECT || !VAPID_PRIVATE || !VAPID_PUBLIC) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  }

  // ── Auth: admin email check OR secret header ───────────────────────────────
  const secretHeader = req.headers.get("x-push-secret");
  const isSecretAuth = PUSH_SEND_SECRET && secretHeader === PUSH_SEND_SECRET;

  if (!isSecretAuth) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const now = Date.now();
  if (now - lastSentAt < SEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil((SEND_COOLDOWN_MS - (now - lastSentAt)) / 1000);
    return NextResponse.json(
      { error: "Rate limited. Try again later.", retryAfterSeconds: retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { title?: string; body?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, body: msgBody, url = "/" } = body;
  if (!title || !msgBody) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  // ── Fetch all subscriptions ────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: subs, error: dbError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key, timezone");

  if (dbError) {
    logger.error("push.send_db_error", {}, dbError as Error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const allSubs: PushSub[] = subs ?? [];

  // ── Filter by silent hours (Notification Terrorism防止) ────────────────────
  const sendable = filterSendableSubscriptions(allSubs, (s) => s.timezone);

  // ── Send ───────────────────────────────────────────────────────────────────
  lastSentAt = Date.now();

  const payload = JSON.stringify({ title, body: msgBody, url });
  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    sendable.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = subscription expired — clean up
        if (status === 404 || status === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          logger.warn("push.send_notification_error", { endpoint: sub.endpoint, statusCode: status, message: (err as Error).message });
        }
        failed++;
      }
    })
  );

  // ── Delete stale subscriptions ─────────────────────────────────────────────
  if (staleEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", staleEndpoints);
  }

  return NextResponse.json({
    ok: true,
    total: allSubs.length,
    silentSkipped: allSubs.length - sendable.length,
    sent,
    failed,
    staleRemoved: staleEndpoints.length,
  });
}
