import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";

// ── Rate limit: account deletion is irreversible — max 3 attempts per IP per 15 min ──
const deleteRateMap = new Map<string, { count: number; resetAt: number }>();
function checkDeleteRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = deleteRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    deleteRateMap.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  entry.count++;
  return entry.count <= 3;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkDeleteRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }
  const cookieStore = await cookies();

  // 1. Verify the requesting user's session (anon key)
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

  // 2. Delete auth user via service role (triggers CASCADE on all related data)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.supabaseServiceRoleKey()
  );
  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    logger.error("account.delete", { userId: user.id }, deleteError);
    return NextResponse.json({ error: "Account deletion failed. Please try again." }, { status: 500 });
  }

  logger.info("account.delete", { userId: user.id, result: "ok" });
  return NextResponse.json({ ok: true });
}
