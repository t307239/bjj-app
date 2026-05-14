/**
 * lib/formatDate.ts — Locale-aware date formatting utilities.
 *
 * Q-24: Centralises date display logic using Intl.DateTimeFormat.
 * Replaces scattered toLocaleDateString("en-US", ...) calls with
 * a single source of truth that respects the user's locale.
 *
 * All functions are pure (no React, no Supabase). Safe to test.
 */

type SupportedLocale = "ja" | "en" | "pt";

/** Map our app locale codes to Intl locale strings */
const INTL_LOCALE: Record<SupportedLocale, string> = {
  ja: "ja-JP",
  en: "en-US",
  pt: "pt-BR",
};

/**
 * Format a date as a short human-readable string.
 * ja: "2026年4月15日"
 * en: "Apr 15, 2026"
 * pt: "15 de abr. de 2026"
 */
export function formatDateShort(
  isoOrDate: string | Date,
  locale: SupportedLocale = "en",
): string {
  try {
    const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
    return d.toLocaleDateString(INTL_LOCALE[locale], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    // silent: ok — Intl.DateTimeFormat unsupported — raw slice
    return typeof isoOrDate === "string" ? isoOrDate.slice(0, 10) : "—";
  }
}

/**
 * Format a date as a long human-readable string.
 * ja: "2026年4月15日 火曜日"
 * en: "Tuesday, April 15, 2026"
 * pt: "terça-feira, 15 de abril de 2026"
 */
export function formatDateLong(
  isoOrDate: string | Date,
  locale: SupportedLocale = "en",
): string {
  try {
    const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
    return d.toLocaleDateString(INTL_LOCALE[locale], {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  } catch {
    // silent: ok — Intl.DateTimeFormat unsupported — raw slice
    return typeof isoOrDate === "string" ? isoOrDate.slice(0, 10) : "—";
  }
}

/**
 * Format relative time (e.g., "3日前", "2 weeks ago", "há 5 dias").
 * Uses Intl.RelativeTimeFormat for proper localisation.
 */
export function formatRelativeTime(
  isoOrDate: string | Date,
  locale: SupportedLocale = "en",
): string {
  try {
    const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);

    const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], {
      numeric: "auto",
    });

    if (diffDay < 1) {
      if (diffHour < 1) {
        return diffMin < 1 ? rtf.format(0, "minute") : rtf.format(-diffMin, "minute");
      }
      return rtf.format(-diffHour, "hour");
    }
    if (diffDay < 7) return rtf.format(-diffDay, "day");
    if (diffWeek < 5) return rtf.format(-diffWeek, "week");
    return rtf.format(-diffMonth, "month");
  } catch {
    // silent: ok — Intl.DateTimeFormat unsupported — em dash
    return "—";
  }
}

/**
 * Format time only (e.g., "14:30", "2:30 PM").
 */
export function formatTime(
  isoOrDate: string | Date,
  locale: SupportedLocale = "en",
): string {
  try {
    const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
    return d.toLocaleTimeString(INTL_LOCALE[locale], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    // silent: ok — Intl.DateTimeFormat unsupported — em dash
    return "—";
  }
}

/**
 * Locale-aware number formatting (e.g., 1,234 / 1.234 / 1,234).
 * Replaces bare `.toLocaleString()` calls that default to system locale.
 */
export function formatNumber(
  value: number,
  locale: SupportedLocale = "en",
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
  } catch {
    // silent: ok — Intl.DateTimeFormat unsupported — stringify
    return String(value);
  }
}

/**
 * Format a month label (e.g., "2026年4月", "April 2026", "abril de 2026").
 */
export function formatMonthYear(
  date: Date,
  locale: SupportedLocale = "en",
): string {
  try {
    return date.toLocaleDateString(INTL_LOCALE[locale], {
      month: "long",
      year: "numeric",
    });
  } catch {
    // silent: ok — Intl.DateTimeFormat unsupported — manual YYYY-MM fallback
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
}

/**
 * z257: Safe parser for YYYY-MM or YYYY-MM-DD strings.
 * Returns null if the input is malformed (instead of producing NaN/Invalid Date),
 * so callers can render a fallback rather than display "Invalid Date" or NaN.
 */
export function parseYearMonthSafe(
  ym: string | null | undefined,
): { year: number; month: number } | null {
  if (!ym || typeof ym !== "string") return null;
  const match = /^(\d{4})-(\d{1,2})/.exec(ym);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * z257: Safe Date constructor — returns null for invalid ISO strings instead of
 * producing an Invalid Date whose .getTime() yields NaN. Use whenever the input
 * is user-supplied or sourced from a column that may be NULL or malformed.
 */
export function parseISODateSafe(iso: string | null | undefined): Date | null {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}
