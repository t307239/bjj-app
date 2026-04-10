import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// ── Rate limit: kick — max 20 per IP per hour ──
const kickRateMap = new Map<string, { count: number; resetAt: number }>();
function checkKickRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = kickRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    kickRateMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  entry.count++;
  return entry.count <= 20;
}

/**
 * POST /api/gym/kick
 * Body: { member_id: string }
 * Gym owner kicks a member:
 *   - Sets profiles.gym_id = NULL
 *   - Sets profiles.share_data_with_gym = false
 *   - Sets profiles.gym_kick_notified = false (triggers in-app alert for the member)
 *
 * Requires: caller must be the gym owner (is_gym_owner = true)
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkKickRateLimit(ip)) {
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

  const body = await req.json().catch(() => null);
  const memberId = body?.member_id as string | undefined;
  if (!memberId) {
    return NextResponse.json({ error: "member_id required" }, { status: 400 });
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

  // Verify the target member belongs to the same gym
  const { data: memberProfile , error: memberError } = await supabase
    .from("profiles")
    .select("id, gym_id")
    .eq("id", memberId)
    .single();
  if (memberError) {
    console.error("route.ts:query", memberError);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  if (!memberProfile || memberProfile.gym_id !== ownerProfile.gym_id) {
    return NextResponse.json({ error: "Member not found in your gym" }, { status: 404 });
  }

  // Kick: clear gym_id and share flag, set notification flag
  const { error: kickError } = await supabase
    .from("profiles")
    .update({
      gym_id: null,
      share_data_with_gym: false,
      gym_kick_notified: false, // triggers in-app banner on next load
    })
    .eq("id", memberId);

  if (kickError) {
    logger.error("gym.kick_error", { memberId, gymId: ownerProfile.gym_id }, kickError as Error);
    return NextResponse.json({ error: "Failed to kick member" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
