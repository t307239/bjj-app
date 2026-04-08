import { NextResponse } from "next/server";

/**
 * /api/cron/gym-milestone
 *
 * Called daily by Vercel Cron (see vercel.json: "0 10 * * *" = 10:00 UTC).
 * Proxies to the Supabase Edge Function `gym-milestone-email`.
 *
 * Security: Vercel automatically sends Authorization: Bearer <CRON_SECRET>
 * on scheduled invocations. We verify it to prevent unauthorized triggers.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase env vars not configured" },
      { status: 500 }
    );
  }

  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/gym-milestone-email`;

  try {
    const res = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });

    const body = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, status: res.status, body });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
