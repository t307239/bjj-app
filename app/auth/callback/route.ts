import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Check if a ref param is a user referral code (8-char hex from UUID)
 * vs a source attribution like "wiki" or "email_campaign".
 */
function isUserReferralCode(ref: string): boolean {
  return /^[0-9a-f]{8}$/i.test(ref);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // B-05: New users (no ?next override) get redirected to /dashboard?welcome=1
  // The dashboard checks totalCount===0 to decide whether to auto-open the log form.
  const next = searchParams.get("next") ?? "/dashboard?welcome=1";
  // Wiki流入アトリビューション: ?ref=wiki&page=closed-guard → "wiki:closed-guard"
  // User referral: ?ref=abc12345 (8-char hex code)
  const refParam = searchParams.get("ref");
  const pageParam = searchParams.get("page");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user && refParam) {
        if (isUserReferralCode(refParam)) {
          // ── User referral: record in referrals table ──────────────
          // Find the referrer by their referral_code
          const { data: referrer } = await supabase
            .from("profiles")
            .select("id")
            .eq("referral_code", refParam)
            .single();

          if (referrer && referrer.id !== user.id) {
            // Insert referral (ignore duplicate — referred_id is UNIQUE)
            await supabase.from("referrals").upsert(
              { referrer_id: referrer.id, referred_id: user.id },
              { onConflict: "referred_id" }
            );
            // Also record signup_source for analytics
            await supabase
              .from("profiles")
              .update({ signup_source: `referral:${refParam}` })
              .eq("id", user.id)
              .is("signup_source", null);
          }
        } else {
          // ── Source attribution (wiki, email, etc.) ─────────────────
          const signupSource = pageParam ? `${refParam}:${pageParam}` : refParam;
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
