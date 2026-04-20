/**
 * Q-219: External Monitor Integration — UptimeRobot/Checkly/Telegram integration
 *
 * Standardizes integration with external monitoring services.
 * Provides webhook handlers and status page data structures
 * for connecting /api/health with external uptime monitors.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MonitorProvider = "uptimerobot" | "checkly" | "pingdom" | "betteruptime" | "custom";
export type MonitorStatus = "up" | "down" | "degraded" | "maintenance" | "unknown";
export type AlertChannel = "telegram" | "email" | "slack" | "webhook";

export interface MonitorEndpoint {
  /** Display name */
  name: string;
  /** URL to monitor */
  url: string;
  /** Check interval in seconds */
  intervalSeconds: number;
  /** Expected status code */
  expectedStatusCode: number;
  /** Timeout in ms */
  timeoutMs: number;
  /** Tags for grouping */
  tags: string[];
}

export interface MonitorConfig {
  provider: MonitorProvider;
  endpoints: MonitorEndpoint[];
  alertChannels: AlertChannelConfig[];
  statusPageUrl?: string;
}

export interface AlertChannelConfig {
  type: AlertChannel;
  /** Telegram chat ID, Slack webhook URL, email address, etc. */
  target: string;
  /** Minimum severity to trigger */
  minSeverity: "info" | "warning" | "critical";
}

