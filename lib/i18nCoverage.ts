/**
 * lib/i18nCoverage.ts — Q-131: i18n coverage analysis utility
 *
 * Analyzes translation coverage across locale files.
 * Detects missing keys, extra keys, and calculates coverage percentages.
 *
 * Usage:
 *   import { analyzeI18nCoverage, findMissingKeys } from "@/lib/i18nCoverage";
 */

export type LocaleCode = "en" | "ja" | "pt";

export interface CoverageResult {
  locale: LocaleCode;
  totalKeys: number;
  coveredKeys: number;
  missingKeys: string[];
  extraKeys: string[];
  coveragePercent: number;
}

export interface CoverageSummary {
  referenceLocale: LocaleCode;
  referenceKeyCount: number;
  locales: CoverageResult[];
  overallCoveragePercent: number;
}

/**
 * Flatten a nested JSON object into dot-notation keys.
 * Example: { a: { b: "c" } } → ["a.b"]
 */
export function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/**
 * Find keys present in reference but missing in target.
 */
export function findMissingKeys(
  referenceKeys: string[],
  targetKeys: string[]
): string[] {
  const targetSet = new Set(targetKeys);
  return referenceKeys.filter((key) => !targetSet.has(key));
}

/**
 * Find keys present in target but not in reference (orphaned keys).
 */
export function findExtraKeys(
  referenceKeys: string[],
  targetKeys: string[]
): string[] {
  const refSet = new Set(referenceKeys);
  return targetKeys.filter((key) => !refSet.has(key));
}

/**
 * Analyze i18n coverage for a target locale against a reference locale.
 */
export function analyzeCoverage(
  locale: LocaleCode,
  referenceKeys: string[],
  targetKeys: string[]
): CoverageResult {
  const missingKeys = findMissingKeys(referenceKeys, targetKeys);
  const extraKeys = findExtraKeys(referenceKeys, targetKeys);
  const coveredKeys = referenceKeys.length - missingKeys.length;

  return {
    locale,
    totalKeys: referenceKeys.length,
    coveredKeys,
    missingKeys,
    extraKeys,
    coveragePercent:
      referenceKeys.length > 0
        ? Math.round((coveredKeys / referenceKeys.length) * 1000) / 10
        : 100,
  };
}

/**
 * Generate a full coverage summary across all locales.
 * Reference locale is typically "en" (the most complete).
 */
export function generateCoverageSummary(
  localeData: Record<LocaleCode, Record<string, unknown>>,
  referenceLocale: LocaleCode = "en"
): CoverageSummary {
  const referenceKeys = flattenKeys(localeData[referenceLocale]);
  const locales: CoverageResult[] = [];

  for (const [locale, data] of Object.entries(localeData)) {
    if (locale === referenceLocale) continue;
    const targetKeys = flattenKeys(data);
    locales.push(analyzeCoverage(locale as LocaleCode, referenceKeys, targetKeys));
  }

  const totalCovered = locales.reduce((sum, l) => sum + l.coveredKeys, 0);
  const totalExpected = locales.reduce((sum, l) => sum + l.totalKeys, 0);

  return {
    referenceLocale,
    referenceKeyCount: referenceKeys.length,
    locales,
    overallCoveragePercent:
      totalExpected > 0
        ? Math.round((totalCovered / totalExpected) * 1000) / 10
        : 100,
  };
}
