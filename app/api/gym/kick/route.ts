import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";

const KickBodySchema = z.object({
  member_id: z.string().uuid("Invalid member ID"),
});

export const dynamic = "force-dynamic";

// ── Rate limit: kick — max 20 per IP per hour ──
const kickLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 });

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
  if (!kickLimiter.check(ip)) {
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
  try { rawBody = await req.json(); } catch { rawBody = null; }
  const parsed = KickBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const memberId = parsed.data.member_id;

  // Verify caller is a gym owner
  const { data: ownerProfile , error } = await supabase
    .from("profiles")
    .select("gym_id, is_gym_owner")
    .eq("id", user.id)
    .single();
  if (error) {
    logger.error("gym.kick_owner_query", { userId: user.id }, error as Error);
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
    logger.error("gym.kick_member_query", { memberId, gymId: ownerProfile.gym_id }, memberError as Error);
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

  revalidatePath("/gym/dashboard");

  return NextResponse.json({ ok: true });
}
