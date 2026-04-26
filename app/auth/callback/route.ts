import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Check if a ref param is a user referral code (8-char hex from UUID)
 * vs a source attribution like "wiki" or "email_campaign".
 */
function isUserReferralCode(ref: string): boolean {
  return /^[0-9a-f]{8}$/i.test(ref);
}

/**
 * z168: Open redirect prevention.
 *
 * The `?next=` param is user-controlled. Without validation, a crafted value
 * like `//evil.com`, `/\evil.com`, `https://evil.com`, or
 * `javascript:alert(1)` could redirect authenticated users off-site (phishing
 * vector right after login).
 *
 * Defense: parse `next` as a URL relative to our origin and reject if the
 * resulting `origin` differs from ours, or if the input is not a clean
 * server-relative path.
 */
function safeNextPath(next: string | null, origin: string): string {
  // z183: 新規ユーザーは /records?welcome=1 へ。 dashboard より records の
  // ほうが TrainingLog form が常駐するため、welcome=1 → 自動オープンで
  // 「最初の1件を記録」体験に直結する。 dashboard は記録 0 件だと寂しいため、
  // 先に form 体験 → 戻ってきた時に dashboard が満たされている方が良い。
  const FALLBACK = "/records?welcome=1";
  if (!next) return FALLBACK;
  // Must be a server-relative path: starts with exactly one `/`.
  if (!next.startsWith("/")) return FALLBACK;
  // Reject protocol-relative (`//`), backslash tricks (`/\…`), and URLs with embedded scheme.
  if (next.startsWith("//") || next.startsWith("/\\")) return FALLBACK;
  if (/^\/+\s*[a-z][a-z0-9+.-]*:/i.test(next)) return FALLBACK;
  try {
    const target = new URL(next, origin);
    if (target.origin !== origin) return FALLBACK;
    // Re-serialize to drop any host/scheme abuse the URL parser normalized.
    return target.pathname + target.search + target.hash;
  } catch {
    return FALLBACK;
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // B-05: New users (no ?next override) get redirected to /dashboard?welcome=1
  // The dashboard checks totalCount===0 to decide whether to auto-open the log form.
  // z168: validated against open redirect — see safeNextPath.
  const next = safeNextPath(searchParams.get("next"), origin);
  // Wiki流入アトリビューション: ?ref=wiki&page=closed-guard → "wiki:closed-guard"
  // User referral: ?ref=abc12345 (8-char hex code)
  const refParam = searchParams.get("ref");
  const pageParam = searchParams.get("page");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      // Soft-delete check: redirect deleted users to restore page
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("deleted_at")
          .eq("id", user.id)
          .single();
        if (profile?.deleted_at) {
          return NextResponse.redirect(`${origin}/account-deleted`);
        }
      }

      if (user && refParam) {
        if (isUserReferralCode(refParam)) {
          // ── User referral: record in referrals table ──────────────
          // Find the referrer by their referral_code
          const { data: referrer , error } = await supabase
            .from("profiles")
            .select("id")
            .eq("referral_code", refParam)
            .single();
          if (error) {
            logger.error("auth.callback_referrer_query_error", { refParam }, error as Error);
            return NextResponse.json({ error: error.message }, { status: 500 });
          }

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
