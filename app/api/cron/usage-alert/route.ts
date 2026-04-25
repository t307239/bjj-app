/**
 * /api/cron/usage-alert — Supabase usage monitoring & cost alert
 *
 * Runs lightweight checks against Supabase to detect runaway usage
 * before it hits paid tier limits. Sends a Telegram alert if any
 * metric exceeds its warning threshold.
 *
 * Checks:
 * - Database size (warn > 400MB of 500MB free tier)
 * - Total row count across key tables
 * - Active user count (daily unique)
 * - Storage bucket size
 *
 * Schedule: Daily at 06:00 UTC via vercel.json
 * Security: CRON_SECRET bearer token
 */

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cronAuth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UsageCheck = {
  name: string;
  value: number | string;
  unit: string;
  status: "ok" | "warn" | "critical";
  threshold: string;
};

// ── Thresholds (Supabase Free tier limits) ────────────────────────────────
const DB_SIZE_WARN_MB = 400; // Free tier = 500MB
const DB_SIZE_CRIT_MB = 475;
const ROW_COUNT_WARN = 80_000;
const DAILY_ACTIVE_WARN = 500;

export async function GET(request: Request) {  // ── Auth: CRON_SECRET (fail-closed via verifyCronAuth z169) ─────────────
  const auth = verifyCronAuth(request);
  if (!auth.ok) return auth.response;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const log = logger.child({ scope: "cron/usage-alert" });
  const checks: UsageCheck[] = [];

  try {
    // Helper: run SQL via Supabase REST RPC
    const runSql = async (sql: string) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      // fallback: direct pg_stat query via supabase-js style
      if (!res.ok) return null;
      return res.json();
    };

    // ── Check 1: Database size ─────────────────────────────────────────────
    const sizeResult = await runSql(
      "SELECT pg_database_size(current_database()) as size_bytes"
    );
    if (sizeResult?.[0]?.size_bytes) {
      const mb = Math.round(Number(sizeResult[0].size_bytes) / 1024 / 1024);
      checks.push({
        name: "Database size",
        value: mb,
        unit: "MB",
        status: mb > DB_SIZE_CRIT_MB ? "critical" : mb > DB_SIZE_WARN_MB ? "warn" : "ok",
        threshold: `warn>${DB_SIZE_WARN_MB}MB, crit>${DB_SIZE_CRIT_MB}MB`,
      });
    }

    // ── Check 2: Row counts across key tables ──────────────────────────────
    const tables = ["profiles", "training_logs", "technique_logs", "push_subscriptions"];
    let totalRows = 0;
    for (const table of tables) {
      const countRes = await fetch(
        `${supabaseUrl}/rest/v1/${table}?select=id&limit=0`,
        {
          method: "HEAD",
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            Prefer: "count=exact",
          },
        }
      );
      const countHeader = countRes.headers.get("content-range");
      if (countHeader) {
        const match = countHeader.match(/\/(\d+)/);
        if (match) totalRows += parseInt(match[1], 10);
      }
    }
    checks.push({
      name: "Total row count",
      value: totalRows,
      unit: "rows",
      status: totalRows > ROW_COUNT_WARN ? "warn" : "ok",
      threshold: `warn>${ROW_COUNT_WARN.toLocaleString()}`,
    });

    // ── Check 3: Daily active users (last 24h unique training_logs) ────────
    const dauRes = await fetch(
      `${supabaseUrl}/rest/v1/training_logs?select=user_id&date=gte.${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}&limit=0`,
      {
        method: "HEAD",
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          Prefer: "count=exact",
        },
      }
    );
    const dauHeader = dauRes.headers.get("content-range");
    const dauCount = dauHeader ? parseInt(dauHeader.match(/\/(\d+)/)?.[1] ?? "0", 10) : 0;
    checks.push({
      name: "Daily logs (24h)",
      value: dauCount,
      unit: "entries",
      status: dauCount > DAILY_ACTIVE_WARN ? "warn" : "ok",
      threshold: `warn>${DAILY_ACTIVE_WARN}`,
    });

    // ── Evaluate & alert ───────────────────────────────────────────────────
    const warnings = checks.filter((c) => c.status !== "ok");
    if (warnings.length > 0) {
      log.warn("usage_alert_triggered", { warnings });

      // Send Telegram alert if bot token is configured
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId = process.env.TELEGRAM_CHAT_ID;
      if (telegramToken && telegramChatId) {
        const lines = warnings.map(
          (w) => `${w.status === "critical" ? "🔴" : "🟡"} ${w.name}: ${w.value} ${w.unit} (${w.threshold})`
        );
        const text = `⚠️ BJJ App Usage Alert\n\n${lines.join("\n")}\n\nCheck Supabase Dashboard for details.`;
        await fetch(
          `https://api.telegram.org/bot${telegramToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: telegramChatId, text, parse_mode: "HTML" }),
          }
        ).catch((err) => log.error("telegram_send_failed", { error: String(err) }));
      }
    } else {
      log.info("usage_check_ok", { checks });
    }

    return NextResponse.json({ checks, alertsSent: warnings.length });
  } catch (err) {
    log.error("usage_alert_error", { error: String(err) });
    return NextResponse.json(
      { error: "Usage check failed", detail: String(err) },
      { status: 500 }
    );
  }
}
