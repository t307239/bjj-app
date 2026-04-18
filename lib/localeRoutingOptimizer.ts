/**
 * localeRoutingOptimizer.ts — Locale-aware URL routing optimization and hreflang generation
 *
 * Pure-function utility for managing multi-locale URL structures,
 * generating hreflang tags, detecting user locale preference,
 * and auditing locale routing coverage.
 *
 * @module Q-197
 * @since Q-197
 */

/* ---------- Types ---------- */

export interface LocaleRoute {
  readonly path: string;
  readonly locale: string;
  readonly translated: boolean;
  readonly lastModified?: string;
}

export interface HreflangEntry {
  readonly locale: string;
  readonly url: string;
  readonly isDefault: boolean;
}

export interface LocaleRoutingIssue {
  readonly path: string;
  readonly type: "missing_translation" | "orphaned_route" | "missing_default" | "duplicate_path";
  readonly locale: string;
  readonly message: string;
}

export interface LocaleRoutingAudit {
  readonly score: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly totalRoutes: number;
  readonly translatedRoutes: number;
  readonly coveragePercent: number;
  readonly coverageByLocale: Record<string, number>;
  readonly issues: readonly LocaleRoutingIssue[];
  readonly recommendations: readonly string[];
}

/* ---------- Constants ---------- */

