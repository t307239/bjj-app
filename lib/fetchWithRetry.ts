/**
 * fetchWithRetry
 * Wraps the standard fetch() with exponential back-off retry logic.
 * Only retries on network errors and 5xx status codes.
 * Client & server safe (no DOM dependency).
 *
 * @param input  - URL or Request
 * @param init   - Standard RequestInit
 * @param opts   - Retry options
 * @returns      - The first successful Response
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before the first retry (default: 500) */
  baseDelay?: number;
  /** Maximum delay cap in ms (default: 5000) */
  maxDelay?: number;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: RetryOptions,
): Promise<Response> {
  const maxRetries = opts?.maxRetries ?? 3;
  const baseDelay = opts?.baseDelay ?? 500;
  const maxDelay = opts?.maxDelay ?? 5000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(input, init);

      // Don't retry client errors (4xx) — only server errors (5xx)
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }

      // 5xx — worth retrying
      if (attempt === maxRetries) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      // Network error (offline, DNS, timeout, etc.)
      if (attempt === maxRetries) throw err;
      lastError = err;
    }

    // Exponential back-off with jitter
    const delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
    const jitter = delay * 0.5 * Math.random();
    await new Promise((r) => setTimeout(r, delay + jitter));
  }

  // Should not be reached, but TypeScript needs it
  throw lastError;
}
