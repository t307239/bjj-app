/**
 * bjjDuration.ts — Calendar-accurate BJJ training duration utilities
 *
 * Uses proper calendar month arithmetic (not 30-day approximation).
 * Safe for both server-side (app/dashboard/page.tsx) and client-side use.
 */

export interface BjjDuration {
  years: number;
  months: number;   // remainder months after years extracted
  totalMonths: number;
}

/**
 * Calculate BJJ training duration from a start date string (YYYY-MM-DD).
 * Uses calendar-accurate month arithmetic by anchoring to month start.
 */
export function calcBjjDuration(startDate: string): BjjDuration {
  const parts = startDate.split("-").map(Number);
  // Anchor to first of the month for consistent "full month" counting
  const start = new Date((parts[0] ?? 2000), (parts[1] ?? 1) - 1, 1);
  const now = new Date();
  const totalMonths = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth())
  );
  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    totalMonths,
  };
}

/**
 * Format BJJ duration to a human-readable string using i18n translation keys.
 * Works with both client (useLocale's `t`) and server (`serverT`).
 *
 * Examples (ja):
 *   0y 3m → "3ヶ月"
 *   2y 0m → "2年"
 *   2y 5m → "2年5ヶ月"
 *   0y 0m → "始めたばかり"
 */
export function formatBjjDuration(
  startDate: string,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const { years, months } = calcBjjDuration(startDate);
  if (years === 0 && months === 0) return t("profile.bjjHistoryJustStarted");
  // months only
  if (years === 0) {
    if (months === 1) return t("profile.bjjHistoryMonthOne");
    return t("profile.bjjHistoryMonths", { n: months });
  }
  // years only
  if (months === 0) {
    if (years === 1) return t("profile.bjjHistoryYearOne");
    return t("profile.bjjHistoryYears", { n: years });
  }
  // years + months — locale-aware singular handling for both parts
  if (years === 1 && months === 1) return t("profile.bjjHistoryOneYearOneMonth");
  if (years === 1) return t("profile.bjjHistoryOneYearMonths", { m: months });
  if (months === 1) return t("profile.bjjHistoryYearsOneMonth", { y: years });
  return t("profile.bjjHistoryYearsMonths", { y: years, m: months });
}
