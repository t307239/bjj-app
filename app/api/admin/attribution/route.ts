/**
 * GET /api/admin/attribution
 *
 * z180: Attribution dashboard endpoint.
 *
 * Returns signup source breakdown:
 *   - signups by source (wiki:top / wiki:bottom / wiki:float / referral / direct / etc.)
 *   - Pro conversion rate per source
 *   - 30-day signup trend per source
 *
 * Sources tracked via profiles.signup_source (set in app/auth/callback/route.ts).
 *
 * Top app reference: Stripe Sigma の attribution report、Mixpanel の funnel。
 *
 * Auth: ADMIN_EMAIL only.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const adminLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });

function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}

interface AttributionRow {
  source: string;
  signups_total: number;
  signups_30d: number;
  pro_users: number;
  pro_conversion_pct: number;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!adminLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  // Auth
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Use service role for cross-user aggregation (bypasses RLS)
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.supabaseServiceRoleKey(),
  );

  // 1. Fetch all profiles with signup_source (or null = direct/legacy)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: profiles, error } = await service
    .from("profiles")
    .select("id, signup_source, is_pro, updated_at")
    .is("deleted_at", null);

  if (error) {
    logger.error("admin.attribution_query_failed", {}, error as Error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // 2. Aggregate by source
  const map = new Map<string, AttributionRow>();
  for (const p of profiles ?? []) {
    const source = p.signup_source ?? "direct";
    const row = map.get(source) ?? {
      source,
      signups_total: 0,
      signups_30d: 0,
      pro_users: 0,
      pro_conversion_pct: 0,
    };
    row.signups_total += 1;
    if (p.updated_at && p.updated_at > thirtyDaysAgo) {
      row.signups_30d += 1;
    }
    if (p.is_pro) row.pro_users += 1;
    map.set(source, row);
  }

  // 3. Compute conversion rate
  for (const row of map.values()) {
    row.pro_conversion_pct =
      row.signups_total > 0
        ? Math.round((row.pro_users / row.signups_total) * 1000) / 10
        : 0;
  }

  // 4. Sort by signups_total desc
  const rows = Array.from(map.values()).sort(
    (a, b) => b.signups_total - a.signups_total,
  );

  // 5. Total summary
  const total = {
    signups_all_sources: profiles?.length ?? 0,
    pro_all_sources: profiles?.filter((p) => p.is_pro).length ?? 0,
    sources_count: rows.length,
  };

  return NextResponse.json({
    ok: true,
    total,
    rows,
    fetched_at: new Date().toISOString(),
  });
}
