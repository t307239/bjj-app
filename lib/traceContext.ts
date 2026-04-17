/**
 * lib/traceContext.ts — Distributed tracing context utilities
 *
 * Q-160: Obs pillar — provides W3C Trace Context compatible
 * trace/span ID generation, context propagation helpers,
 * and request correlation for observability improvements.
 *
 * Pure utility layer — no DB access, no UI.
 *
 * @example
 *   import { createTraceContext, createSpan, TRACEPARENT_HEADER } from "@/lib/traceContext";
 *   const ctx = createTraceContext();
 *   const span = createSpan(ctx, "db.query");
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface TraceContext {
  /** Trace ID (32 hex chars) */
  traceId: string;
  /** Span ID (16 hex chars) */
  spanId: string;
  /** Trace flags (sampled, etc.) */
  flags: TraceFlags;
  /** Parent span ID */
  parentSpanId: string | null;
  /** Baggage items (key-value metadata) */
  baggage: Record<string, string>;
}

export interface Span {
  /** Span ID (16 hex chars) */
  spanId: string;
  /** Parent span ID */
  parentSpanId: string;
  /** Trace ID */
  traceId: string;
  /** Operation name */
  operationName: string;
  /** Start time (ISO) */
  startTime: string;
  /** End time (ISO, null if in-progress) */
  endTime: string | null;
  /** Duration in ms (null if in-progress) */
  durationMs: number | null;
  /** Span status */
  status: SpanStatus;
  /** Attributes */
  attributes: Record<string, string | number | boolean>;
}

export type TraceFlags = {
  /** Whether this trace is sampled */
  sampled: boolean;
};

export type SpanStatus = "ok" | "error" | "unset";

export interface TraceMetrics {
  /** Total spans */
  totalSpans: number;
  /** Error spans */
  errorSpans: number;
  /** Average duration */
  avgDurationMs: number;
  /** P95 duration */
  p95DurationMs: number;
  /** Spans by status */
  byStatus: Record<SpanStatus, number>;
}

// ── Constants ────────────────────────────────────────────────────────────

/** W3C Trace Context header name */
export const TRACEPARENT_HEADER = "traceparent";

/** W3C Baggage header name */
export const BAGGAGE_HEADER = "baggage";

/** Trace Context version */
export const TRACE_VERSION = "00";

/** Default sample rate (1 = 100%) */
export const DEFAULT_SAMPLE_RATE = 1.0;

/** Max baggage items */
export const MAX_BAGGAGE_ITEMS = 64;

/** Max baggage value length */
export const MAX_BAGGAGE_VALUE_LENGTH = 256;

// ── ID Generation ───────────────────────────────────────────────────────

/**
 * Generate a random hex string of given byte length.
 */
export function generateHexId(bytes: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Generate a trace ID (16 bytes = 32 hex chars).
 */
export function generateTraceId(): string {
  return generateHexId(16);
}

/**
 * Generate a span ID (8 bytes = 16 hex chars).
 */
export function generateSpanId(): string {
  return generateHexId(8);
}

// ── Context ─────────────────────────────────────────────────────────────

/**
 * Create a new trace context.
 */
export function createTraceContext(
  options: { sampled?: boolean; baggage?: Record<string, string> } = {},
): TraceContext {
  return {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    flags: { sampled: options.sampled ?? true },
    parentSpanId: null,
    baggage: options.baggage ?? {},
  };
}

/**
 * Create a child span from a trace context.
 */
export function createSpan(
  ctx: TraceContext,
  operationName: string,
  attributes: Record<string, string | number | boolean> = {},
): Span {
  return {
    spanId: generateSpanId(),
    parentSpanId: ctx.spanId,
    traceId: ctx.traceId,
    operationName,
    startTime: new Date().toISOString(),
    endTime: null,
    durationMs: null,
    status: "unset",
    attributes,
  };
}

/**
 * End a span.
 */
export function endSpan(
  span: Span,
  status: SpanStatus = "ok",
): Span {
  const endTime = new Date().toISOString();
  const durationMs = new Date(endTime).getTime() - new Date(span.startTime).getTime();
  return {
    ...span,
    endTime,
    durationMs,
    status,
  };
}

// ── W3C Trace Context ───────────────────────────────────────────────────

/**
 * Format a traceparent header value.
 * Format: {version}-{traceId}-{spanId}-{flags}
 */
export function formatTraceparent(ctx: TraceContext): string {
  const flags = ctx.flags.sampled ? "01" : "00";
  return `${TRACE_VERSION}-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

/**
 * Parse a traceparent header value.
 */
export function parseTraceparent(header: string): TraceContext | null {
  const parts = header.split("-");
  if (parts.length !== 4) return null;

  const [version, traceId, spanId, flags] = parts;

  if (version !== TRACE_VERSION) return null;
  if (traceId.length !== 32 || !/^[0-9a-f]+$/.test(traceId)) return null;
  if (spanId.length !== 16 || !/^[0-9a-f]+$/.test(spanId)) return null;
  if (flags.length !== 2) return null;

  return {
    traceId,
    spanId,
    flags: { sampled: flags === "01" },
    parentSpanId: null,
    baggage: {},
  };
}

/**
 * Format baggage header value.
 */
export function formatBaggage(baggage: Record<string, string>): string {
  return Object.entries(baggage)
    .slice(0, MAX_BAGGAGE_ITEMS)
    .map(([k, v]) => `${k}=${v.slice(0, MAX_BAGGAGE_VALUE_LENGTH)}`)
    .join(",");
}

/**
 * Parse baggage header value.
 */
export function parseBaggage(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  const items = header.split(",").slice(0, MAX_BAGGAGE_ITEMS);
  for (const item of items) {
    const eqIdx = item.indexOf("=");
    if (eqIdx > 0) {
      const key = item.slice(0, eqIdx).trim();
      const value = item.slice(eqIdx + 1).trim();
      if (key) result[key] = value;
    }
  }
  return result;
}

// ── Metrics ─────────────────────────────────────────────────────────────

/**
 * Calculate trace metrics from spans.
 */
export function calculateTraceMetrics(spans: Span[]): TraceMetrics {
  const byStatus: Record<SpanStatus, number> = { ok: 0, error: 0, unset: 0 };
  const durations: number[] = [];

  for (const span of spans) {
    byStatus[span.status]++;
    if (span.durationMs !== null) {
      durations.push(span.durationMs);
    }
  }

  durations.sort((a, b) => a - b);

  const avgDurationMs = durations.length > 0
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length
    : 0;

  const p95Index = Math.floor(durations.length * 0.95);
  const p95DurationMs = durations.length > 0 ? durations[Math.min(p95Index, durations.length - 1)] : 0;

  return {
    totalSpans: spans.length,
    errorSpans: byStatus.error,
    avgDurationMs,
    p95DurationMs,
    byStatus,
  };
}

/**
 * Format trace metrics as human-readable string.
 */
export function formatTraceMetrics(metrics: TraceMetrics): string {
  return [
    `🔍 Trace Metrics: ${metrics.totalSpans} spans`,
    `   Errors: ${metrics.errorSpans} (${metrics.totalSpans > 0 ? ((metrics.errorSpans / metrics.totalSpans) * 100).toFixed(1) : 0}%)`,
    `   Avg: ${metrics.avgDurationMs.toFixed(0)}ms | P95: ${metrics.p95DurationMs.toFixed(0)}ms`,
  ].join("\n");
}
