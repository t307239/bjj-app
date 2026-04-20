/**
 * Q-220: Error Recovery Patterns — standardized retry/fallback strategies
 *
 * Provides typed, composable error recovery strategies for both
 * API calls and UI interactions. Includes exponential backoff,
 * circuit breaker, graceful degradation, and fallback chains.
 *
 * @example
 * const data = await withRetry(() => fetchData(), {
 *   maxRetries: 3,
 *   strategy: "exponential",
 * });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RetryStrategy = "fixed" | "linear" | "exponential" | "jitter";

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in ms */
  baseDelayMs: number;
  /** Maximum delay cap in ms */
  maxDelayMs: number;
  /** Backoff strategy */
  strategy: RetryStrategy;
  /** Which errors should trigger a retry */
  retryableErrors?: (error: unknown) => boolean;
  /** Called before each retry */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface RetryResult<T> {
  data: T;
  attempts: number;
  totalDelayMs: number;
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms to wait before attempting half-open */
  resetTimeoutMs: number;
  /** Number of successes in half-open to close the circuit */
  successThreshold: number;
  /** Called when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export interface FallbackChainConfig<T> {
  /** Ordered list of fallback functions */
  chain: Array<{
    name: string;
    fn: () => Promise<T> | T;
    timeout?: number;
  }>;
  /** Called when a fallback is used */
  onFallback?: (name: string, index: number, error: unknown) => void;
}

export interface GracefulDegradationConfig<T> {
  /** Primary operation */
  primary: () => Promise<T>;
  /** Degraded mode operation (simpler but more reliable) */
  degraded: () => Promise<T>;
  /** Minimal mode (cached/static data) */
  minimal: () => T;
  /** Health check to determine which mode to use */
  healthCheck?: () => Promise<boolean>;
}

export interface ErrorRecoveryAudit {
  totalOperations: number;
  successOnFirstTry: number;
  successAfterRetry: number;
  failedAfterRetry: number;
  circuitBreakerTrips: number;
  fallbacksUsed: number;
  avgRetriesPerOperation: number;
  score: number;
  grade: string;
}

// ---------------------------------------------------------------------------
// Default configs
// ---------------------------------------------------------------------------

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  strategy: "exponential",
};

const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  successThreshold: 2,
};

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

/**
 * Execute an async operation with automatic retry.
 *
 * @example
 * const result = await withRetry(() => fetch("/api/data"), {
 *   maxRetries: 3,
 *   strategy: "exponential",
 * });
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;
  let totalDelayMs = 0;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      if (cfg.signal?.aborted) {
        throw new Error("Operation aborted");
      }
      const data = await operation();
      return { data, attempts: attempt + 1, totalDelayMs };
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (cfg.retryableErrors && !cfg.retryableErrors(error)) {
        throw error;
      }

      // Last attempt — don't delay
      if (attempt === cfg.maxRetries) break;

      const delayMs = calculateDelay(attempt, cfg);
      totalDelayMs += delayMs;

      cfg.onRetry?.(attempt + 1, error, delayMs);

      await sleep(delayMs, cfg.signal);
    }
  }

  throw lastError;
}

/**
 * Calculate delay for a given attempt based on the strategy.
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay: number;

  switch (config.strategy) {
    case "fixed":
      delay = config.baseDelayMs;
      break;
    case "linear":
      delay = config.baseDelayMs * (attempt + 1);
      break;
    case "exponential":
      delay = config.baseDelayMs * Math.pow(2, attempt);
      break;
    case "jitter": {
      const expDelay = config.baseDelayMs * Math.pow(2, attempt);
      delay = Math.random() * expDelay;
      break;
    }
    default:
      delay = config.baseDelayMs;
  }

  return Math.min(delay, config.maxDelayMs);
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

/**
 * Create a circuit breaker that prevents repeated calls to a failing service.
 */
