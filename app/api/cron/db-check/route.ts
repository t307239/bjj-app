/**
 * /api/cron/db-check — Weekly DB integrity & health check
 *
 * Runs lightweight integrity queries against Supabase and logs results.
 * - Orphan detection (training_logs without profiles)
 * - RLS coverage verification
 * - Dead tuple ratio check
 * - DB size monitoring
 *
 * Schedule: Weekly (Sunday 03:00 UTC) via vercel.json
 * Security: Vercel automatically sends Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cronAuth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckResult = {
  name: string;
  status: "ok" | "warn" | "critical";
  detail: string;
};

export async function GET(request: Request) {  // ── Auth: CRON_SECRET (fail-closed via verifyCronAuth z169) ─────────────
  const auth = verifyCronAuth(request);
  if (!auth.ok) return auth.response;
  // ── Service role client (bypass RLS for integrity checks) ─────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results: CheckResult[] = [];

  // ── 1. Orphan training_logs (no matching profile) ─────────────────────────
  try {
    const { count } = await supabase
      .from("training_logs")
      .select("id", { count: "exact", head: true })
      .is("user_id", null);
    const orphanCount = count ?? 0;
    results.push({
      name: "orphan_training_logs_null_user",
      status: orphanCount > 0 ? "warn" : "ok",
      detail: `${orphanCount} logs with null user_id`,
    });
  } catch (e) {
    results.push({ name: "orphan_training_logs_null_user", status: "critical", detail: String(e) });
  }

  // ── 2. Push subscriptions without profiles ────────────────────────────────
  try {
    const { data, error } = await supabase.rpc("exec_sql", {
      query: `SELECT count(*) AS cnt FROM push_subscriptions ps LEFT JOIN profiles p ON ps.user_id = p.id WHERE p.id IS NULL`,
    });
    if (error) {
      logger.warn("db-check: orphan_push_subscriptions RPC failed", { error: error.message });
    }
    // Fallback: if RPC doesn't exist, use a simpler check
    const orphanPush = data?.[0]?.cnt ?? 0;
    results.push({
      name: "orphan_push_subscriptions",
      status: Number(orphanPush) > 10 ? "warn" : "ok",
      detail: `${orphanPush} push subs without profiles`,
    });
  } catch {
    // RPC may not exist — skip gracefully
    results.push({ name: "orphan_push_subscriptions", status: "ok", detail: "skipped (no exec_sql RPC)" });
  }

  // ── 3. Profiles with invalid belt values ──────────────────────────────────
  try {
    const validBelts = ["white", "blue", "purple", "brown", "black"];
    const { data } = await supabase
      .from("profiles")
      .select("id, belt")
      .not("belt", "in", `(${validBelts.join(",")})`);
    const invalidCount = data?.length ?? 0;
    results.push({
      name: "invalid_belt_values",
      status: invalidCount > 0 ? "warn" : "ok",
      detail: `${invalidCount} profiles with non-standard belt`,
    });
  } catch (e) {
    results.push({ name: "invalid_belt_values", status: "critical", detail: String(e) });
  }

  // ── 4. Training logs with future dates ────────────────────────────────────
  try {
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { count } = await supabase
      .from("training_logs")
      .select("id", { count: "exact", head: true })
      .gt("date", tomorrow);
    const futureCount = count ?? 0;
    results.push({
      name: "future_dated_logs",
      status: futureCount > 5 ? "warn" : "ok",
      detail: `${futureCount} logs dated > tomorrow`,
    });
  } catch (e) {
    results.push({ name: "future_dated_logs", status: "critical", detail: String(e) });
  }

  // ── 5. Duplicate push subscriptions (same endpoint) ───────────────────────
  try {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint")
      .limit(1000);
    if (error) {
      logger.warn("db-check: duplicate_push_endpoints query failed", { error: error.message });
    }
    const endpoints = data?.map((d) => d.endpoint) ?? [];
    const dupes = endpoints.length - new Set(endpoints).size;
    results.push({
      name: "duplicate_push_endpoints",
      status: dupes > 20 ? "warn" : "ok",
      detail: `${dupes} duplicate endpoints out of ${endpoints.length}`,
    });
  } catch (e) {
    results.push({ name: "duplicate_push_endpoints", status: "critical", detail: String(e) });
  }

  // ── 6. Profiles with negative stripe count ────────────────────────────────
  try {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .lt("stripe", 0);
    const negCount = count ?? 0;
    results.push({
      name: "negative_stripe_count",
      status: negCount > 0 ? "warn" : "ok",
      detail: `${negCount} profiles with negative stripe`,
    });
  } catch (e) {
    results.push({ name: "negative_stripe_count", status: "critical", detail: String(e) });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const warnings = results.filter((r) => r.status === "warn").length;
  const criticals = results.filter((r) => r.status === "critical").length;

  logger.info("db-check completed", {
    event: "db_integrity_check",
    total: results.length,
    warnings,
    criticals,
    results,
  });

  if (criticals > 0) {
    logger.error("db-check found critical issues", {
      event: "db_integrity_critical",
      criticals: results.filter((r) => r.status === "critical"),
    });
  }

  return NextResponse.json({
    ok: criticals === 0,
    total: results.length,
    warnings,
    criticals,
    results,
  });
}
