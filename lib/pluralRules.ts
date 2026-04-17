/**
 * lib/pluralRules.ts — ICU-compatible plural/ordinal rules engine
 *
 * Q-152: i18n pillar — provides locale-aware plural category
 * resolution, ordinal formatting, and count-based message selection
 * following CLDR/ICU plural rules for EN, JA, and PT.
 *
 * Pure utility layer — no React, no DOM.
 *
 * @example
 *   import { selectPlural, formatCount, PLURAL_FORMS } from "@/lib/pluralRules";
 *   const msg = selectPlural("en", 5, { one: "1 session", other: "{count} sessions" });
 *   const formatted = formatCount("ja", 1234);
 */

// ── Types ────────────────────────────────────────────────────────────────

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";
export type SupportedLocale = "en" | "ja" | "pt";

export interface PluralMessages {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface PluralRule {
  /** Locale */
  locale: SupportedLocale;
  /** Cardinal plural category resolver */
  cardinal: (n: number) => PluralCategory;
  /** Ordinal category resolver */
  ordinal: (n: number) => PluralCategory;
}

export interface CountFormat {
  /** Locale */
  locale: SupportedLocale;
  /** Thousands separator */
  thousandsSep: string;
  /** Decimal separator */
  decimalSep: string;
  /** Compact suffixes (K, M, B) */
  compactSuffixes: { k: string; m: string; b: string };
}

// ── Constants ────────────────────────────────────────────────────────────

/**
 * CLDR plural rules for supported locales.
 *
 * EN: one (n=1), other
 * JA: other (no plural distinction)
 * PT: one (n=0..1), other (same as CLDR for pt-BR)
 */
export const PLURAL_RULES: Record<SupportedLocale, PluralRule> = {
  en: {
    locale: "en",
    cardinal: (n) => (n === 1 ? "one" : "other"),
    ordinal: (n) => {
      const mod10 = n % 10;
      const mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return "one";
      if (mod10 === 2 && mod100 !== 12) return "two";
      if (mod10 === 3 && mod100 !== 13) return "few";
      return "other";
    },
  },
  ja: {
    locale: "ja",
    cardinal: () => "other",
    ordinal: () => "other",
  },
  pt: {
    locale: "pt",
    cardinal: (n) => (n >= 0 && n <= 1 ? "one" : "other"),
    ordinal: () => "other",
  },
};

/** Number format settings per locale */
export const COUNT_FORMATS: Record<SupportedLocale, CountFormat> = {
  en: {
    locale: "en",
    thousandsSep: ",",
    decimalSep: ".",
    compactSuffixes: { k: "K", m: "M", b: "B" },
  },
  ja: {
    locale: "ja",
    thousandsSep: ",",
    decimalSep: ".",
    compactSuffixes: { k: "千", m: "万", b: "億" },
  },
  pt: {
    locale: "pt",
    thousandsSep: ".",
    decimalSep: ",",
    compactSuffixes: { k: "mil", m: "mi", b: "bi" },
  },
};

/** Ordinal suffixes for English */
export const EN_ORDINAL_SUFFIXES: Record<PluralCategory, string> = {
  one: "st",
  two: "nd",
  few: "rd",
  many: "th",
  other: "th",
  zero: "th",
};

// ── Plural Selection ────────────────────────────────────────────────────

/**
 * Select the appropriate plural form of a message based on count.
 * Replaces {count} placeholder with the actual number.
 */
export function selectPlural(
  locale: SupportedLocale,
  count: number,
  messages: PluralMessages,
): string {
  const rule = PLURAL_RULES[locale];
  const category = rule.cardinal(count);

  // Fall through: try exact category, then "other"
  const template = messages[category] ?? messages.other;
  return template.replace(/\{count\}/g, String(count));
}

/**
 * Get the plural category for a number in a locale.
 */
export function getPluralCategory(
  locale: SupportedLocale,
  count: number,
): PluralCategory {
  return PLURAL_RULES[locale].cardinal(count);
}

/**
 * Get the ordinal category for a number in a locale.
 */
export function getOrdinalCategory(
  locale: SupportedLocale,
  count: number,
): PluralCategory {
  return PLURAL_RULES[locale].ordinal(count);
}

// ── Ordinal Formatting ──────────────────────────────────────────────────

/**
 * Format a number as an ordinal string (e.g., "1st", "2nd", "3rd").
 * For JA/PT, returns just the number (ordinals not commonly used).
 */
export function formatOrdinal(
  locale: SupportedLocale,
  n: number,
): string {
  if (locale === "en") {
    const category = PLURAL_RULES.en.ordinal(n);
    return `${n}${EN_ORDINAL_SUFFIXES[category]}`;
  }
  // JA and PT don't use ordinal suffixes in the same way
  if (locale === "ja") return `${n}番目`;
  if (locale === "pt") return `${n}º`;
  return String(n);
}

// ── Number Formatting ───────────────────────────────────────────────────

/**
 * Format a number with locale-appropriate thousands separators.
 */
export function formatCount(
  locale: SupportedLocale,
  n: number,
): string {
  const fmt = COUNT_FORMATS[locale];
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  const intPart = Math.floor(abs);
  const str = String(intPart);
  const parts: string[] = [];

  for (let i = str.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) {
      parts.unshift(fmt.thousandsSep);
    }
    parts.unshift(str[i]);
  }

  return sign + parts.join("");
}

/**
 * Format a number in compact form (e.g., 1.2K, 3.5M).
 */
export function formatCompact(
  locale: SupportedLocale,
  n: number,
): string {
  const fmt = COUNT_FORMATS[locale];
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1)}${fmt.compactSuffixes.b}`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}${fmt.compactSuffixes.m}`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1)}${fmt.compactSuffixes.k}`;
  }
  return `${sign}${abs}`;
}

/**
 * Check if a locale is supported.
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return locale === "en" || locale === "ja" || locale === "pt";
}
