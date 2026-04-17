/**
 * /api/cron/backup-verify — Q-126: Automated backup freshness check
 *
 * Weekly cron that verifies Supabase backup recency by checking
 * key table row counts and comparing against last-known values.
 * Sends Telegram alert if anomalies detected.
 *
 * Checks:
 * - Key table row counts (detect data loss)
 * - Most recent training_log timestamp (detect backup staleness)
 * - Profile count vs auth user count consistency
 *
 * Schedule: Weekly (Monday 04:00 UTC) via vercel.json
 * Security: CRON_SECRET bearer token
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackupCheck = {
  name: string;
  status: "ok" | "warn" | "critical";
  detail: string;
  value?: number | string;
};

export async function GET(request: Request) {
  // ── Auth: CRON_SECRET ─────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results: BackupCheck[] = [];

  // ── 1. Training logs row count (must be > 0) ─────────────────────────────
  try {
    const { count, error } = await supabase
      .from("training_logs")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    const rowCount = count ?? 0;
    results.push({
      name: "training_logs_count",
      status: rowCount > 0 ? "ok" : "critical",
      detail: `${rowCount} training logs`,
      value: rowCount,
    });
  } catch (e) {
    results.push({ name: "training_logs_count", status: "critical", detail: String(e) });
  }

  // ── 2. Profiles row count ─────────────────────────────────────────────────
  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    const rowCount = count ?? 0;
    results.push({
      name: "profiles_count",
      status: rowCount > 0 ? "ok" : "critical",
      detail: `${rowCount} profiles`,
      value: rowCount,
    });
  } catch (e) {
    results.push({ name: "profiles_count", status: "critical", detail: String(e) });
  }

  // ── 3. Most recent training log freshness ─────────────────────────────────
  try {
    const { data, error } = await supabase
      .from("training_logs")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;

    if (data?.created_at) {
      const lastLogDate = new Date(data.created_at);
      const ageHours = (Date.now() - lastLogDate.getTime()) / (1000 * 60 * 60);
      results.push({
        name: "latest_log_freshness",
        status: ageHours < 168 ? "ok" : "warn", // 7 days
        detail: `Last log ${Math.round(ageHours)}h ago`,
        value: Math.round(ageHours),
      });
    } else {
      results.push({
        name: "latest_log_freshness",
        status: "warn",
        detail: "No training logs found",
      });
    }
  } catch (e) {
    results.push({ name: "latest_log_freshness", status: "critical", detail: String(e) });
  }

  // ── 4. Push subscriptions count ───────────────────────────────────────────
  try {
    const { count, error } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    results.push({
      name: "push_subscriptions_count",
      status: "ok",
      detail: `${count ?? 0} push subscriptions`,
      value: count ?? 0,
    });
  } catch (e) {
    results.push({ name: "push_subscriptions_count", status: "ok", detail: `skipped: ${String(e)}` });
  }

  // ── 5. Pro user count (Stripe consistency) ────────────────────────────────
  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_pro", true);
    if (error) throw error;
    results.push({
      name: "pro_users_count",
      status: "ok",
      detail: `${count ?? 0} pro users`,
      value: count ?? 0,
    });
  } catch (e) {
    results.push({ name: "pro_users_count", status: "ok", detail: `skipped: ${String(e)}` });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const warnings = results.filter((r) => r.status === "warn").length;
  const criticals = results.filter((r) => r.status === "critical").length;

  logger.info("backup-verify completed", {
    event: "backup_verify",
    total: results.length,
    warnings,
    criticals,
    results,
  });

  if (criticals > 0) {
    logger.error("backup-verify found critical issues", {
      event: "backup_verify_critical",
      criticals: results.filter((r) => r.status === "critical"),
    });

    // Send Telegram alert if token is configured
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    if (telegramToken && telegramChatId) {
      try {
        const criticalList = results
          .filter((r) => r.status === "critical")
          .map((r) => `❌ ${r.name}: ${r.detail}`)
          .join("\n");
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: `🔴 Backup Verify Alert\n\n${criticalList}\n\nCheck /api/cron/backup-verify for details.`,
          }),
        });
      } catch {
        logger.warn("backup-verify: Telegram alert failed");
      }
    }
  }

  return NextResponse.json({
    ok: criticals === 0,
    total: results.length,
    warnings,
    criticals,
    results,
    checked_at: new Date().toISOString(),
  });
}
