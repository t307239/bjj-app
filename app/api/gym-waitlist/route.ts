import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// ── Rate limit (in-memory, same pattern as submit-video) ─────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 min
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const { email, gymName } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

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
