/**
 * GET/POST /api/unsubscribe?token=<HMAC>
 *
 * z187: 1-click email unsubscribe (CAN-SPAM/GDPR/RFC 8058 compliance)
 *
 * - No authentication required (token-based, HMAC-signed)
 * - GET: redirect to /unsubscribe?status=ok|err (UI page) after marking opt-out
 * - POST: same effect, returns JSON (used by RFC 8058 List-Unsubscribe-Post header)
 *
 * Security:
 *   - HMAC-SHA256 token via lib/unsubscribeToken.ts
 *   - Constant-time signature compare
 *   - Token TTL 1 year
 *   - Even invalid tokens get user-friendly error page (no info leak)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { verifyUnsubscribeToken } from "@/lib/unsubscribeToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleUnsubscribe(token: string | null): Promise<{ ok: boolean; reason?: string }> {
  const verification = verifyUnsubscribeToken(token);
  if (!verification.ok || !verification.userId) {
    return { ok: false, reason: verification.reason ?? "invalid" };
  }
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { error } = await supabase
    .from("profiles")
    .update({ email_marketing_opted_out: true })
    .eq("id", verification.userId);
  if (error) {
    logger.error(
      "unsubscribe.db_update_failed",
      { userId: verification.userId },
      error as Error,
    );
    return { ok: false, reason: "db_error" };
  }
  logger.info("unsubscribe.success", { userId: verification.userId });
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const result = await handleUnsubscribe(token);
  // 302 to UI page
  const url = new URL("/unsubscribe", req.url);
  url.searchParams.set("status", result.ok ? "ok" : "err");
  if (!result.ok && result.reason) {
    url.searchParams.set("reason", result.reason);
  }
  return NextResponse.redirect(url);
}

export async function POST(req: NextRequest) {
  // RFC 8058: One-Click List-Unsubscribe-Post sends form data with
  // List-Unsubscribe=One-Click. Token comes from URL query.
  const token = req.nextUrl.searchParams.get("token");
  const result = await handleUnsubscribe(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? "failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
