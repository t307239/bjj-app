/**
 * GET /api/health
 *
 * Q-5: Health check endpoint for uptime monitoring (UptimeRobot, etc.)
 * Checks:
 *   1. Server is alive (implicit)
 *   2. Database connection (Supabase ping)
 *
 * Returns:
 *   200 { status: "ok", db: "ok", uptime: <seconds> }
 *   503 { status: "degraded", db: "error", error: "..." }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const startTime = Date.now();

export async function GET() {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const t0 = Date.now();

  // DB connectivity check — lightweight query
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    const dbLatencyMs = Date.now() - t0;

    if (error) {
      // z169: don't leak Supabase error.message (could expose schema/policies);
      // log internally and return only a stable error code to public callers.
      logger.error("health.db_check_failed", { dbLatencyMs }, error as Error);
      return NextResponse.json(
        { status: "degraded", db: "error", code: "DB_QUERY_FAILED", uptime: uptimeSeconds, timestamp: new Date().toISOString() },
        { status: 503 },
      );
    }

    // Q-108: Classify DB latency for observability dashboards
    const dbStatus = dbLatencyMs < 200 ? "fast" : dbLatencyMs < 1000 ? "normal" : "slow";

    return NextResponse.json(
      {
        status: "ok",
        db: "ok",
        dbLatencyMs,
        dbStatus,
        uptime: uptimeSeconds,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
        region: process.env.VERCEL_REGION ?? "local",
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store", "Server-Timing": `db;dur=${dbLatencyMs}` } },
    );
  } catch (err) {
    logger.error("health.db_check_threw", {}, err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json(
      { status: "degraded", db: "error", code: "DB_CHECK_EXCEPTION", uptime: uptimeSeconds, timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
