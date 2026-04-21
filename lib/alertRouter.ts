/**
 * lib/alertRouter.ts — Q-124: Alert routing and severity classification
 *
 * Centralizes alert severity levels and routing decisions.
 * Determines where alerts should go based on severity and category:
 * - CRITICAL → Telegram + Sentry (immediate)
 * - WARNING → Sentry only (aggregated)
 * - INFO → Logger only (no external notification)
 *
 * Also provides uptime monitor configuration constants
 * for external monitoring services (UptimeRobot, Better Stack, etc.).
 */

import { logger } from "./logger";

// ── Alert Severity ──────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "warning" | "info";

export type AlertCategory =
  | "uptime"
  | "error_rate"
  | "latency"
  | "database"
  | "security"
  | "billing"
  | "cron_failure";

export interface Alert {
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface AlertRouteResult {
  logged: boolean;
  sentryReported: boolean;
  telegramSent: boolean;
}

// ── Uptime Monitor Configuration ────────────────────────────────────────────

export const UPTIME_MONITORS = {
  /** Primary health endpoint — must return 200 + JSON body */
  HEALTH: {
    url: "https://bjj-app.net/api/health",
    interval_seconds: 60,
    timeout_ms: 10000,
    expected_status: 200,
    keyword: '"status":"ok"',
  },
  /** Landing page — basic availability check */
  LANDING: {
    url: "https://bjj-app.net",
    interval_seconds: 300,
    timeout_ms: 15000,
    expected_status: 200,
  },
  /** Login page availability */
  LOGIN: {
    url: "https://bjj-app.net/login",
    interval_seconds: 300,
    timeout_ms: 15000,
    expected_status: 200,
  },
  /** Wiki availability */
  WIKI: {
    url: "https://wiki.bjj-app.net",
    interval_seconds: 300,
    timeout_ms: 15000,
    expected_status: 200,
  },
} as const;

// ── Alert Routing Logic ─────────────────────────────────────────────────────

/**
 * Determine if an alert should be sent to Telegram.
 * Only CRITICAL alerts go to Telegram to avoid alert fatigue.
 */
function shouldNotifyTelegram(alert: Alert): boolean {
  if (alert.severity === "critical") return true;
  // High-priority warnings for specific categories
  if (alert.severity === "warning" && alert.category === "security") return true;
  return false;
}

/**
 * Determine if an alert should be reported to Sentry.
 * WARNING and CRITICAL go to Sentry.
 */
function shouldReportSentry(alert: Alert): boolean {
  return alert.severity !== "info";
}

/**
 * Send a Telegram notification via bot API.
 * Returns true if sent successfully, false otherwise.
 */
async function sendTelegramAlert(alert: Alert): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const icon = alert.severity === "critical" ? "🚨" : "⚠️";
  const text = [
    `${icon} *${alert.severity.toUpperCase()}*: ${alert.title}`,
    "",
    alert.message,
    "",
    `Category: ${alert.category}`,
    `Time: ${alert.timestamp ?? new Date().toISOString()}`,
  ].join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    return res.ok;
  } catch (err: unknown) {
    logger.warn("telegram_send_failed", { chatId, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/**
 * Route an alert to the appropriate channels based on severity and category.
 */
export async function routeAlert(alert: Alert): Promise<AlertRouteResult> {
  const enrichedAlert = {
    ...alert,
    timestamp: alert.timestamp ?? new Date().toISOString(),
  };

  const result: AlertRouteResult = {
    logged: false,
    sentryReported: false,
    telegramSent: false,
  };

  // Always log
  const logData = {
    category: enrichedAlert.category,
    ...enrichedAlert.metadata,
  };

  if (enrichedAlert.severity === "critical") {
    logger.error(`alert.${enrichedAlert.category}`, logData, new Error(enrichedAlert.title));
  } else if (enrichedAlert.severity === "warning") {
    logger.warn(`alert.${enrichedAlert.category}`, logData);
  } else {
    logger.info(`alert.${enrichedAlert.category}`, logData);
  }
  result.logged = true;

  // Sentry (via logger.error which auto-forwards)
  result.sentryReported = shouldReportSentry(enrichedAlert);

  // Telegram
  if (shouldNotifyTelegram(enrichedAlert)) {
    result.telegramSent = await sendTelegramAlert(enrichedAlert);
  }

  return result;
}

/**
 * Convenience: create and route a CRITICAL alert.
 */
export async function alertCritical(
  category: AlertCategory,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<AlertRouteResult> {
  return routeAlert({ severity: "critical", category, title, message, metadata });
}

/**
 * Convenience: create and route a WARNING alert.
 */
export async function alertWarning(
  category: AlertCategory,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<AlertRouteResult> {
  return routeAlert({ severity: "warning", category, title, message, metadata });
}
