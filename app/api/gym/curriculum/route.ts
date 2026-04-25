import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";

const curriculumLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = ["wiki.bjj-app.net", "bjj-app.net", "www.bjj-app.net"];

const CurriculumBodySchema = z.object({
  curriculum_url: z
    .string()
    .url("Invalid URL format")
    .max(500, "URL too long")
    .refine((url) => {
      // Defense-in-depth: z.string().url() は javascript: / data: / file: / ftp: も通す。
      // ALLOWED_HOSTS だけだと、将来ホスト追加時に protocol を見落とすリスクがある。
      // ここで protocol を先に絞ることで、SSRF/script injection を二重に閉じる。
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") return false;
        return ALLOWED_HOSTS.includes(parsed.hostname);
      } catch {
        return false;
      }
    }, "Only HTTPS BJJ Wiki URLs (wiki.bjj-app.net) are allowed"),
});

/**
 * POST /api/gym/curriculum
 * Body: { curriculum_url: string }
 * Gym owner (Pro) dispatches a BJJ Wiki URL to all opt-in members.
 * Sets gyms.curriculum_url and gyms.curriculum_set_at = NOW().
 *
 * Requires: caller must be gym owner (is_gym_owner = true) AND gym.is_active = true
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!curriculumLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
  const parsed = CurriculumBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const curriculumUrl = parsed.data.curriculum_url;

  // Verify caller is a gym owner
  const { data: ownerProfile , error } = await supabase
    .from("profiles")
    .select("gym_id, is_gym_owner")
    .eq("id", user.id)
    .single();
  if (error) {
    logger.error("gym.curriculum_profile_query", { userId: user.id }, error as Error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  if (!ownerProfile?.is_gym_owner || !ownerProfile.gym_id) {
    return NextResponse.json({ error: "Forbidden: not a gym owner" }, { status: 403 });
  }

  // Verify gym is_active (Pro subscription required) + 1-per-day rate limit
  const { data: gym , error: gymError } = await supabase
    .from("gyms")
    .select("id, is_active, curriculum_set_at")
    .eq("id", ownerProfile.gym_id)
    .eq("owner_id", user.id)
    .single();
  if (gymError) {
    logger.error("gym.curriculum_gym_query", { gymId: ownerProfile.gym_id }, gymError as Error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  if (!gym?.is_active) {
    return NextResponse.json(
      { error: "Forbidden: Gym Pro subscription required to dispatch curriculum" },
      { status: 403 }
    );
  }

  // Rate limit: 1 dispatch per calendar day (UTC)
  if (gym.curriculum_set_at) {
    const lastDispatch = new Date(gym.curriculum_set_at);
    const todayUTC = new Date().toISOString().split("T")[0];
    const lastUTC = lastDispatch.toISOString().split("T")[0];
    if (lastUTC === todayUTC) {
      return NextResponse.json(
        { error: "Curriculum already dispatched today. Please try again tomorrow." },
        { status: 429 }
      );
    }
  }

  // Dispatch: update curriculum_url and curriculum_set_at
  const { error: dispatchError } = await supabase
    .from("gyms")
    .update({
      curriculum_url: curriculumUrl,
      curriculum_set_at: new Date().toISOString(),
    })
    .eq("id", ownerProfile.gym_id)
    .eq("owner_id", user.id);

  if (dispatchError) {
    logger.error("gym.curriculum_dispatch_error", { gymId: ownerProfile.gym_id, userId: user.id }, dispatchError as Error);
    return NextResponse.json({ error: "Failed to dispatch curriculum" }, { status: 500 });
  }

  revalidatePath("/gym/dashboard");

  return NextResponse.json({ ok: true });
}
