import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/gym/curriculum
 * Body: { curriculum_url: string }
 * Gym owner (Pro) dispatches a BJJ Wiki URL to all opt-in members.
 * Sets gyms.curriculum_url and gyms.curriculum_set_at = NOW().
 *
 * Requires: caller must be gym owner (is_gym_owner = true) AND gym.is_active = true
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
  const curriculumUrl = body?.curriculum_url as string | undefined;
  if (!curriculumUrl || typeof curriculumUrl !== "string") {
    return NextResponse.json({ error: "curriculum_url required" }, { status: 400 });
  }

  // Basic URL validation — must be a valid URL
  try {
    new URL(curriculumUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
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

  // Verify gym is_active (Pro subscription required)
  const { data: gym } = await supabase
    .from("gyms")
    .select("id, is_active")
    .eq("id", ownerProfile.gym_id)
    .eq("owner_id", user.id)
    .single();

  if (!gym?.is_active) {
    return NextResponse.json(
      { error: "Forbidden: Gym Pro subscription required to dispatch curriculum" },
      { status: 403 }
    );
  }

  // Dispatch: update curriculum_url and curriculum_set_at
  const { error } = await supabase
    .from("gyms")
    .update({
      curriculum_url: curriculumUrl,
      curriculum_set_at: new Date().toISOString(),
    })
    .eq("id", ownerProfile.gym_id)
    .eq("owner_id", user.id);

  if (error) {
    console.error("Curriculum dispatch error:", error);
    return NextResponse.json({ error: "Failed to dispatch curriculum" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
