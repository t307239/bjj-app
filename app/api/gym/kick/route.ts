import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("gym_id, is_gym_owner")
    .eq("id", user.id)
    .single();

  if (!ownerProfile?.is_gym_owner || !ownerProfile.gym_id) {
    return NextResponse.json({ error: "Forbidden: not a gym owner" }, { status: 403 });
  }

  // Verify the target member belongs to the same gym
  const { data: memberProfile } = await supabase
    .from("profiles")
    .select("id, gym_id")
    .eq("id", memberId)
    .single();

  if (!memberProfile || memberProfile.gym_id !== ownerProfile.gym_id) {
    return NextResponse.json({ error: "Member not found in your gym" }, { status: 404 });
  }

  // Kick: clear gym_id and share flag, set notification flag
  const { error } = await supabase
    .from("profiles")
    .update({
      gym_id: null,
      share_data_with_gym: false,
      gym_kick_notified: false, // triggers in-app banner on next load
    })
    .eq("id", memberId);

  if (error) {
    console.error("Kick error:", error);
    return NextResponse.json({ error: "Failed to kick member" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
