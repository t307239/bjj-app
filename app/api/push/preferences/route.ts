/**
 * GET /api/push/preferences
 *
 * Returns the authenticated user's notification preferences.
 *
 * PATCH /api/push/preferences
 *
 * Updates notification preferences for the authenticated user.
 * Body: { reengagement?: boolean, weekly_goal?: boolean, milestone?: boolean, weekly_email?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";

const PreferencesSchema = z.object({
  reengagement: z.boolean().optional(),
  weekly_goal: z.boolean().optional(),
  milestone: z.boolean().optional(),
  weekly_email: z.boolean().optional(),
});

const prefLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("notification_preferences")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("push.preferences_get_error", { userId: user.id }, error as Error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // Default preferences if no subscription exists
  const defaults = { reengagement: true, weekly_goal: true, milestone: true, weekly_email: true };
  const prefs = data?.notification_preferences ?? defaults;

  return NextResponse.json({ ok: true, preferences: prefs });
}

export async function PATCH(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!prefLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PreferencesSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  // Fetch current preferences, merge with updates
  const { data: existing, error: fetchErr } = await supabase
    .from("push_subscriptions")
    .select("notification_preferences")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (fetchErr) {
    logger.error("push.preferences_fetch_error", { userId: user.id }, fetchErr as Error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "No push subscription found. Enable notifications first." }, { status: 404 });
  }

  const current = (existing.notification_preferences ?? {}) as Record<string, boolean>;
  const merged = { ...current, ...parsed.data };

  // Update all subscriptions for this user
  const { error: updateErr } = await supabase
    .from("push_subscriptions")
    .update({ notification_preferences: merged })
    .eq("user_id", user.id);

  if (updateErr) {
    logger.error("push.preferences_update_error", { userId: user.id }, updateErr as Error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  revalidatePath("/settings");

  return NextResponse.json({ ok: true, preferences: merged });
}