export const SUPPORTED_LOCALES = ["ja", "en", "pt-BR"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "ja";

export const LOCALE_DOMAINS: Record<SupportedLocale, string> = {
  ja: "bjj-app.net",
  en: "bjj-app.net",
  "pt-BR": "bjj-app.net",
} as const;

/** Mapping from country codes to preferred locale */
const GEO_LOCALE_MAP: Record<string, SupportedLocale> = {
  JP: "ja",
  US: "en",
  GB: "en",
  AU: "en",
  CA: "en",
  BR: "pt-BR",
  PT: "pt-BR",
};

/** Accept-Language prefix to locale mapping */
const LANG_PREFIX_MAP: Record<string, SupportedLocale> = {
  ja: "ja",
  en: "en",
  pt: "pt-BR",
};

/* ---------- Functions ---------- */

/**
 * Generate hreflang link tag entries for a given path across all supported locales.
 */
export function buildHreflangTags(
  path: string,
  locales: readonly string[] = SUPPORTED_LOCALES
): readonly HreflangEntry[] {
  const entries: HreflangEntry[] = [];
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  for (const locale of locales) {
    const domain = LOCALE_DOMAINS[locale as SupportedLocale] ?? LOCALE_DOMAINS[DEFAULT_LOCALE];
    const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
    entries.push({
      locale,
      url: `https://${domain}${prefix}${normalizedPath}`,
      isDefault: locale === DEFAULT_LOCALE,
    });
  }

  // Add x-default pointing to default locale
  const defaultDomain = LOCALE_DOMAINS[DEFAULT_LOCALE];
  entries.push({
    locale: "x-default",
    url: `https://${defaultDomain}${normalizedPath}`,
    isDefault: true,
  });

  return entries;
}

/**
 * Detect user's preferred locale from available signals.
 * Priority: cookie > geo > Accept-Language header > default.
 */
export function detectUserLocale(
  acceptLanguage: string,
  cookie?: string,
  geoCountry?: string
): SupportedLocale {
  // 1. Cookie takes highest priority
  if (cookie) {
    const normalized = cookie.trim();
    if ((SUPPORTED_LOCALES as readonly string[]).includes(normalized)) {
      return normalized as SupportedLocale;
    }
  }

  // 2. Geo-based detection
  if (geoCountry) {
    const geoLocale = GEO_LOCALE_MAP[geoCountry.toUpperCase()];
    if (geoLocale) return geoLocale;
  }

  // 3. Parse Accept-Language header
  if (acceptLanguage) {
    const parsed = parseAcceptLanguage(acceptLanguage);
    for (const { lang } of parsed) {
      // Exact match
      if ((SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
        return lang as SupportedLocale;
      }
      // Prefix match (e.g., "pt-PT" → "pt" → "pt-BR")
      const prefix = lang.split("-")[0].toLowerCase();
      const mapped = LANG_PREFIX_MAP[prefix];
      if (mapped) return mapped;
    }
  }

  // 4. Default
  return DEFAULT_LOCALE;
}

/**
 * Parse Accept-Language header into sorted list of language preferences.
 */
function parseAcceptLanguage(
  header: string
): readonly { readonly lang: string; readonly q: number }[] {
  return header
    .split(",")
    .map((part) => {
      const [lang, qPart] = part.trim().split(";");
      const q = qPart ? parseFloat(qPart.replace("q=", "")) : 1.0;
      return { lang: lang.trim(), q: isNaN(q) ? 0 : q };
    })
    .sort((a, b) => b.q - a.q);
}

/**
 * Build a locale-prefixed URL.
 */
export function buildLocalizedUrl(path: string, locale: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const domain = LOCALE_DOMAINS[locale as SupportedLocale] ?? LOCALE_DOMAINS[DEFAULT_LOCALE];

  if (locale === DEFAULT_LOCALE) {
    return `https://${domain}${normalizedPath}`;
  }
  return `https://${domain}/${locale}${normalizedPath}`;
}

/**
 * Validate locale routes for missing translations and orphaned routes.
 */
export function validateLocaleRoutes(
  routes: readonly LocaleRoute[]
): readonly LocaleRoutingIssue[] {
  const issues: LocaleRoutingIssue[] = [];
  const pathsByLocale = new Map<string, Set<string>>();
  const allPaths = new Set<string>();

  // Group routes by locale
  for (const route of routes) {
    allPaths.add(route.path);
    if (!pathsByLocale.has(route.locale)) {
      pathsByLocale.set(route.locale, new Set());
    }
    pathsByLocale.get(route.locale)!.add(route.path);
  }

  // Check each path exists in all locales
  for (const path of allPaths) {
    for (const locale of SUPPORTED_LOCALES) {
      const localePaths = pathsByLocale.get(locale);
      if (!localePaths || !localePaths.has(path)) {
        issues.push({
          path,
          type: "missing_translation",
          locale,
          message: `Path "${path}" is missing translation for locale "${locale}"`,
        });
      }
    }
  }

  // Check for default locale coverage
  const defaultPaths = pathsByLocale.get(DEFAULT_LOCALE);
  if (defaultPaths) {
    for (const [locale, paths] of pathsByLocale) {
      if (locale === DEFAULT_LOCALE) continue;
      for (const path of paths) {
        if (!defaultPaths.has(path)) {
          issues.push({
            path,
            type: "orphaned_route",
            locale,
            message: `Path "${path}" in "${locale}" has no corresponding default locale route`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Comprehensive audit of locale routing setup.
 */
export function auditLocaleRouting(
  routes: readonly LocaleRoute[],
  pages: readonly string[]
): LocaleRoutingAudit {
  let score = 100;
  const recommendations: string[] = [];
  const issues = validateLocaleRoutes(routes);

  const totalRoutes = routes.length;
  const translatedRoutes = routes.filter((r) => r.translated).length;
  const coveragePercent = totalRoutes > 0
    ? Math.round((translatedRoutes / totalRoutes) * 10000) / 100
    : 0;

  // Coverage by locale
  const coverageByLocale: Record<string, number> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const localeRoutes = routes.filter((r) => r.locale === locale);
    const translated = localeRoutes.filter((r) => r.translated).length;
    coverageByLocale[locale] = pages.length > 0
      ? Math.round((translated / pages.length) * 10000) / 100
      : 0;
  }

  // Deduct points for issues
  const missingTranslations = issues.filter((i) => i.type === "missing_translation").length;
  const orphanedRoutes = issues.filter((i) => i.type === "orphaned_route").length;

  score -= missingTranslations * 3;
  score -= orphanedRoutes * 5;

  if (coveragePercent < 80) {
    score -= 15;
    recommendations.push("Translation coverage is below 80% — prioritize key pages");
  } else if (coveragePercent < 95) {
    score -= 5;
    recommendations.push("Translation coverage is below 95% — consider translating remaining pages");
  }

  // Check for pages without any route
  const routedPaths = new Set(routes.map((r) => r.path));
  for (const page of pages) {
    if (!routedPaths.has(page)) {
      score -= 2;
      recommendations.push(`Page "${page}" has no locale routes defined`);
    }
  }

  if (orphanedRoutes > 0) {
    recommendations.push(`${orphanedRoutes} orphaned route(s) found — remove or add default locale versions`);
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    grade: finalScore >= 90 ? "A" : finalScore >= 80 ? "B" : finalScore >= 70 ? "C" : finalScore >= 60 ? "D" : "F",
    totalRoutes,
    translatedRoutes,
    coveragePercent,
    coverageByLocale,
    issues,
    recommendations,
  };
}

/**
 * Format a locale routing audit as a human-readable string report.
 */
export function formatLocaleRoutingAudit(audit: LocaleRoutingAudit): string {
  const lines: string[] = [
    "=== Locale Routing Audit ===",
    `Score: ${audit.score}/100 (${audit.grade})`,
    "",
    `Total Routes:      ${audit.totalRoutes}`,
    `Translated Routes: ${audit.translatedRoutes}`,
    `Coverage:          ${audit.coveragePercent}%`,
    "",
    "Coverage by Locale:",
  ];

  for (const [locale, pct] of Object.entries(audit.coverageByLocale)) {
    lines.push(`  ${locale}: ${pct}%`);
  }

  if (audit.issues.length > 0) {
    lines.push("", `Issues (${audit.issues.length}):`);
    for (const issue of audit.issues) {
      lines.push(`  [${issue.type}] ${issue.locale}: ${issue.message}`);
    }
  }

  if (audit.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const rec of audit.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }

  return lines.join("\n");
}
