/**
 * GET /api/admin/metrics
 *
 * Q-127: Admin-only endpoint. Returns platform health metrics summary.
 * Provides quick overview for operational decision-making without
 * requiring direct DB access.
 *
 * Response: PlatformMetrics (total users, Pro rate, belt distribution,
 *           active users 7d/30d, total sessions, push subscribers)
 */

import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rateLimit";
import {
  calcBeltDistribution,
  calcProRate,
  countActiveUsers,
  calcAvgSessionsPerUser,
} from "@/lib/adminMetrics";

const adminLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });

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

  // 2. Service role client
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.supabaseServiceRoleKey()
  );

  try {
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("belt, is_pro");
    if (profilesError) throw profilesError;

    const allProfiles = profiles ?? [];
    const totalUsers = allProfiles.length;
    const proUsers = allProfiles.filter((p) => p.is_pro).length;

    // Belt distribution
    const beltDist = calcBeltDistribution(allProfiles);

    // Training logs (last 30 days for activity metrics)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .split("T")[0];
    const { data: recentLogs, error: logsError } = await serviceClient
      .from("training_logs")
      .select("user_id, date")
      .gte("date", thirtyDaysAgo);
    if (logsError) throw logsError;

    const logs = recentLogs ?? [];

    // Total sessions (all time)
    const { count: totalSessions, error: countError } = await serviceClient
      .from("training_logs")
      .select("id", { count: "exact", head: true });
    if (countError) throw countError;

    // Active users
    const activeUsers7d = countActiveUsers(logs, 7);
    const activeUsers30d = countActiveUsers(logs, 30);

    // Push subscribers
    const { count: pushCount, error: pushError } = await serviceClient
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true });
    if (pushError) {
      logger.warn("admin.metrics: push_subscriptions count failed", { error: pushError.message });
    }

    const metrics = {
      total_users: totalUsers,
      pro_users: proUsers,
      free_users: totalUsers - proUsers,
      pro_rate_percent: calcProRate(totalUsers, proUsers),
      belt_distribution: beltDist,
      active_users_7d: activeUsers7d,
      active_users_30d: activeUsers30d,
      total_sessions: totalSessions ?? 0,
      avg_sessions_per_user_30d: calcAvgSessionsPerUser(logs.length, activeUsers30d),
      push_subscribers: pushCount ?? 0,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(metrics);
  } catch (e) {
    logger.error("admin.metrics_error", {}, e as Error);
    return NextResponse.json({ error: "Failed to generate metrics" }, { status: 500 });
  }
}
