/**
 * lib/syntheticProbe.ts — Synthetic uptime probing utilities
 *
 * Q-145: Observability pillar — provides a lightweight synthetic monitoring
 * framework that can be called from Vercel Cron to probe endpoints,
 * measure response times, and alert on failures.
 *
 * Integrates with uptimeMonitor.ts for status classification and
 * alertRouter.ts for Telegram notifications.
 *
 * @example
 *   import { probeEndpoints, buildProbeReport, PROBE_CONFIG } from "@/lib/syntheticProbe";
 *   const results = await probeEndpoints(PROBE_CONFIG.endpoints);
 *   const report = buildProbeReport(results);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface ProbeEndpoint {
  /** Human-readable name */
  name: string;
  /** URL to probe */
  url: string;
  /** Expected HTTP status (default: 200) */
  expectedStatus?: number;
  /** Timeout in ms (default: 10000) */
  timeoutMs?: number;
  /** Whether this is a critical endpoint */
  critical?: boolean;
  /** Optional response body validation */
  expectBodyContains?: string;
}

export interface ProbeResult {
  /** Endpoint name */
  name: string;
  /** Probed URL */
  url: string;
  /** Whether the probe passed */
  passed: boolean;
  /** HTTP status code (0 if failed to connect) */
  statusCode: number;
  /** Response time in ms */
  responseTimeMs: number;
  /** Error message if failed */
  error?: string;
  /** Whether it's a critical endpoint */
  critical: boolean;
  /** Timestamp */
  timestamp: string;
  /** Body validation result */
  bodyValid?: boolean;
}

export interface ProbeReport {
  /** Overall health status */
  status: "healthy" | "degraded" | "down";
  /** Total endpoints probed */
  total: number;
  /** Passed probes */
  passed: number;
  /** Failed probes */
  failed: number;
  /** Average response time */
  avgResponseTimeMs: number;
  /** Slowest endpoint */
  slowest: { name: string; responseTimeMs: number } | null;
  /** Failed endpoint details */
  failures: Array<{ name: string; error: string; critical: boolean }>;
  /** Report generation timestamp */
  timestamp: string;
  /** Human-readable summary */
  summary: string;
}

export interface ProbeAlertConfig {
  /** Minimum consecutive failures before alerting */
  minConsecutiveFailures: number;
  /** Telegram bot token */
  telegramBotToken?: string;
  /** Telegram chat ID */
  telegramChatId?: string;
  /** Whether to alert on degraded (slow) responses */
  alertOnDegraded: boolean;
  /** Slow response threshold in ms */
  slowThresholdMs: number;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Default probe configuration */
export const PROBE_CONFIG = {
  /** Default timeout per endpoint */
  defaultTimeoutMs: 10_000,
  /** Default expected status */
  defaultExpectedStatus: 200,
  /** Response time thresholds */
  thresholds: {
    fast: 500,
    acceptable: 2_000,
    slow: 5_000,
  },
  /** Pre-configured endpoints for BJJ App */
  endpoints: [
    { name: "Health API", url: "/api/health", critical: true, expectedStatus: 200, expectBodyContains: '"status"' },
    { name: "Landing Page", url: "/", critical: true },
    { name: "Login Page", url: "/login", critical: true },
    { name: "Privacy Policy", url: "/privacy", critical: false },
    { name: "Help Page", url: "/help", critical: false },
  ] as ProbeEndpoint[],
} as const;

/** Default alert configuration */
export const DEFAULT_ALERT_CONFIG: ProbeAlertConfig = {
  minConsecutiveFailures: 2,
  alertOnDegraded: true,
  slowThresholdMs: 5_000,
};

// ── Probing Functions ───────────────────────────────────────────────────

/**
 * Probe a single endpoint.
 */
export async function probeSingleEndpoint(
  endpoint: ProbeEndpoint,
  baseUrl: string = "",
): Promise<ProbeResult> {
  const url = endpoint.url.startsWith("http") ? endpoint.url : `${baseUrl}${endpoint.url}`;
  const timeoutMs = endpoint.timeoutMs ?? PROBE_CONFIG.defaultTimeoutMs;
  const expectedStatus = endpoint.expectedStatus ?? PROBE_CONFIG.defaultExpectedStatus;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "BJJApp-SyntheticProbe/1.0" },
    });

    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;

    let bodyValid: boolean | undefined;
    if (endpoint.expectBodyContains) {
      try {
        const text = await response.text();
        bodyValid = text.includes(endpoint.expectBodyContains);
      } catch {
        bodyValid = false;
      }
    }

    const statusMatch = response.status === expectedStatus;
    const passed = statusMatch && (bodyValid === undefined || bodyValid);

    return {
      name: endpoint.name,
      url,
      passed,
      statusCode: response.status,
      responseTimeMs,
      critical: endpoint.critical ?? false,
      timestamp: new Date().toISOString(),
      bodyValid,
      error: !passed
        ? `Expected ${expectedStatus}, got ${response.status}${bodyValid === false ? " (body validation failed)" : ""}`
        : undefined,
    };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const message = err instanceof Error ? err.message : "Unknown error";

    return {
      name: endpoint.name,
      url,
      passed: false,
      statusCode: 0,
      responseTimeMs,
      critical: endpoint.critical ?? false,
      timestamp: new Date().toISOString(),
      error: message.includes("abort") ? `Timeout after ${timeoutMs}ms` : message,
    };
  }
}

