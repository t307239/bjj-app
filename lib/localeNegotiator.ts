/**
 * Q-180: Locale Negotiator (i18n 94→95)
 *
 * RFC 4647 / BCP 47 compliant locale negotiation, quality-factor parsing,
 * fallback chain construction, and locale metadata for SaaS-grade i18n.
 */

// ── Types & Constants ──────────────────────────────────────

export interface LocaleConfig {
  code: string;          // BCP 47 code, e.g. "ja", "en-US", "pt-BR"
  language: string;      // ISO 639-1 language
  region?: string;       // ISO 3166-1 alpha-2 region
  displayName: string;   // e.g. "日本語", "English", "Português"
  direction: "ltr" | "rtl";
  dateFormat: string;    // e.g. "YYYY/MM/DD"
  numberSeparator: { decimal: string; thousands: string };
}

export const SUPPORTED_LOCALES: Record<string, LocaleConfig> = {
  ja: {
    code: "ja",
    language: "ja",
    displayName: "日本語",
    direction: "ltr",
    dateFormat: "YYYY/MM/DD",
    numberSeparator: { decimal: ".", thousands: "," },
  },
  en: {
    code: "en",
    language: "en",
    displayName: "English",
    direction: "ltr",
    dateFormat: "MM/DD/YYYY",
    numberSeparator: { decimal: ".", thousands: "," },
  },
  "pt-BR": {
    code: "pt-BR",
    language: "pt",
    region: "BR",
    displayName: "Português",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    numberSeparator: { decimal: ",", thousands: "." },
  },
} as const;

export const DEFAULT_LOCALE = "en";

export interface QualityLocale {
  locale: string;
  quality: number;
}

// ── Parsing ────────────────────────────────────────────────

/**
 * Parse Accept-Language header into sorted quality-factor list
 * e.g. "ja,en-US;q=0.9,en;q=0.8" → [{locale:"ja",quality:1},{locale:"en-US",quality:0.9},...]
 */
export function parseAcceptLanguage(header: string): QualityLocale[] {
  if (!header || header.trim() === "") return [];
  return header
    .split(",")
    .map((part) => {
      const [locale, ...params] = part.trim().split(";");
      let quality = 1;
      for (const p of params) {
        const match = p.trim().match(/^q=([\d.]+)$/);
        if (match) {
          quality = Math.min(1, Math.max(0, parseFloat(match[1])));
        }
      }
      return { locale: locale.trim(), quality };
    })
    .filter((item) => item.locale !== "" && item.locale !== "*")
    .sort((a, b) => b.quality - a.quality);
}

/**
 * Normalize a BCP 47 tag: lowercase language, uppercase region
 */
export function normalizeBCP47(tag: string): string {
  const parts = tag.replace("_", "-").split("-");
  if (parts.length === 0) return "";
  const lang = parts[0].toLowerCase();
  if (parts.length === 1) return lang;
  const region = parts[1].toUpperCase();
  return `${lang}-${region}`;
}

/**
 * Extract language subtag from BCP 47
 */
export function extractLanguage(tag: string): string {
  return tag.replace("_", "-").split("-")[0].toLowerCase();
}

// ── Negotiation ────────────────────────────────────────────

/**
 * Build fallback chain for a locale tag
 * e.g. "pt-BR" → ["pt-BR", "pt", "en"]
 */
export function buildFallbackChain(
  tag: string,
  defaultLocale: string = DEFAULT_LOCALE
): string[] {
  const normalized = normalizeBCP47(tag);
  const chain: string[] = [normalized];
  const lang = extractLanguage(normalized);
  if (lang !== normalized) {
    chain.push(lang);
  }
  if (!chain.includes(defaultLocale)) {
    chain.push(defaultLocale);
  }
  return chain;
}

/**
 * Negotiate best locale from Accept-Language and supported list
 * Returns the best match or default locale
 */
export function negotiateLocale(
  acceptLanguage: string,
  supported: string[] = Object.keys(SUPPORTED_LOCALES),
  defaultLocale: string = DEFAULT_LOCALE
): string {
  const requested = parseAcceptLanguage(acceptLanguage);
  for (const req of requested) {
    const normalized = normalizeBCP47(req.locale);
    // Exact match
    if (supported.includes(normalized)) return normalized;
    // Language-only match
    const lang = extractLanguage(normalized);
    if (supported.includes(lang)) return lang;
    // Supported locale with same language
    const regionMatch = supported.find(
      (s) => extractLanguage(s) === lang
    );
    if (regionMatch) return regionMatch;
  }
  return defaultLocale;
}

/**
 * Get locale config (with fallback)
 */
export function getLocaleConfig(locale: string): LocaleConfig {
  const normalized = normalizeBCP47(locale);
  if (SUPPORTED_LOCALES[normalized]) return SUPPORTED_LOCALES[normalized];
  const lang = extractLanguage(normalized);
  if (SUPPORTED_LOCALES[lang]) return SUPPORTED_LOCALES[lang];
  return SUPPORTED_LOCALES[DEFAULT_LOCALE];
}

/**
 * Check if a locale is right-to-left
 */
export function isRTL(locale: string): boolean {
  return getLocaleConfig(locale).direction === "rtl";
}

/**
 * Validate BCP 47 tag format
 */
export function isValidBCP47(tag: string): boolean {
  return /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?(-[a-zA-Z0-9]+)*$/.test(tag);
}

/**
 * Calculate i18n coverage: keys present in target vs source
 */
export function calculateI18nCoverage(
  sourceKeys: string[],
  targetKeys: string[]
): { coverage: number; missing: string[]; extra: string[] } {
  const sourceSet = new Set(sourceKeys);
  const targetSet = new Set(targetKeys);
  const missing = sourceKeys.filter((k) => !targetSet.has(k));
  const extra = targetKeys.filter((k) => !sourceSet.has(k));
  const coverage =
    sourceKeys.length === 0
      ? 100
      : Math.round(((sourceKeys.length - missing.length) / sourceKeys.length) * 10000) / 100;
  return { coverage, missing, extra };
}

/**
 * Format locale negotiation result for debugging
 */
export function formatLocaleDebug(
  acceptLanguage: string,
  resolved: string,
  config: LocaleConfig
): string {
  return [
    `Accept-Language: ${acceptLanguage}`,
    `Resolved: ${resolved}`,
    `Display: ${config.displayName}`,
    `Direction: ${config.direction}`,
    `Date Format: ${config.dateFormat}`,
  ].join("\n");
}
