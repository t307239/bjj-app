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

// z192: separate paid attribution (paid_ref ≠ signup_source の可能性あり)
interface PaidAttributionRow {
  paid_ref: string;
  paid_count: number;
  b2c_pro: number;
  b2b_gym: number;
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
    .select("id, signup_source, is_pro, updated_at, paid_ref, paid_plan, paid_at")
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

  // 5. z192: Paid attribution (paid_ref ベース)
  const paidMap = new Map<string, PaidAttributionRow>();
  for (const p of profiles ?? []) {
    if (!p.paid_ref || !p.is_pro) continue;
    const ref = p.paid_ref;
    const r = paidMap.get(ref) ?? {
      paid_ref: ref,
      paid_count: 0,
      b2c_pro: 0,
      b2b_gym: 0,
    };
    r.paid_count += 1;
    if (p.paid_plan === "b2b_gym") r.b2b_gym += 1;
    else r.b2c_pro += 1;
    paidMap.set(ref, r);
  }
  const paidRows = Array.from(paidMap.values()).sort(
    (a, b) => b.paid_count - a.paid_count,
  );

  // 6. Total summary
  const total = {
    signups_all_sources: profiles?.length ?? 0,
    pro_all_sources: profiles?.filter((p) => p.is_pro).length ?? 0,
    sources_count: rows.length,
    paid_sources_count: paidRows.length,
  };

  // z255rrr: Wiki funnel rate — aggregate all `signup_source LIKE 'wiki:%'`
  // to surface SEO funnel ROI at a glance (not buried in per-source rows).
  const wikiProfiles = (profiles ?? []).filter(
    (p) => typeof p.signup_source === "string" && p.signup_source.startsWith("wiki:"),
  );
  const wikiTotalSignups = wikiProfiles.length;
  const wikiPro = wikiProfiles.filter((p) => p.is_pro).length;
  const wikiSignups30d = wikiProfiles.filter(
    (p) => p.updated_at && p.updated_at > thirtyDaysAgo,
  ).length;
  const directProfiles = (profiles ?? []).filter(
    (p) => !p.signup_source || p.signup_source === "direct",
  );
  const directTotal = directProfiles.length;
  const directPro = directProfiles.filter((p) => p.is_pro).length;
  const wiki_funnel = {
    wiki_signups_total: wikiTotalSignups,
    wiki_signups_30d: wikiSignups30d,
    wiki_pro_users: wikiPro,
    wiki_pro_conversion_pct:
      wikiTotalSignups > 0
        ? Math.round((wikiPro / wikiTotalSignups) * 1000) / 10
        : 0,
    direct_total: directTotal,
    direct_pro_users: directPro,
    direct_pro_conversion_pct:
      directTotal > 0 ? Math.round((directPro / directTotal) * 1000) / 10 : 0,
    // Top wiki pages by signup (groups wiki:X by the X portion)
    top_wiki_pages: Object.entries(
      wikiProfiles.reduce<Record<string, number>>((acc, p) => {
        const slug = p.signup_source?.replace(/^wiki:/, "") ?? "unknown";
        acc[slug] = (acc[slug] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([slug, count]) => ({ slug, count })),
  };

  return NextResponse.json({
    ok: true,
    total,
    rows,
    paid_rows: paidRows,
    wiki_funnel,
    fetched_at: new Date().toISOString(),
  });
}
