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
    // z262idx: ブラウザ自動翻訳(Google翻訳等)が React 管理下のテキストノードを
    // 差し替えることで発生する DOM 例外。アプリ起因ではなくページは動作する既知ノイズ。
    // 主にモバイル Chrome の自動翻訳で発生（/records・/techniques 等）。
    "removeChild",
    "insertBefore",
    "The node to be removed is not a child of this node",
    "The node before which the new node is to be inserted is not a child of this node",
    // Network issues
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    // User-triggered navigation
    "NEXT_REDIRECT",
  ],
});
