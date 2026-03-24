/**
 * lib/logicalDate.ts
 *
 * "Logical training date" helper: if a user logs a session before 4 AM local
 * time, it is attributed to the previous calendar day.
 * (e.g. training ends at 1 AM → still counted as "yesterday's" session.)
 *
 * Uses the Intl API — no external dependencies required.
 */

import { getUserTimezone } from "@/lib/timezone";

/**
 * Returns the logical training date as "YYYY-MM-DD".
 * Timestamps before 04:00 local time are shifted back one day.
 *
 * @param now   Optional Date to evaluate (defaults to current time)
 * @param tz    Optional IANA timezone string (defaults to user's local TZ)
 */
export function getLogicalTrainingDate(now?: Date, tz?: string): string {
  const timezone = tz ?? getUserTimezone();
  const date = now ?? new Date();

  try {
    // Get full date + hour in local timezone
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const year  = parseInt(parts.find((p) => p.type === "year")?.value  ?? "0", 10);
    const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "0", 10);
    const day   = parseInt(parts.find((p) => p.type === "day")?.value   ?? "0", 10);
    const hour  = parseInt(parts.find((p) => p.type === "hour")?.value  ?? "12", 10);

    // Before 04:00 → shift to previous day
    const logicalDate = hour < 4
      ? new Date(Date.UTC(year, month - 1, day - 1))
      : new Date(Date.UTC(year, month - 1, day));

    const y = logicalDate.getUTCFullYear();
    const m = String(logicalDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(logicalDate.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    // Fallback: no shift, just return current local date
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}
