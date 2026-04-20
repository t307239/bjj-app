import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rateLimit";

// ── Rate limit: max 5 attempts per IP per 15 min ──
const restoreLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!restoreLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }
  const cookieStore = await cookies();

  // 1. Verify the requesting user's session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])); } catch { /* read-only */ }
        },
      },
    }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Restore: clear deleted_at
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.supabaseServiceRoleKey()
  );
  const { error: restoreError } = await serviceClient
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", user.id);

  if (restoreError) {
    logger.error("account.restore", { userId: user.id }, restoreError);
    return NextResponse.json({ error: "Restore failed. Please try again." }, { status: 500 });
  }

  logger.info("account.restore", { userId: user.id, result: "ok" });

  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