/**
 * Probe multiple endpoints in parallel.
 */
export async function probeEndpoints(
  endpoints: readonly ProbeEndpoint[],
  baseUrl: string = "",
): Promise<ProbeResult[]> {
  const results = await Promise.all(
    endpoints.map((ep) => probeSingleEndpoint(ep, baseUrl)),
  );
  return results;
}

// ── Report Building ─────────────────────────────────────────────────────

/**
 * Build a probe report from results.
 */
export function buildProbeReport(results: ProbeResult[]): ProbeReport {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const failures = results
    .filter((r) => !r.passed)
    .map((r) => ({ name: r.name, error: r.error ?? "Unknown", critical: r.critical }));

  const avgResponseTimeMs = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.responseTimeMs, 0) / results.length)
    : 0;

  const slowest = results.length > 0
    ? results.reduce((s, r) => (r.responseTimeMs > (s?.responseTimeMs ?? 0) ? r : s), results[0])
    : null;

  const hasCriticalFailure = failures.some((f) => f.critical);
  const status: "healthy" | "degraded" | "down" = hasCriticalFailure
    ? "down"
    : failed > 0
      ? "degraded"
      : "healthy";

  const summary = formatProbeSummary(status, passed, results.length, avgResponseTimeMs, failures);

  return {
    status,
    total: results.length,
    passed,
    failed,
    avgResponseTimeMs,
    slowest: slowest ? { name: slowest.name, responseTimeMs: slowest.responseTimeMs } : null,
    failures,
    timestamp: new Date().toISOString(),
    summary,
  };
}

/**
 * Format a human-readable probe summary.
 */
export function formatProbeSummary(
  status: "healthy" | "degraded" | "down",
  passed: number,
  total: number,
  avgMs: number,
  failures: Array<{ name: string; error: string; critical: boolean }>,
): string {
  const icon = status === "healthy" ? "✅" : status === "degraded" ? "⚠️" : "🔴";
  const lines = [`${icon} ${status.toUpperCase()}: ${passed}/${total} endpoints OK (avg ${avgMs}ms)`];

  for (const f of failures) {
    lines.push(`  ${f.critical ? "🔴" : "🟡"} ${f.name}: ${f.error}`);
  }

  return lines.join("\n");
}

/**
 * Determine if an alert should be sent based on probe report.
 */
export function shouldAlert(
  report: ProbeReport,
  config: ProbeAlertConfig = DEFAULT_ALERT_CONFIG,
): boolean {
  // Always alert on critical failures
  if (report.status === "down") return true;

  // Alert on degraded if configured
  if (report.status === "degraded" && config.alertOnDegraded) return true;

  // Alert on slow responses
  if (report.avgResponseTimeMs > config.slowThresholdMs) return true;

  return false;
}

/**
 * Build a Telegram notification message from a probe report.
 */
export function buildTelegramMessage(report: ProbeReport): string {
  const icon = report.status === "healthy" ? "✅" : report.status === "degraded" ? "⚠️" : "🚨";
  const lines = [
    `${icon} BJJ App Uptime Probe`,
    `Status: ${report.status}`,
    `Endpoints: ${report.passed}/${report.total} OK`,
    `Avg Response: ${report.avgResponseTimeMs}ms`,
  ];

  if (report.failures.length > 0) {
    lines.push("Failures:");
    for (const f of report.failures) {
      lines.push(`  ${f.critical ? "CRIT" : "WARN"} ${f.name}: ${f.error}`);
    }
  }

  return lines.join("\n");
}
