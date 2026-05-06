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
  countSignupsLastDays,
  calcSignupWow,
  calcD7Retention,
  calcSourceBreakdown,
  calcWeeklyActiveTrend,
  type SignupCohort,
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
    // Fetch all profiles. z257: cap at 100k rows so an unbounded `.select()` cannot
    // OOM the Node.js worker once user count grows. If we ever exceed this we should
    // page the query (or compute aggregates server-side via SQL view).
    // z255kk: include id, signup_source, paid_ref for PMF cohort analysis
    const { data: profiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("id, belt, is_pro, signup_source, paid_ref")
      .range(0, 99999);
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
      .gte("date", thirtyDaysAgo)
      .range(0, 99999);
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

    // z255kk: PMF metrics — fetch auth.users for created_at (signup timestamp)
    let pmfMetrics: {
      signups_last_7d: number;
      signups_last_30d: number;
      signups_last_90d: number;
      signup_wow_percent: number;
      d7_retention_percent: number;
      d7_retention_cohort_size: number;
      source_breakdown: Record<string, number>;
      weekly_active_trend: number[];
    } = {
      signups_last_7d: 0,
      signups_last_30d: 0,
      signups_last_90d: 0,
      signup_wow_percent: 0,
      d7_retention_percent: 0,
      d7_retention_cohort_size: 0,
      source_breakdown: {},
      weekly_active_trend: [0, 0, 0, 0],
    };
    try {
      // listUsers caps at 1000 per page; small-scale projects fit in 1 call.
      const { data: authData, error: authError } =
        await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (authError) throw authError;

      const profileBySource = new Map(
        allProfiles.map((p) => [
          p.id as string,
          { signup_source: p.signup_source, paid_ref: p.paid_ref },
        ])
      );
      const cohorts: SignupCohort[] = (authData?.users ?? []).map((u) => {
        const psrc = profileBySource.get(u.id);
        return {
          user_id: u.id,
          created_at: u.created_at,
          signup_source: psrc?.signup_source ?? null,
          paid_ref: psrc?.paid_ref ?? null,
        };
      });

      const now = new Date();
      const d7 = calcD7Retention(cohorts, logs, now);
      pmfMetrics = {
        signups_last_7d: countSignupsLastDays(cohorts, 7, now),
        signups_last_30d: countSignupsLastDays(cohorts, 30, now),
        signups_last_90d: countSignupsLastDays(cohorts, 90, now),
        signup_wow_percent: calcSignupWow(cohorts, now),
        d7_retention_percent: d7.percent,
        d7_retention_cohort_size: d7.cohort_size,
        source_breakdown: calcSourceBreakdown(cohorts, now),
        weekly_active_trend: calcWeeklyActiveTrend(logs, now),
      };
    } catch (e) {
      logger.warn("admin.metrics: PMF fetch failed", {
        error: (e as Error).message,
      });
      // Fall through with default zeros — UI will show "—"
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
      // z255kk: PMF metrics
      pmf: pmfMetrics,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(metrics);
  } catch (e) {
    logger.error("admin.metrics_error", {}, e as Error);
    return NextResponse.json({ error: "Failed to generate metrics" }, { status: 500 });
  }
}
