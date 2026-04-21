/**
 * clientLogger.ts — Client-side error/warn reporter with Sentry forwarding
 *
 * Lightweight wrapper for "use client" components. Mirrors the server-side
 * logger API (event + meta + err) but uses Sentry client SDK directly.
 *
 * Unlike lib/logger.ts (server-only, uses process.env.VERCEL_ENV),
 * this module is safe for browser bundles.
 *
 * @module clientLogger
 * @since Q-233 (§21 Obs: client console.error → Sentry migration)
 */

import * as Sentry from "@sentry/nextjs";

type ClientLogLevel = "warn" | "error";

function report(
  level: ClientLogLevel,
  event: string,
  meta: Record<string, unknown> = {},
  err?: unknown,
): void {
  // Forward to Sentry (no-op if DSN not configured or in dev)
  if (level === "error") {
    if (err instanceof Error) {
      Sentry.captureException(err, { tags: { event }, extra: meta });
    } else {
      Sentry.captureMessage(`[${event}] ${err ?? "unknown error"}`, {
        level: "error",
        tags: { event },
        extra: meta,
      });
    }
  } else if (level === "warn") {
    Sentry.captureMessage(`[${event}] warning`, {
      level: "warning",
      tags: { event },
      extra: meta,
    });
  }

  // Also log to console for dev visibility
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
    ...(err instanceof Error
      ? { error: { message: err.message, name: err.name } }
      : err !== undefined
        ? { error: String(err) }
        : {}),
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.warn(JSON.stringify(entry));
  }
}

export const clientLogger = {
  warn: (event: string, meta: Record<string, unknown> = {}) =>
    report("warn", event, meta),
  error: (event: string, meta: Record<string, unknown> = {}, err?: unknown) =>
    report("error", event, meta, err),
};
