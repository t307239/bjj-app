import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, gymName } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const pubId = process.env.BEEHIIV_PUBLICATION_ID;
    const apiKey = process.env.BEEHIIV_API_KEY;

    if (!pubId || !apiKey) {
      // Fallback: log and return success (Beehiiv not configured yet)
      console.log(`[GymWaitlist] New signup: ${email} | gym: ${gymName}`);
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
      console.error("[GymWaitlist] Beehiiv error:", data);
      // Don't fail the user — log and return success
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[GymWaitlist] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
