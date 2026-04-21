import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const signoutLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 });

/**
 * GET /api/auth/signout
 * Server-side sign out — clears the Supabase session cookie and redirects to /login.
 * Handles direct URL navigation (e.g. from non-JS environments or logout links).
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!signoutLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  // Use request origin so this works in any environment (dev, preview, production)
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(new URL("/login", origin));
}
