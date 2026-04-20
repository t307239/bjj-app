import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rateLimit";

// ── Rate limit: max 3 attempts per IP per 15 min ──
const deleteLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3 });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!deleteLimiter.check(ip)) {
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

  // 2. Soft delete: set deleted_at timestamp (data preserved for potential restore)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.supabaseServiceRoleKey()
  );
  const deletedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(); // JST
  const { error: softDeleteError } = await serviceClient
    .from("profiles")
    .update({ deleted_at: deletedAt })
    .eq("id", user.id);

  if (softDeleteError) {
    logger.error("account.softDelete", { userId: user.id }, softDeleteError);
    return NextResponse.json({ error: "Account deletion failed. Please try again." }, { status: 500 });
  }

  logger.info("account.softDelete", { userId: user.id, deletedAt, result: "ok" });

  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
