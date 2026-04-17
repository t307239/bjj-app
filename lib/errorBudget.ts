/**
 * lib/errorBudget.ts — Error budget constants and SLO definitions
 *
 * Q-116: Observability pillar — defines Service Level Objectives (SLOs)
 * and error budget thresholds for monitoring and alerting.
 *
 * These constants are used by:
 * - /api/health (to classify response quality)
 * - smoke-test.mjs (to validate post-deploy health)
 * - Future: Sentry alert rules and dashboards
 *
 * @example
 *   import { SLO, ALERT_THRESHOLDS } from "@/lib/errorBudget";
 *   if (errorRate > SLO.ERROR_RATE_THRESHOLD) logger.warn("slo.breach", ...);
 */

/** Service Level Objectives — target uptime and performance */
export const SLO = {
  /** Target availability: 99.9% (43.8 min downtime/month) */
  AVAILABILITY_TARGET: 0.999,

  /** Error rate threshold: <0.1% of requests should fail */
  ERROR_RATE_THRESHOLD: 0.001,

  /** P95 API latency target (ms) */
  API_LATENCY_P95_MS: 2000,

  /** P99 API latency target (ms) */
  API_LATENCY_P99_MS: 5000,

  /** DB query latency classification thresholds (ms) */
  DB_LATENCY: {
    FAST: 200,
    NORMAL: 1000,
    SLOW: 5000,
  },

  /** Maximum acceptable time-to-first-byte (ms) */
  TTFB_TARGET_MS: 800,

  /** LCP target for Core Web Vitals (ms) */
  LCP_TARGET_MS: 2500,

  /** CLS target for Core Web Vitals */
  CLS_TARGET: 0.1,

  /** INP target for Core Web Vitals (ms) */
  INP_TARGET_MS: 200,
} as const;

/** Alert thresholds — when to page/notify */
export const ALERT_THRESHOLDS = {
  /** Consecutive health check failures before alerting */
  HEALTH_CHECK_FAILURES: 3,

  /** Error rate over 5-min window that triggers alert */
  ERROR_RATE_5MIN: 0.01, // 1%

  /** Slow request rate over 5-min window */
  SLOW_REQUEST_RATE_5MIN: 0.05, // 5%

  /** DB latency (ms) that triggers immediate alert */
  DB_LATENCY_CRITICAL_MS: 5000,

  /** Supabase DB size warning threshold (GB) */
  DB_SIZE_WARNING_GB: 4,

  /** Supabase DB size critical threshold (GB) */
  DB_SIZE_CRITICAL_GB: 7,

  /** DAU threshold for cost scaling alert */
  DAU_COST_ALERT: 500,

  /** Push notification failure rate threshold */
  PUSH_FAILURE_RATE: 0.1, // 10%
} as const;

/** Request ID header name for distributed tracing */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Generate a short request ID for tracing.
 * Uses crypto.randomUUID where available, falls back to timestamp.
 */
export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
