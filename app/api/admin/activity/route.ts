/**
 * GET /api/admin/activity
 *
 * Q-119: Admin-only endpoint. Returns recent training activity across all users.
 * Provides operational visibility into platform health and user engagement.
 *
 * Query params:
 *   days   — lookback period (default 7, max 90)
 *   limit  — max entries (default 50, max 200)
 */

import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rateLimit";

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
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10)));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

  // 3. Query via Service Role
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.supabaseServiceRoleKey()
  );

  const sinceDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

  const { data: logs, error: logsError } = await serviceClient
    .from("training_logs")
    .select("id, user_id, date, type, duration_min, created_at")
    .gte("date", sinceDate)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (logsError) {
    logger.error("admin.activity_error", {}, logsError as unknown as Error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }

  const entries = logs ?? [];

  // Collect unique user IDs for email lookup (only those in recent entries)
  const userIds = [...new Set(entries.map((e) => e.user_id))];

  // Fetch emails only for relevant users via profiles table (avoids listing ALL auth users)
  const emailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profileEmails } = await serviceClient
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    for (const p of (profileEmails ?? [])) {
      if (p.email) emailMap.set(p.id, p.email);
    }
  }

  // Aggregate daily stats
  const dailyMap = new Map<string, { sessions: number; uniqueUsers: Set<string>; totalMin: number }>();
  for (const entry of entries) {
    const day = entry.date;
    if (!dailyMap.has(day)) {
      dailyMap.set(day, { sessions: 0, uniqueUsers: new Set(), totalMin: 0 });
    }
    const stat = dailyMap.get(day)!;
    stat.sessions += 1;
    stat.uniqueUsers.add(entry.user_id);
    stat.totalMin += entry.duration_min ?? 0;
  }

  const dailyStats = [...dailyMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, stat]) => ({
      date,
      sessions: stat.sessions,
      unique_users: stat.uniqueUsers.size,
      total_minutes: stat.totalMin,
    }));

  // Recent entries with masked email
  const recentEntries = entries.slice(0, 20).map((e) => {
    const email = emailMap.get(e.user_id) ?? "unknown";
    const masked = email.length > 3 ? email[0] + "***" + email.slice(email.indexOf("@")) : "***";
    return {
      id: e.id,
      user_email_masked: masked,
      date: e.date,
      type: e.type,
      duration_min: e.duration_min,
      created_at: e.created_at,
    };
  });

  return NextResponse.json({
    daily_stats: dailyStats,
    recent_entries: recentEntries,
    period_days: days,
    total_entries: entries.length,
  });
}
