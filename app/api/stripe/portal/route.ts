import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Rate limit: portal — max 10 per IP per 10 min ──
const portalLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

/**
 * POST /api/stripe/portal
 * Creates a Stripe Billing Portal session for the authenticated user.
 * Returns a redirect to the portal URL.
 *
 * Usage: <a href="/api/stripe/portal">Manage subscription</a>
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!portalLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get stripe_customer_id from profiles
  const { data: profile , error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();
  if (error) {
    console.error("route.ts:query", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer found for this user" },
      { status: 400 }
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://bjj-app.net"}/profile`,
    });

    return NextResponse.redirect(session.url);
  } catch (err) {
    logger.error("stripe.portal.session_error", { customerId: profile.stripe_customer_id }, err as Error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
