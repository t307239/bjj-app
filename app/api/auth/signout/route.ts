import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/signout
 * Server-side sign out — clears the Supabase session cookie and redirects to /login.
 * Handles direct URL navigation (e.g. from non-JS environments or logout links).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Use request origin so this works in any environment (dev, preview, production)
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(new URL("/login", origin));
}
