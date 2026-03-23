import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal
 * Creates a Stripe Billing Portal session for the authenticated user.
 * Returns a redirect to the portal URL.
 *
 * Usage: <a href="/api/stripe/portal">Manage subscription</a>
 */
export async function POST() {
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

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
    console.error("Stripe portal session error:", err);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
