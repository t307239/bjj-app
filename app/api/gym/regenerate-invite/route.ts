import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/gym/regenerate-invite
 * Regenerates the invite_code for the caller's gym.
 * Old invite links immediately become invalid.
 * Existing members (already joined) are NOT affected.
 *
 * Requires: caller must be the gym owner (is_gym_owner = true)
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

  // Verify caller is a gym owner
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("gym_id, is_gym_owner")
    .eq("id", user.id)
    .single();

  if (!ownerProfile?.is_gym_owner || !ownerProfile.gym_id) {
    return NextResponse.json({ error: "Forbidden: not a gym owner" }, { status: 403 });
  }

  // Generate a new random invite code (16 hex chars)
  const newCode = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: updatedGym, error } = await supabase
    .from("gyms")
    .update({ invite_code: newCode })
    .eq("id", ownerProfile.gym_id)
    .eq("owner_id", user.id)
    .select("invite_code")
    .single();

  if (error || !updatedGym) {
    console.error("Regenerate invite error:", error);
    return NextResponse.json({ error: "Failed to regenerate invite code" }, { status: 500 });
  }

  return NextResponse.json({ invite_code: updatedGym.invite_code });
}
