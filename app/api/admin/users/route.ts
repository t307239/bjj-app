/**
 * GET /api/admin/users
 *
 * Admin-only endpoint. Returns paginated user list with key stats.
 * Requires: authenticated user whose email === ADMIN_EMAIL env var.
 *
 * Query params:
 *   q      — email search query (optional)
 *   page   — page number (default 0)
 *   limit  — page size (default 50, max 200)
 */

import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rateLimit";

// ── Rate limit: admin queries — max 60 per IP per 10 min ──
const adminLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 60 });

function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!adminLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  // 1. Verify session
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Parse params
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const offset = page * limit;

  // 3. Query via Service Role (bypasses RLS)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.supabaseServiceRoleKey()
  );

  // Fetch users from auth.users via Supabase Admin API
  const { data: authData, error: authError } = await serviceClient.auth.admin.listUsers({
    page: page + 1, // Supabase uses 1-based pages
    perPage: limit,
  });

  if (authError) {
    logger.error("admin.list_users_error", {}, authError as Error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const allAuthUsers = authData.users ?? [];

  // Filter by email query
  const filteredAuthUsers = q
    ? allAuthUsers.filter((u) => u.email?.toLowerCase().includes(q.toLowerCase()))
    : allAuthUsers;

  const userIds = filteredAuthUsers.map((u) => u.id);

  // Fetch profiles for these users
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, belt, stripe, is_pro, gym_id, created_at")
    .in("id", userIds.length > 0 ? userIds : ["none"]);

  // Fetch training log counts per user (last 30 days + total)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const { data: recentLogs } = await serviceClient
    .from("training_logs")
    .select("user_id, date")
    .in("user_id", userIds.length > 0 ? userIds : ["none"])
    .gte("date", thirtyDaysAgo);

  const { data: allLogCounts } = await serviceClient
    .from("training_logs")
    .select("user_id")
    .in("user_id", userIds.length > 0 ? userIds : ["none"]);

  // Build stats maps
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const sessions30Map = new Map<string, number>();
  const totalSessionsMap = new Map<string, number>();

  for (const log of (recentLogs ?? [])) {
    sessions30Map.set(log.user_id, (sessions30Map.get(log.user_id) ?? 0) + 1);
  }
  for (const log of (allLogCounts ?? [])) {
    totalSessionsMap.set(log.user_id, (totalSessionsMap.get(log.user_id) ?? 0) + 1);
  }

  // Build response
  const users = filteredAuthUsers.map((authUser) => {
    const profile = profileMap.get(authUser.id);
    return {
      id: authUser.id,
      email: authUser.email ?? "",
      created_at: authUser.created_at,
      last_sign_in_at: authUser.last_sign_in_at ?? null,
      belt: profile?.belt ?? "white",
      stripe: (profile?.stripe as number | null) ?? 0,
      is_pro: profile?.is_pro ?? false,
      has_gym: !!profile?.gym_id,
      sessions_30d: sessions30Map.get(authUser.id) ?? 0,
      sessions_total: totalSessionsMap.get(authUser.id) ?? 0,
    };
  });

  // Q-110: CSV export mode
  const format = searchParams.get("format");
  if (format === "csv") {
    const header = "id,email,created_at,last_sign_in_at,belt,stripe,is_pro,has_gym,sessions_30d,sessions_total";
    const rows = users.map((u) =>
      [u.id, `"${u.email}"`, u.created_at, u.last_sign_in_at ?? "", u.belt, u.stripe, u.is_pro, u.has_gym, u.sessions_30d, u.sessions_total].join(",")
    );
    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bjj-app-users-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({
    users,
    total: authData.total ?? filteredAuthUsers.length,
    page,
    limit,
  });
}
