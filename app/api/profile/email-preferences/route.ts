/**
 * GET/POST /api/profile/email-preferences
 *
 * z188: User-facing email preference toggle (GDPR Art 7-3 容易な withdrawal)
 *
 * 既存 /api/unsubscribe は token-based の 1-click 用 (no auth)。
 * 本 endpoint は logged-in user が settings 画面から制御するため auth 必須。
 *
 * GET:  return { email_marketing_opted_out: boolean }
 * POST: { opted_out: boolean } → DB update
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const updateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 });

const UpdateBody = z.object({
  opted_out: z.boolean(),
});

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );
}

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("email_marketing_opted_out")
    .eq("id", user.id)
    .single();
  if (error) {
    logger.error("profile.email_preferences_get_failed", { userId: user.id }, error as Error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  return NextResponse.json({
    email_marketing_opted_out: data?.email_marketing_opted_out ?? false,
  });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!updateLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { raw = {}; }
  const parsed = UpdateBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ email_marketing_opted_out: parsed.data.opted_out })
    .eq("id", user.id);
  if (error) {
    logger.error(
      "profile.email_preferences_update_failed",
      { userId: user.id, opted_out: parsed.data.opted_out },
      error as Error,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  logger.info("profile.email_preferences_updated", {
    userId: user.id,
    opted_out: parsed.data.opted_out,
  });
  return NextResponse.json({ ok: true });
}