export function createCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>
): {
  state: () => CircuitBreakerState;
  execute: <T>(operation: () => Promise<T>) => Promise<T>;
  reset: () => void;
} {
  const cfg = { ...DEFAULT_CIRCUIT_BREAKER, ...config };
  let breaker: CircuitBreakerState = {
    state: "closed",
    failureCount: 0,
    successCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0,
  };

  function transitionTo(newState: CircuitState) {
    const oldState = breaker.state;
    if (oldState !== newState) {
      cfg.onStateChange?.(oldState, newState);
      breaker.state = newState;
    }
  }

  return {
    state: () => ({ ...breaker }),

    async execute<T>(operation: () => Promise<T>): Promise<T> {
      const now = Date.now();

      if (breaker.state === "open") {
        if (now >= breaker.nextAttemptTime) {
          transitionTo("half-open");
          breaker.successCount = 0;
        } else {
          throw new Error(
            `Circuit breaker is open. Retry after ${new Date(breaker.nextAttemptTime).toISOString()}`
          );
        }
      }

      try {
        const result = await operation();

        if (breaker.state === "half-open") {
          breaker.successCount++;
          if (breaker.successCount >= cfg.successThreshold) {
            transitionTo("closed");
            breaker.failureCount = 0;
          }
        } else {
          breaker.failureCount = 0;
        }

        return result;
      } catch (error) {
        breaker.failureCount++;
        breaker.lastFailureTime = now;

        if (breaker.failureCount >= cfg.failureThreshold) {
          transitionTo("open");
          breaker.nextAttemptTime = now + cfg.resetTimeoutMs;
        }

        throw error;
      }
    },

    reset() {
      breaker = {
        state: "closed",
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Fallback chain
// ---------------------------------------------------------------------------

/**
 * Execute a chain of fallback operations, trying each in order
 * until one succeeds.
 *
 * @example
 * const data = await withFallbackChain({
 *   chain: [
 *     { name: "API", fn: () => fetchFromAPI() },
 *     { name: "Cache", fn: () => readFromCache() },
 *     { name: "Static", fn: () => getStaticDefault() },
 *   ],
 * });
 */
export async function withFallbackChain<T>(
  config: FallbackChainConfig<T>
): Promise<{ data: T; usedFallback: string; index: number }> {
  let lastError: unknown;

  for (let i = 0; i < config.chain.length; i++) {
    const { name, fn, timeout } = config.chain[i];

    try {
      let result: T;
      if (timeout) {
        result = await withTimeout(fn, timeout);
      } else {
        result = await fn();
      }

      if (i > 0) {
        config.onFallback?.(name, i, lastError);
      }

      return { data: result, usedFallback: name, index: i };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("All fallbacks failed");
}

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

/**
 * Attempt primary operation, then degrade to simpler modes on failure.
 */
export async function withGracefulDegradation<T>(
  config: GracefulDegradationConfig<T>
): Promise<{ data: T; mode: "primary" | "degraded" | "minimal" }> {
  // Check health first if available
  if (config.healthCheck) {
    try {
      const healthy = await config.healthCheck();
      if (!healthy) {
        // Skip primary, go to degraded
        try {
          const data = await config.degraded();
          return { data, mode: "degraded" };
        } catch {
          return { data: config.minimal(), mode: "minimal" };
        }
      }
    } catch {
      // Health check failed — try primary anyway
    }
  }

  try {
    const data = await config.primary();
    return { data, mode: "primary" };
  } catch {
    try {
      const data = await config.degraded();
      return { data, mode: "degraded" };
    } catch {
      return { data: config.minimal(), mode: "minimal" };
    }
  }
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Check if an error is retryable (network/transient errors).
 * Non-retryable: 4xx client errors (except 429), validation errors.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network errors
    if (
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("econnrefused")
    ) {
      return true;
    }
  }

  // HTTP status-based
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    // 429 (rate limited) and 5xx are retryable
    if (status === 429 || (status >= 500 && status < 600)) return true;
    // 4xx (except 429) are not retryable
    if (status >= 400 && status < 500) return false;
  }

  return true; // Default: assume retryable
}

/**
 * Classify an error for user-facing display.
 */
export function classifyError(error: unknown): {
  type: "network" | "auth" | "validation" | "server" | "timeout" | "unknown";
  userMessage: string;
  isRetryable: boolean;
} {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("timeout") || msg.includes("aborted")) {
      return { type: "timeout", userMessage: "Request timed out. Please try again.", isRetryable: true };
    }
    if (msg.includes("network") || msg.includes("fetch failed")) {
      return { type: "network", userMessage: "Network error. Check your connection.", isRetryable: true };
    }
    if (msg.includes("unauthorized") || msg.includes("401")) {
      return { type: "auth", userMessage: "Session expired. Please log in again.", isRetryable: false };
    }
    if (msg.includes("validation") || msg.includes("invalid")) {
      return { type: "validation", userMessage: "Invalid input. Please check and try again.", isRetryable: false };
    }
  }

  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    if (status === 401 || status === 403) {
      return { type: "auth", userMessage: "Session expired. Please log in again.", isRetryable: false };
    }
    if (status >= 500) {
      return { type: "server", userMessage: "Server error. Please try again later.", isRetryable: true };
    }
  }

  return { type: "unknown", userMessage: "Something went wrong. Please try again.", isRetryable: true };
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/**
 * Build an error recovery audit from operation metrics.
 */
export function buildRecoveryAudit(metrics: {
  totalOps: number;
  firstTrySuccess: number;
  retrySuccess: number;
  retryFail: number;
  circuitTrips: number;
  fallbacks: number;
  totalRetries: number;
}): ErrorRecoveryAudit {
  const successRate =
    metrics.totalOps > 0
      ? ((metrics.firstTrySuccess + metrics.retrySuccess) / metrics.totalOps) * 100
      : 100;

  const retryEfficiency =
    metrics.retrySuccess + metrics.retryFail > 0
      ? (metrics.retrySuccess / (metrics.retrySuccess + metrics.retryFail)) * 100
      : 100;

  const score = Math.round(successRate * 0.6 + retryEfficiency * 0.4);

  return {
    totalOperations: metrics.totalOps,
    successOnFirstTry: metrics.firstTrySuccess,
    successAfterRetry: metrics.retrySuccess,
    failedAfterRetry: metrics.retryFail,
    circuitBreakerTrips: metrics.circuitTrips,
    fallbacksUsed: metrics.fallbacks,
    avgRetriesPerOperation:
      metrics.totalOps > 0 ? metrics.totalRetries / metrics.totalOps : 0,
    score,
    grade: scoreToGrade(score),
  };
}

/**
 * Format the recovery audit as a human-readable string.
 */
export function formatRecoveryAudit(audit: ErrorRecoveryAudit): string {
  return [
    `Error Recovery Audit: ${audit.score}/100 (${audit.grade})`,
    `Total operations: ${audit.totalOperations}`,
    `First-try success: ${audit.successOnFirstTry}`,
    `Retry success: ${audit.successAfterRetry}`,
    `Failed after retry: ${audit.failedAfterRetry}`,
    `Circuit breaker trips: ${audit.circuitBreakerTrips}`,
    `Fallbacks used: ${audit.fallbacksUsed}`,
    `Avg retries/op: ${audit.avgRetriesPerOperation.toFixed(2)}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    });
  });
}

async function withTimeout<T>(
  fn: () => Promise<T> | T,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    Promise.resolve(fn()),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeoutMs)
    ),
  ]);
}

function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
