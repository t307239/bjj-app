/**
 * cronAuth — fail-closed CRON_SECRET verification helper.
 *
 * All `app/api/cron/*` endpoints must use `verifyCronAuth(req)` so that:
 *   - If CRON_SECRET is unset, the endpoint REJECTS requests (config error → 500).
 *   - If the Authorization header doesn't match, returns 401.
 *
 * This replaces the old fail-open pattern:
 *   ```ts
 *   if (cronSecret) {              // ❌ if env var missing, no auth!
 *     if (auth !== `Bearer …`) return 401;
 *   }
 *   ```
 *
 * z169 (Day 6_237): 7 cron endpoints had the fail-open pattern — anyone
 * could trigger weekly-email / reengagement / usage-alert / weekly-goal /
 * gym-milestone / backup-verify / db-check and spam users with emails or
 * trigger DB introspection. Fixed by replacing all 7 sites with this helper.
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export type CronAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

export function verifyCronAuth(req: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: missing secret means we cannot verify; reject all callers.
    logger.error(
      "cron.missing_secret",
      { url: new URL(req.url).pathname },
      new Error("CRON_SECRET env var not set"),
    );
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Server misconfigured: CRON_SECRET not set" },
        { status: 500 },
      ),
    };
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true };
}
