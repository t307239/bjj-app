/**
 * safeLocalStorage.ts — Quota-safe + SSR-safe wrappers around `window.localStorage`.
 *
 * Bare `localStorage.setItem()` can throw in these silent-fail scenarios:
 *   1. QuotaExceededError (Safari private mode is hard-capped, mobile devices
 *      may surface this after a few MB of cumulative writes)
 *   2. SecurityError (sandboxed iframes, third-party cookie blockers)
 *   3. Server-side rendering (`localStorage` is `undefined`)
 *
 * In every case the user's action (dismiss banner, mark step done, persist
 * draft, etc.) appeared to succeed but the next session re-shows the banner /
 * loses the draft — a classic silent-fail UX bug.
 *
 * `safeSetItem` / `safeGetItem` / `safeRemoveItem` make the failure surface
 * explicit:
 *   - SSR / disabled storage → return false / null (caller decides fallback)
 *   - Browser exception → forward to clientLogger.warn for Sentry visibility,
 *     return false so callers can choose to no-op or show toast
 *
 * Use these wrappers in ALL "use client" / hook code that touches
 * localStorage. The `detect_unsafe_localstorage_setitem.py` lint enforces this.
 *
 * @since z261b
 */

import { clientLogger } from "@/lib/clientLogger";

/**
 * Write `value` (string) to `localStorage` under `key`. Returns `true` on
 * success, `false` if storage is unavailable or threw (e.g. quota exceeded).
 *
 * Failures are logged to Sentry via clientLogger.warn so quota-exhaustion
 * regressions surface in production telemetry.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    // Common: QuotaExceededError, SecurityError. We don't want this to crash
    // the calling render or click handler — just log + signal failure.
    clientLogger.warn("localstorage.setitem_failed", {
      key,
      error: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : undefined,
    });
    return false;
  }
}

/**
 * Read a value from `localStorage`. Returns `null` if not present, if storage
 * is unavailable (SSR / disabled), or if the read itself threw.
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Delete a value from `localStorage`. Returns `true` if removed (or never
 * existed in storage we can access), `false` if the underlying call threw.
 */
export function safeRemoveItem(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (err) {
    clientLogger.warn("localstorage.removeitem_failed", {
      key,
      error: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : undefined,
    });
    return false;
  }
}
