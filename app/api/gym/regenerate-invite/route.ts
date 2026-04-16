import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// ── Rate limit: regenerate-invite — max 10 per IP per hour ──
const regenerateLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

/**
 * POST /api/gym/regenerate-invite
 * Regenerates the invite_code for the caller's gym.
 * Old invite links immediately become invalid.
 * Existing members (already joined) are NOT affected.
 *
 * Requires: caller must be the gym owner (is_gym_owner = true)
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!regenerateLimiter.check(ip)) {
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

  // Verify caller is a gym owner
  const { data: ownerProfile , error } = await supabase
    .from("profiles")
    .select("gym_id, is_gym_owner")
    .eq("id", user.id)
    .single();
  if (error) {
    console.error("route.ts:query", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!ownerProfile?.is_gym_owner || !ownerProfile.gym_id) {
    return NextResponse.json({ error: "Forbidden: not a gym owner" }, { status: 403 });
  }

  // Generate a new random invite code (16 hex chars)
  const newCode = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: updatedGym, error: updateError } = await supabase
    .from("gyms")
    .update({ invite_code: newCode })
    .eq("id", ownerProfile.gym_id)
    .eq("owner_id", user.id)
    .select("invite_code")
    .single();

  if (updateError || !updatedGym) {
    logger.error("gym.regenerate_invite_error", { gymId: ownerProfile.gym_id, userId: user.id }, updateError as Error);
    return NextResponse.json({ error: "Failed to regenerate invite code" }, { status: 500 });
  }

  return NextResponse.json({ invite_code: updatedGym.invite_code });
}
