import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";

const CheckoutBodySchema = z.object({
  plan: z.enum(["monthly", "annual", "gym"]).default("monthly"),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Rate limit: Stripe checkout — max 10 per IP per 10 min ──
const checkoutLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session.
 *
 * Body: { plan: "monthly" | "annual" | "gym" }
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_B2C_PRICE_ID        — B2C Pro monthly Price ID (with 14-day trial)
 *   STRIPE_ANNUAL_PRICE_ID     — B2C Pro annual Price ID (optional, with 14-day trial)
 *   STRIPE_GYM_PRICE_ID        — B2B Gym monthly Price ID (no trial)
 *   NEXT_PUBLIC_APP_URL        — e.g. https://bjj-app.net
 *
 * If the relevant Price ID is not set, returns { fallback: true, url: PAYMENT_LINK }
 * so the caller can redirect to the static Payment Link instead.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkoutLimiter.check(ip)) {
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

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { rawBody = {}; }
  const parsed = CheckoutBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan", issues: parsed.error.issues }, { status: 400 });
  }
  const plan = parsed.data.plan;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bjj-app.net";

  // ── B2B Gym plan ─────────────────────────────────────────────────────────────
  if (plan === "gym") {
    const gymPriceId = process.env.STRIPE_GYM_PRICE_ID;

    if (!gymPriceId) {
      // Fallback to static Payment Link (no automation)
      const fallbackUrl = process.env.NEXT_PUBLIC_STRIPE_GYM_PAYMENT_LINK ?? null;
      return NextResponse.json({ url: fallbackUrl, fallback: true });
    }

    // Look up the user's gym (they must be the owner)
    const { data: gym, error: gymError } = await supabase
      .from("gyms")
      .select("id, name, is_active")
      .eq("owner_id", user.id)
      .single();

    if (gymError || !gym) {
      return NextResponse.json(
        { error: "No gym found for this user. Please create a gym first." },
        { status: 404 }
      );
    }

    if (gym.is_active) {
      return NextResponse.json(
        { error: "Gym plan is already active." },
        { status: 409 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: gymPriceId, quantity: 1 }],
        subscription_data: {
          metadata: {
            plan_type: "b2b_gym",
            gym_id: gym.id,
          },
        },
        client_reference_id: user.id,
        success_url: `${appUrl}/gym/dashboard?upgraded=1`,
        cancel_url: `${appUrl}/gym/dashboard`,
      });

      return NextResponse.json({ url: session.url });
    } catch (err) {
      logger.error("stripe.checkout.gym_session_error", { gymId: gym.id, userId: user.id }, err as Error);
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }
  }

  // ── B2C Pro plan (monthly / annual) ──────────────────────────────────────────
  const isAnnual = plan === "annual";
  const priceId = isAnnual
    ? process.env.STRIPE_ANNUAL_PRICE_ID
    : process.env.STRIPE_B2C_PRICE_ID;

  if (!priceId) {
    // Fallback to static Payment Link (no trial support but still works)
    const fallbackUrl = isAnnual
      ? (process.env.NEXT_PUBLIC_STRIPE_ANNUAL_LINK ?? process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? null)
      : (process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? null);
    return NextResponse.json({ url: fallbackUrl, fallback: true });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
    logger.error("stripe.checkout.b2c_session_error", { plan, userId: user.id }, err as Error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
