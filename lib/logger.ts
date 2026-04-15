/**
 * Structured JSON logger — server-side only (Node.js / Edge runtime)
 * Zero new dependencies. Outputs newline-delimited JSON for log aggregators.
 *
 * Q-25: Sentry integration — logger.error and logger.warn automatically
 * forward to Sentry for real-time alerting in production.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("user.login", { userId: "abc" });
 *   logger.error("api.delete", { userId: "abc" }, err);
 */

import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts: string;          // ISO-8601 timestamp
  level: LogLevel;
  event: string;       // dot-namespaced event key, e.g. "account.delete"
  env: string;         // "production" | "preview" | "development"
  [key: string]: unknown;
}

function write(level: LogLevel, event: string, meta: Record<string, unknown>, err?: unknown): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    ...meta,
  };

  if (err instanceof Error) {
    entry.error = {
      message: err.message,
      name: err.name,
      // stack only in non-production to avoid leaking internals
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    };
  } else if (err !== undefined) {
    entry.error = String(err);
  }

  const line = JSON.stringify(entry);

  // Q-25: Forward errors/warnings to Sentry for real-time alerting
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

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug: (event: string, meta: Record<string, unknown> = {}) => write("debug", event, meta),
  info:  (event: string, meta: Record<string, unknown> = {}) => write("info",  event, meta),
  warn:  (event: string, meta: Record<string, unknown> = {}) => write("warn",  event, meta),
  error: (event: string, meta: Record<string, unknown> = {}, err?: unknown) => write("error", event, meta, err),
};

/**
 * Client-safe error logger for "use client" components / error boundaries.
 * Emits structured JSON to console (captured by Vercel runtime on server-rendered pages).
 */
export function logClientError(event: string, err: unknown, meta: Record<string, unknown> = {}): void {
  const entry = {
    ts: new Date().toISOString(),
    level: "error" as const,
    event,
    ...meta,
    error: err instanceof Error
      ? { message: err.message, name: err.name }
      : String(err),
  };
  console.error(JSON.stringify(entry));
}
