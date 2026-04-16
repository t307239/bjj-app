import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";

const WaitlistBodySchema = z.object({
  email: z.string().email("Invalid email address").max(320),
  gymName: z.string().max(200).optional(),
});

// ── Rate limit: waitlist — max 5 per IP per 10 min ──
const waitlistLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!waitlistLimiter.check(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch { rawBody = {}; }
    const parsed = WaitlistBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const { email, gymName } = parsed.data;

    const pubId = process.env.BEEHIIV_PUBLICATION_ID;
    const apiKey = process.env.BEEHIIV_API_KEY;

    if (!pubId || !apiKey) {
      // Fallback: log and return success (Beehiiv not configured yet)
      logger.info("gym_waitlist.signup_no_beehiiv", { email, gymName });
      return NextResponse.json({ success: true });
    }

    // Subscribe to Beehiiv with custom fields
    const body: Record<string, unknown> = {
      email,
      reactivate_existing: false,
      send_welcome_email: true,
      utm_source: "bjj-app-gym-waitlist",
      utm_medium: "website",
    };

    // Add gym name as custom field if provided
    if (gymName) {
      body.custom_fields = [{ name: "gym_name", value: gymName }];
    }

    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      logger.warn("gym_waitlist.beehiiv_error", { status: response.status, data });
      return NextResponse.json(
        { error: "Failed to register. Please try again later." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("gym_waitlist.error", {}, err as Error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
