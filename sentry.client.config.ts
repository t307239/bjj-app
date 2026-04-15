/**
 * Q-7: Sentry client-side configuration.
 * Initializes Sentry error tracking in the browser.
 * Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring — sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay — capture 5% of sessions, 100% on error
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Don't send errors in development
  enabled: process.env.NODE_ENV === "production",

  // Filter out noise
  ignoreErrors: [
    // Browser extensions
    "ResizeObserver loop",
    "Non-Error promise rejection",
    // Third-party scripts
    "Immersive Translate",
    // Network issues
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    // User-triggered navigation
    "NEXT_REDIRECT",
  ],
});
