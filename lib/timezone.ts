/**
 * lib/timezone.ts
 *
 * Timezone-aware date utilities using the built-in Intl API.
 * Replaces the JST-hardcoded pattern `Date.now() + 9 * 3600_000` with
 * proper user-local-timezone detection.
 *
 * Usage (client components):
 *   import { getLocalDateString, getLocalDateParts } from "@/lib/timezone";
 *   const today = getLocalDateString(); // "2026-03-23"
 *
 * For server components, pass the timezone via a cookie (see note below).
 *
 * NOTE: npm install date-fns date-fns-tz was blocked in sandbox.
 * This Intl-based implementation covers the same use cases without external deps.
 */

// ── Client-side helpers ───────────────────────────────────────────────────

/**
 * Returns the user's IANA timezone string.
 * Falls back to "Asia/Tokyo" (JST) for SSR / environments without Intl.
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "Asia/Tokyo";
  }
}

/**
 * Returns today's date string "YYYY-MM-DD" in the user's local timezone.
 * Works correctly on both client and server (with Node.js TZ env var).
 */
export function getLocalDateString(tz?: string): string {
  const timezone = tz ?? getUserTimezone();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    const m = parts.find((p) => p.type === "month")?.value ?? "";
    const d = parts.find((p) => p.type === "day")?.value ?? "";
    return `${y}-${m}-${d}`;
  } catch {
    // Fallback: use runtime local date (correct when TZ env var is set)
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
}

/**
 * Returns { year, month, day, dayOfWeek } for the current moment in the given TZ.
 * dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
 */
export function getLocalDateParts(tz?: string): {
  year: number;
  month: number; // 1-12
  day: number;
  dayOfWeek: number;
  daysInMonth: number;
} {
  const timezone = tz ?? getUserTimezone();
  const now = new Date();

  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "narrow",
    });
    const parts = fmt.formatToParts(now);
    const year = parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10);
    const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "0", 10);
    const day = parseInt(parts.find((p) => p.type === "day")?.value ?? "0", 10);

    // Calculate dayOfWeek using the local date string
    const localDate = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00Z`);
    const dayOfWeek = localDate.getUTCDay();

    // Days in month
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return { year, month, day, dayOfWeek, daysInMonth };
  } catch {
    // Fallback to runtime local
    const d = now;
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      dayOfWeek: d.getDay(),
      daysInMonth: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    };
  }
}

/**
 * Returns the ISO date string "YYYY-MM-DD" for the Monday of the current week
 * in the user's local timezone.
 */
export function getWeekStartDate(tz?: string): string {
  const { year, month, day, dayOfWeek } = getLocalDateParts(tz);
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(Date.UTC(year, month - 1, day - daysToMonday));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Returns "YYYY-MM-01" — the first day of the current month in the user's TZ.
 */
export function getMonthStartDate(tz?: string): string {
  const { year, month } = getLocalDateParts(tz);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * Converts a UTC ISO timestamp to the user's local date string "YYYY-MM-DD".
 * Used when reading timestamps stored as UTC and converting to local date for display.
 */
export function utcIsoToLocalDateString(utcIso: string, tz?: string): string {
  const timezone = tz ?? getUserTimezone();
  try {
    const d = new Date(utcIso);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    const m = parts.find((p) => p.type === "month")?.value ?? "";
    const dy = parts.find((p) => p.type === "day")?.value ?? "";
    return `${y}-${m}-${dy}`;
  } catch {
    return utcIso.slice(0, 10);
  }
}

/**
 * Returns yesterday's date string "YYYY-MM-DD" in the user's local timezone.
 */
export function getYesterdayDateString(tz?: string): string {
  const { year, month, day } = getLocalDateParts(tz);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1));
  return `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;
}
