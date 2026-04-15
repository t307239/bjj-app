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
      return NextResponse.json(
        { status: "degraded", db: "error", error: error.message, uptime: uptimeSeconds, timestamp: new Date().toISOString() },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        db: "ok",
        dbLatencyMs,
        uptime: uptimeSeconds,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
        region: process.env.VERCEL_REGION ?? "local",
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { status: "degraded", db: "error", error: err instanceof Error ? err.message : "Unknown", uptime: uptimeSeconds, timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