export interface HealthCheckResult {
  endpoint: string;
  status: MonitorStatus;
  responseTimeMs: number;
  statusCode: number;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface StatusPageData {
  /** Overall system status */
  status: MonitorStatus;
  /** Last updated timestamp */
  lastUpdated: string;
  /** Individual component statuses */
  components: StatusComponent[];
  /** Active incidents */
  incidents: StatusIncident[];
  /** Uptime percentage (last 30 days) */
  uptimePercent: number;
}

export interface StatusComponent {
  name: string;
  status: MonitorStatus;
  responseTimeMs?: number;
  lastChecked: string;
}

export interface StatusIncident {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical";
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface WebhookPayload {
  provider: MonitorProvider;
  event: "down" | "up" | "degraded";
  endpoint: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BJJ_APP_ENDPOINTS: MonitorEndpoint[] = [
  {
    name: "Health API",
    url: "https://bjj-app.net/api/health",
    intervalSeconds: 60,
    expectedStatusCode: 200,
    timeoutMs: 5000,
    tags: ["api", "critical"],
  },
  {
    name: "Landing Page",
    url: "https://bjj-app.net",
    intervalSeconds: 300,
    expectedStatusCode: 200,
    timeoutMs: 10000,
    tags: ["web", "critical"],
  },
  {
    name: "Login Page",
    url: "https://bjj-app.net/login",
    intervalSeconds: 300,
    expectedStatusCode: 200,
    timeoutMs: 10000,
    tags: ["web", "auth"],
  },
  {
    name: "Wiki",
    url: "https://wiki.bjj-app.net",
    intervalSeconds: 600,
    expectedStatusCode: 200,
    timeoutMs: 10000,
    tags: ["web", "wiki"],
  },
  {
    name: "Privacy Policy",
    url: "https://bjj-app.net/privacy",
    intervalSeconds: 3600,
    expectedStatusCode: 200,
    timeoutMs: 10000,
    tags: ["web", "legal"],
  },
];

/** Response time thresholds (ms) */
const RESPONSE_THRESHOLDS = {
  fast: 500,
  normal: 2000,
  slow: 5000,
} as const;

// ---------------------------------------------------------------------------
// Configuration builders
// ---------------------------------------------------------------------------

/**
 * Build the default monitoring configuration for BJJ App.
 */
export function buildDefaultConfig(
  telegramChatId?: string,
  alertEmail?: string
): MonitorConfig {
  const channels: AlertChannelConfig[] = [];

  if (telegramChatId) {
    channels.push({
      type: "telegram",
      target: telegramChatId,
      minSeverity: "warning",
    });
  }
  if (alertEmail) {
    channels.push({
      type: "email",
      target: alertEmail,
      minSeverity: "critical",
    });
  }

  return {
    provider: "custom",
    endpoints: BJJ_APP_ENDPOINTS,
    alertChannels: channels,
    statusPageUrl: "https://bjj-app.net/api/health",
  };
}

/**
 * Generate UptimeRobot-compatible monitor configuration.
 * Use for importing into UptimeRobot dashboard.
 */
export function generateUptimeRobotConfig(
  config: MonitorConfig
): Array<{
  friendly_name: string;
  url: string;
  type: number;
  interval: number;
  timeout: number;
}> {
  return config.endpoints.map((ep) => ({
    friendly_name: ep.name,
    url: ep.url,
    type: 1, // HTTP(s) monitor
    interval: ep.intervalSeconds,
    timeout: Math.ceil(ep.timeoutMs / 1000),
  }));
}

// ---------------------------------------------------------------------------
// Health check processing
// ---------------------------------------------------------------------------

/**
 * Classify a health check response into a status.
 */
export function classifyHealthStatus(
  statusCode: number,
  responseTimeMs: number,
  expectedStatusCode: number
): MonitorStatus {
  if (statusCode !== expectedStatusCode) return "down";
  if (responseTimeMs > RESPONSE_THRESHOLDS.slow) return "degraded";
  return "up";
}

/**
 * Process a batch of health check results into status page data.
 */
export function buildStatusPage(
  results: HealthCheckResult[],
  incidents: StatusIncident[] = []
): StatusPageData {
  const components: StatusComponent[] = results.map((r) => ({
    name: r.endpoint,
    status: r.status,
    responseTimeMs: r.responseTimeMs,
    lastChecked: r.timestamp,
  }));

  // Overall status: worst of all components
  const statusPriority: MonitorStatus[] = [
    "down",
    "degraded",
    "maintenance",
    "up",
    "unknown",
  ];
  const worstStatus = statusPriority.find((s) =>
    components.some((c) => c.status === s)
  ) ?? "unknown";

  // Calculate uptime from results (simplified: up count / total)
  const upCount = results.filter((r) => r.status === "up").length;
  const uptimePercent =
    results.length > 0 ? Math.round((upCount / results.length) * 1000) / 10 : 100;

  return {
    status: worstStatus,
    lastUpdated: new Date().toISOString(),
    components,
    incidents: incidents.filter((i) => i.status !== "resolved"),
    uptimePercent,
  };
}

// ---------------------------------------------------------------------------
// Webhook parsing
// ---------------------------------------------------------------------------

/**
 * Parse an incoming webhook from UptimeRobot.
 */
export function parseUptimeRobotWebhook(body: Record<string, unknown>): WebhookPayload | null {
  try {
    const alertType = body.alertType as number;
    const event: WebhookPayload["event"] =
      alertType === 1 ? "down" : alertType === 2 ? "up" : "degraded";

    return {
      provider: "uptimerobot",
      event,
      endpoint: (body.monitorFriendlyName as string) ?? "Unknown",
      statusCode: (body.alertDetails as number) ?? 0,
      responseTimeMs: 0,
      timestamp: new Date().toISOString(),
      message: `${body.monitorFriendlyName} is ${event}`,
    };
  } catch {
    return null;
  }
}

/**
 * Parse a generic webhook payload.
 */
export function parseWebhookPayload(
  provider: MonitorProvider,
  body: Record<string, unknown>
): WebhookPayload | null {
  if (provider === "uptimerobot") return parseUptimeRobotWebhook(body);
  // Generic fallback
  return {
    provider,
    event: (body.event as WebhookPayload["event"]) ?? "down",
    endpoint: (body.endpoint as string) ?? "Unknown",
    statusCode: (body.statusCode as number) ?? 0,
    responseTimeMs: (body.responseTimeMs as number) ?? 0,
    timestamp: new Date().toISOString(),
    message: (body.message as string) ?? "Monitor alert",
  };
}

// ---------------------------------------------------------------------------
// Alert formatting
// ---------------------------------------------------------------------------

/**
 * Format a Telegram alert message from a webhook payload.
 */
export function formatTelegramAlert(payload: WebhookPayload): string {
  const emoji = payload.event === "down" ? "\u{1F534}" : payload.event === "up" ? "\u{1F7E2}" : "\u{1F7E1}";
  return [
    `${emoji} *BJJ App Monitor*`,
    "",
    `*Endpoint:* ${payload.endpoint}`,
    `*Status:* ${payload.event.toUpperCase()}`,
    `*Status Code:* ${payload.statusCode}`,
    `*Time:* ${payload.timestamp}`,
    payload.message ? `*Message:* ${payload.message}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Format status page data as a human-readable string.
 */
export function formatStatusPage(data: StatusPageData): string {
  const statusEmoji: Record<MonitorStatus, string> = {
    up: "\u{2705}",
    down: "\u{274C}",
    degraded: "\u{26A0}\u{FE0F}",
    maintenance: "\u{1F527}",
    unknown: "\u{2753}",
  };

  const lines: string[] = [
    `System Status: ${statusEmoji[data.status]} ${data.status.toUpperCase()}`,
    `Uptime: ${data.uptimePercent}%`,
    `Last updated: ${data.lastUpdated}`,
    "",
    "Components:",
    ...data.components.map(
      (c) =>
        `  ${statusEmoji[c.status]} ${c.name} (${c.responseTimeMs ?? "?"}ms)`
    ),
  ];

  if (data.incidents.length > 0) {
    lines.push("", "Active Incidents:");
    for (const inc of data.incidents) {
      lines.push(`  [${inc.severity}] ${inc.title} - ${inc.status}`);
    }
  }

  return lines.join("\n");
}
