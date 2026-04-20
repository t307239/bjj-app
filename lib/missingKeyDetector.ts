/**
 * Q-222: Missing Key Detector — runtime i18n key validation
 *
 * Detects missing translation keys at runtime and build time.
 * Helps maintain translation coverage across all supported locales
 * without requiring 100% PT coverage immediately.
 *
 * @example
 * const report = detectMissingKeys(enMessages, jaMessages, "ja");
 * console.log(report.missingKeys); // keys in en but not in ja
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MissingKeyReport {
  /** Source locale used as reference */
  referenceLocale: string;
  /** Target locale being checked */
  targetLocale: string;
  /** Keys present in reference but missing in target */
  missingKeys: string[];
  /** Keys present in target but not in reference (orphaned) */
  extraKeys: string[];
  /** Coverage percentage (0-100) */
  coveragePercent: number;
  /** Total keys in reference */
  totalReferenceKeys: number;
  /** Total keys in target */
  totalTargetKeys: number;
  /** Grade A+ through F */
  grade: string;
}

export interface RuntimeKeyEvent {
  /** The key that was accessed */
  key: string;
  /** The locale at the time of access */
  locale: string;
  /** Whether the key was found */
  found: boolean;
  /** Timestamp */
  timestamp: number;
  /** Page/route where the access occurred */
  route?: string;
}

export interface KeyUsageReport {
  /** Total key accesses tracked */
  totalAccesses: number;
  /** Number of missing key events */
  missingCount: number;
  /** Missing key hit rate */
  missingRate: number;
  /** Unique missing keys */
  uniqueMissingKeys: string[];
  /** Most frequently missing keys (top 10) */
  topMissing: Array<{ key: string; count: number }>;
  /** Keys by locale */
  byLocale: Record<string, { total: number; missing: number }>;
}

// ---------------------------------------------------------------------------
// Key flattening
// ---------------------------------------------------------------------------

/**
 * Flatten a nested JSON message object into dot-separated keys.
 *
 * @example
 * flattenKeys({ a: { b: "hello" } }) // => ["a.b"]
 */
export function flattenKeys(
  obj: Record<string, unknown>,
  prefix = ""
): string[] {
  const keys: string[] = [];

  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

// ---------------------------------------------------------------------------
// Static analysis
// ---------------------------------------------------------------------------

/**
 * Compare two message bundles and report missing/extra keys.
 */
export function detectMissingKeys(
  referenceMessages: Record<string, unknown>,
  targetMessages: Record<string, unknown>,
  referenceLocale: string,
  targetLocale: string
): MissingKeyReport {
  const refKeys = new Set(flattenKeys(referenceMessages));
  const targetKeys = new Set(flattenKeys(targetMessages));

  const missingKeys = [...refKeys].filter((k) => !targetKeys.has(k));
  const extraKeys = [...targetKeys].filter((k) => !refKeys.has(k));

  const coveragePercent =
    refKeys.size > 0
      ? Math.round(((refKeys.size - missingKeys.length) / refKeys.size) * 1000) / 10
      : 100;

  return {
    referenceLocale,
    targetLocale,
    missingKeys,
    extraKeys,
    coveragePercent,
    totalReferenceKeys: refKeys.size,
    totalTargetKeys: targetKeys.size,
    grade: coverageToGrade(coveragePercent),
  };
}

/**
 * Check all locales against the reference locale.
 */
export function detectAllMissingKeys(
  bundles: Record<string, Record<string, unknown>>,
  referenceLocale: string
): MissingKeyReport[] {
  const refBundle = bundles[referenceLocale];
  if (!refBundle) return [];

  return Object.entries(bundles)
    .filter(([locale]) => locale !== referenceLocale)
    .map(([locale, messages]) =>
      detectMissingKeys(refBundle, messages, referenceLocale, locale)
    );
}

// ---------------------------------------------------------------------------
// Runtime tracking
// ---------------------------------------------------------------------------

/**
 * Create a runtime key usage tracker.
 */
export function createKeyTracker(): {
  track: (key: string, locale: string, found: boolean, route?: string) => void;
  getReport: () => KeyUsageReport;
  getEvents: () => RuntimeKeyEvent[];
  clear: () => void;
} {
  let events: RuntimeKeyEvent[] = [];

  return {
    track(key, locale, found, route) {
      events.push({
        key,
        locale,
        found,
        timestamp: Date.now(),
        route,
      });
    },

    getReport(): KeyUsageReport {
      const missingEvents = events.filter((e) => !e.found);
      const missingCounts = new Map<string, number>();

      for (const e of missingEvents) {
        missingCounts.set(e.key, (missingCounts.get(e.key) || 0) + 1);
      }

      const byLocale: Record<string, { total: number; missing: number }> = {};
      for (const e of events) {
        if (!byLocale[e.locale]) {
          byLocale[e.locale] = { total: 0, missing: 0 };
        }
        byLocale[e.locale].total++;
        if (!e.found) byLocale[e.locale].missing++;
      }

      const topMissing = [...missingCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => ({ key, count }));

      return {
        totalAccesses: events.length,
        missingCount: missingEvents.length,
        missingRate:
          events.length > 0 ? missingEvents.length / events.length : 0,
        uniqueMissingKeys: [...missingCounts.keys()],
        topMissing,
        byLocale,
      };
    },

    getEvents: () => [...events],

    clear() {
      events = [];
    },
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a missing key report as a human-readable string.
 */
export function formatMissingKeyReport(report: MissingKeyReport): string {
  const lines: string[] = [
    `i18n Coverage: ${report.targetLocale} vs ${report.referenceLocale}`,
    `Coverage: ${report.coveragePercent}% (${report.grade})`,
    `Reference keys: ${report.totalReferenceKeys}`,
    `Target keys: ${report.totalTargetKeys}`,
    `Missing: ${report.missingKeys.length}`,
    `Extra: ${report.extraKeys.length}`,
  ];

  if (report.missingKeys.length > 0) {
    lines.push("", "Missing keys (first 10):");
    for (const k of report.missingKeys.slice(0, 10)) {
      lines.push(`  - ${k}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coverageToGrade(percent: number): string {
  if (percent >= 100) return "A+";
  if (percent >= 95) return "A";
  if (percent >= 90) return "A-";
  if (percent >= 85) return "B+";
  if (percent >= 80) return "B";
  if (percent >= 75) return "B-";
  if (percent >= 65) return "C";
  if (percent >= 50) return "D";
  return "F";
}
