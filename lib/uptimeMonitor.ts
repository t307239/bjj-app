/**
 * lib/uptimeMonitor.ts — Uptime monitoring utilities
 *
 * Q-139: Observability pillar — provides health check scheduling,
 * status classification, and downtime calculation utilities.
 * Works with /api/health and external monitoring services.
 *
 * @example
 *   import { classifyStatus, calculateUptime, MONITOR_ENDPOINTS } from "@/lib/uptimeMonitor";
 *   const status = classifyStatus(200, 450);
 *   const uptime = calculateUptime(checks);
 */

// ── Types ────────────────────────────────────────────────────────────────

export type ServiceStatus = "operational" | "degraded" | "partial_outage" | "major_outage";

export interface HealthCheck {
  /** Endpoint URL or name */
  endpoint: string;
  /** HTTP status code (0 if unreachable) */
  statusCode: number;
  /** Response time in ms (-1 if timeout) */
  responseTimeMs: number;
  /** ISO timestamp */
  checkedAt: string;
  /** Whether the check passed */
  healthy: boolean;
  /** Optional error message */
  error?: string;
}

export interface UptimeReport {
  /** Service name */
  service: string;
  /** Time window description */
  window: string;
  /** Total checks in the window */
  totalChecks: number;
  /** Successful checks */
  successfulChecks: number;
  /** Uptime percentage (0-100) */
  uptimePercent: number;
  /** Average response time (ms) */
  avgResponseTimeMs: number;
  /** P95 response time (ms) */
  p95ResponseTimeMs: number;
  /** Number of incidents (consecutive failures) */
  incidents: number;
  /** Total downtime in minutes */
  downtimeMinutes: number;
}

export interface StatusPage {
  /** Overall system status */
  overall: ServiceStatus;
  /** Per-service status */
  services: Array<{
    name: string;
    status: ServiceStatus;
    uptimePercent: number;
    lastChecked: string;
  }>;
  /** Active incidents */
  activeIncidents: number;
  /** Generated at */
  generatedAt: string;
}

// ── Monitor Configuration ────────────────────────────────────────────────

/**
 * Endpoints to monitor for health checks.
 */
export const MONITOR_ENDPOINTS = [
  { name: "API Health", path: "/api/health", critical: true },
  { name: "Landing Page", path: "/", critical: true },
  { name: "Login Page", path: "/login", critical: true },
  { name: "Privacy Policy", path: "/privacy", critical: false },
  { name: "Help / FAQ", path: "/help", critical: false },
] as const;

/**
 * Response time thresholds for status classification.
 */
export const RESPONSE_THRESHOLDS = {
  /** Fast response (ms) */
  fast: 500,
  /** Acceptable response (ms) */
  acceptable: 2000,
  /** Slow response (ms) */
  slow: 5000,
  /** Timeout (ms) */
  timeout: 10000,
} as const;

// ── Status Classification ────────────────────────────────────────────────

/**
 * Classify a health check result into a service status.
 */
export function classifyStatus(statusCode: number, responseTimeMs: number): ServiceStatus {
  if (statusCode === 0 || statusCode >= 500) return "major_outage";
  if (statusCode >= 400) return "partial_outage";
  if (responseTimeMs > RESPONSE_THRESHOLDS.slow) return "degraded";
  if (responseTimeMs < 0) return "major_outage"; // timeout
  return "operational";
}

/**
 * Create a health check result object.
 */
export function createHealthCheck(
  endpoint: string,
  statusCode: number,
  responseTimeMs: number,
  error?: string,
): HealthCheck {
  const healthy = statusCode >= 200 && statusCode < 400 && responseTimeMs >= 0;
  return {
    endpoint,
    statusCode,
    responseTimeMs,
    checkedAt: new Date().toISOString(),
    healthy,
    error,
  };
}

// ── Uptime Calculation ───────────────────────────────────────────────────

/**
 * Calculate uptime percentage and statistics from a series of health checks.
 */
export function calculateUptime(
  service: string,
  checks: HealthCheck[],
  windowDescription = "30d",
): UptimeReport {
  if (checks.length === 0) {
    return {
      service,
      window: windowDescription,
      totalChecks: 0,
      successfulChecks: 0,
      uptimePercent: 100, // No checks = assume healthy
      avgResponseTimeMs: 0,
      p95ResponseTimeMs: 0,
      incidents: 0,
      downtimeMinutes: 0,
    };
  }

  const successfulChecks = checks.filter((c) => c.healthy).length;
  const uptimePercent = Math.round((successfulChecks / checks.length) * 10000) / 100;

  // Response time stats (only from successful checks)
  const responseTimes = checks
    .filter((c) => c.healthy && c.responseTimeMs >= 0)
    .map((c) => c.responseTimeMs)
    .sort((a, b) => a - b);

  const avgResponseTimeMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  const p95Index = Math.floor(responseTimes.length * 0.95);
  const p95ResponseTimeMs = responseTimes.length > 0
    ? responseTimes[Math.min(p95Index, responseTimes.length - 1)]
    : 0;

  // Count incidents (consecutive failures)
  let incidents = 0;
  let inIncident = false;
  for (const check of checks) {
    if (!check.healthy && !inIncident) {
      incidents++;
      inIncident = true;
    } else if (check.healthy) {
      inIncident = false;
    }
  }

  // Estimate downtime (assume check interval is ~5 min)
  const failedChecks = checks.length - successfulChecks;
  const downtimeMinutes = failedChecks * 5;

  return {
    service,
    window: windowDescription,
    totalChecks: checks.length,
    successfulChecks,
    uptimePercent,
    avgResponseTimeMs,
    p95ResponseTimeMs,
    incidents,
    downtimeMinutes,
  };
}

// ── Status Page Generation ───────────────────────────────────────────────

/**
 * Determine overall system status from individual service statuses.
 */
export function determineOverallStatus(statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.some((s) => s === "major_outage")) return "major_outage";
  if (statuses.some((s) => s === "partial_outage")) return "partial_outage";
  if (statuses.some((s) => s === "degraded")) return "degraded";
  return "operational";
}

/**
 * Format uptime percentage for display.
 * Shows more decimal places for high uptimes (99.9% vs 95%).
 */
export function formatUptimePercent(percent: number): string {
  if (percent >= 99.9) return `${percent.toFixed(2)}%`;
  if (percent >= 99) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}
