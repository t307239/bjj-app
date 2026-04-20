/**
 * POST /api/push/subscribe
 *
 * Saves (or updates) a Web Push subscription for the authenticated user.
 * Called from the client after `registration.pushManager.subscribe()`.
 *
 * Body:
 *   {
 *     endpoint: string,
 *     timezone: string,           // IANA timezone (e.g. "Asia/Tokyo") — required for silent hours
 *     keys: { p256dh: string, auth: string }
 *   }
 *
 * DELETE /api/push/subscribe
 *
 * Removes a subscription by endpoint (called on permission revoke).
 *
 * Body:
 *   { endpoint: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";

const SubscribeBodySchema = z.object({
  endpoint: z.string().url().max(2048),
  timezone: z.string().max(100).optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// ── Rate limit: push subscribe — max 20 per IP per 10 min ──
const pushLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 });

/** Validate IANA timezone string using Intl.DateTimeFormat */
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!pushLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = SubscribeBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { endpoint, timezone, keys } = parsed.data;

  // タイムゾーン検証: 不正な値は UTC にフォールバック（Notification Terrorism 防止）
  const safeTimezone =
    timezone && isValidTimezone(timezone) ? timezone : "UTC";

  // Upsert: one row per (user_id, endpoint) — handles refresh of expired subscriptions
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth_key: keys.auth,
      timezone: safeTimezone,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    logger.error("push.subscribe_upsert_error", { userId: user.id }, error as Error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  revalidatePath("/settings");

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint);

  if (error) {
    logger.error("push.unsubscribe_delete_error", { userId: user.id }, error as Error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  revalidatePath("/settings");

  return NextResponse.json({ ok: true });
}
