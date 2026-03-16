import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    // Log all cookies for debugging
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const codeVerifierCookie = allCookies.find(c => c.name.includes("code-verifier"));
    console.log("[auth/callback] code received:", code.substring(0, 8));
    console.log("[auth/callback] code-verifier cookie:", codeVerifierCookie ? "FOUND: " + codeVerifierCookie.name : "NOT FOUND");
    console.log("[auth/callback] all cookie names:", allCookies.map(c => c.name).join(", "));

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      console.log("[auth/callback] success! redirecting to dashboard");
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] EXCHANGE ERROR:", error.message, "status:", error.status);
    const msg = encodeURIComponent(error.message ?? "unknown");
    return NextResponse.redirect(`${origin}/login?error=auth&msg=${msg}`);
  }

  return NextResponse.redirect(`${origin}/login?error=nocode`);
}
