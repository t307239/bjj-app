import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session with a 14-day free trial.
 *
 * Body: { plan: "monthly" | "annual" }
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_B2C_PRICE_ID        — Stripe Price ID for B2C Pro monthly
 *   STRIPE_ANNUAL_PRICE_ID     — Stripe Price ID for B2C Pro annual (optional)
 *   NEXT_PUBLIC_APP_URL        — e.g. https://bjj-app.net
 *
 * If STRIPE_B2C_PRICE_ID is not set, returns { fallback: true, url: PAYMENT_LINK }
 * so the caller can redirect to the static Payment Link instead.
 *
 * NOTE: To configure this in Stripe Dashboard (Payment Links cannot carry trials):
 *   1. Stripe Dashboard → Products → B2C Pro → Prices → copy Price ID
 *   2. Add to Vercel env: STRIPE_B2C_PRICE_ID=price_xxxx
 *   3. Optionally add STRIPE_ANNUAL_PRICE_ID=price_yyyy for the annual plan
 */
export async function POST(req: Request) {
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

  const body = (await req.json()) as { plan?: string };
  const isAnnual = body.plan === "annual";

  // Prefer programmatic checkout (supports trial periods)
  const priceId = isAnnual
    ? process.env.STRIPE_ANNUAL_PRICE_ID
    : process.env.STRIPE_B2C_PRICE_ID;

  if (!priceId) {
    // Fall back to static Payment Link — no trial support but still works
    const fallbackUrl = isAnnual
      ? (process.env.NEXT_PUBLIC_STRIPE_ANNUAL_LINK ?? process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? null)
      : (process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? null);
    return NextResponse.json({ url: fallbackUrl, fallback: true });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bjj-app.net";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { plan_type: "b2c_pro" },
      },
      client_reference_id: user.id,
      success_url: `${appUrl}/dashboard?upgraded=1`,
      cancel_url: `${appUrl}/techniques`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
