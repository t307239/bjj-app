import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/signout
 * Server-side sign out — clears the Supabase session cookie and redirects to /login.
 * Handles direct URL navigation (e.g. from non-JS environments or logout links).
 */
export async function GET() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL("/login", process.env.NEXT_PUBLIC_SITE_URL)
    : new URL("https://bjj-app.net/login");

  return NextResponse.redirect(redirectUrl);
}
