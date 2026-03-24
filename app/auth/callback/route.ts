import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // B-05: New users (no ?next override) get redirected to /dashboard?welcome=1
  // The dashboard checks totalCount===0 to decide whether to auto-open the log form.
  const next = searchParams.get("next") ?? "/dashboard?welcome=1";
  // Wiki流入アトリビューション: ?ref=wiki&page=closed-guard → "wiki:closed-guard"
  const refParam = searchParams.get("ref");
  const pageParam = searchParams.get("page");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Record signup_source only when a referral param is present
      if (refParam) {
        const signupSource = pageParam ? `${refParam}:${pageParam}` : refParam;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Only write if signup_source is not already set (don't overwrite existing)
          await supabase
            .from("profiles")
            .update({ signup_source: signupSource })
            .eq("id", user.id)
            .is("signup_source", null);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    const msg = encodeURIComponent(error.message ?? "unknown");
    return NextResponse.redirect(`${origin}/login?error=auth&msg=${msg}`);
  }

  return NextResponse.redirect(`${origin}/login?error=nocode`);
}
