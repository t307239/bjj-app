/**
 * Q-7: Sentry server-side configuration.
 * Initializes Sentry error tracking for Node.js server components & API routes.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring — sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Don't send errors in development
  enabled: process.env.NODE_ENV === "production",
});
