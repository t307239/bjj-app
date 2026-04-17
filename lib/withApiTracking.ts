/**
 * lib/withApiTracking.ts — API route performance tracking wrapper
 *
 * Q-108: Wraps Next.js API route handlers to automatically track:
 *   - Request duration (logged via structured logger)
 *   - Slow request warnings (>2s → Sentry via logger.warn)
 *   - Error rate with automatic Sentry capture
 *
 * Usage:
 *   import { withApiTracking } from "@/lib/withApiTracking";
 *
 *   async function handler(request: NextRequest) { ... }
 *   export const GET = withApiTracking("api.myRoute", handler);
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const SLOW_THRESHOLD_MS = 2000;

type ApiHandler = (request: NextRequest, context?: unknown) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function that wraps an API route handler with performance tracking.
 *
 * @param routeName - Dot-namespaced route identifier (e.g. "api.push.subscribe")
 * @param handler - The actual API route handler
 * @returns Wrapped handler with tracking
 */
export function withApiTracking(routeName: string, handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: unknown) => {
    const t0 = Date.now();
    const method = request.method;
    const url = request.nextUrl.pathname;

    try {
      const response = await handler(request, context);
      const durationMs = Date.now() - t0;
      const status = response.status;

      // Log slow requests as warnings (auto-forwarded to Sentry)
      if (durationMs > SLOW_THRESHOLD_MS) {
        logger.warn(`${routeName}.slow`, {
          method,
          url,
          status,
          durationMs,
          threshold: SLOW_THRESHOLD_MS,
        });
      }

      // Log all requests at debug level for structured observability
      logger.debug(`${routeName}.complete`, {
        method,
        url,
        status,
        durationMs,
      });

      // Add Server-Timing header for browser DevTools visibility
      response.headers.set("Server-Timing", `api;dur=${durationMs}`);

      return response;
    } catch (err) {
      const durationMs = Date.now() - t0;

      logger.error(`${routeName}.error`, {
        method,
        url,
        durationMs,
      }, err);

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
