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
    return "—";
  }
}
