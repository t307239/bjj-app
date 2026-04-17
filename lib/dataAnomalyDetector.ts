/**
 * lib/dataAnomalyDetector.ts — Statistical anomaly detection for training data
 *
 * Q-166: Data pillar 93→94 — Detects statistical outliers, duplicates,
 * temporal anomalies, and volume spikes in training log data.
 *
 * Pure utility layer — operates on arrays of data points, no DB access.
 * Designed for the BJJ App's training log domain (duration, weight, reps).
 *
 * @example
 *   import { detectOutliers, detectDuplicates, runAnomalyReport } from "@/lib/dataAnomalyDetector";
 *
 *   const outliers = detectOutliers([10, 12, 11, 100, 13], { method: "zscore" });
 *   // → [{ index: 3, value: 100, score: 3.8, ... }]
 *
 *   const dupes = detectDuplicates(records, ["date", "duration", "technique"]);
 *   // → [{ indices: [2, 5], fields: { date: "2026-04-10", ... } }]
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface AnomalyPoint {
  /** Index in the original array */
  index: number;
  /** The anomalous value */
  value: number;
  /** Anomaly score (z-score or IQR multiplier) */
  score: number;
  /** Why it's flagged */
  reason: string;
  /** Severity level */
  severity: "low" | "medium" | "high";
}

export interface DuplicateGroup {
  /** Indices of duplicate records */
  indices: number[];
  /** The shared field values */
  fields: Record<string, string | number>;
}

export interface TemporalAnomaly {
  /** Index in the original array */
  index: number;
  /** Type of temporal issue */
  type: "future_date" | "impossible_gap" | "out_of_order" | "too_old";
  /** Human-readable description */
  description: string;
  /** The problematic date value */
  date: string;
}

export interface VolumeAnomaly {
  /** Period identifier (e.g., "2026-W15") */
  period: string;
  /** Actual count in this period */
  count: number;
  /** Expected count (rolling average) */
  expected: number;
  /** Deviation ratio (count / expected) */
  ratio: number;
  /** Type: spike or drop */
  type: "spike" | "drop";
}

export interface AnomalyDetectorConfig {
  /** Z-score threshold for outlier detection (default: 2.5) */
  zScoreThreshold?: number;
  /** IQR multiplier for outlier detection (default: 1.5) */
  iqrMultiplier?: number;
  /** Detection method (default: "zscore") */
  method?: "zscore" | "iqr";
  /** Maximum age in days for temporal checks (default: 3650 = ~10 years) */
  maxAgeDays?: number;
  /** Maximum gap in days between consecutive records (default: 365) */
  maxGapDays?: number;
  /** Volume deviation threshold ratio (default: 2.0 = 200%) */
  volumeThresholdRatio?: number;
}

export interface AnomalyReport {
  /** Total records analyzed */
  totalRecords: number;
  /** Statistical outliers found */
  outliers: AnomalyPoint[];
  /** Duplicate groups found */
  duplicates: DuplicateGroup[];
  /** Temporal anomalies found */
  temporalAnomalies: TemporalAnomaly[];
  /** Volume anomalies found */
  volumeAnomalies: VolumeAnomaly[];
  /** Overall health: clean / warning / critical */
  health: "clean" | "warning" | "critical";
  /** Summary statistics */
  stats: {
    outlierCount: number;
    duplicateCount: number;
    temporalCount: number;
    volumeCount: number;
    totalAnomalies: number;
  };
}

// ── Domain Constraints ─────────────────────────────────────────────────

/** Valid ranges for BJJ App training data fields */
export const DOMAIN_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  duration_minutes: { min: 1, max: 480, unit: "minutes" },
  weight_kg: { min: 20, max: 250, unit: "kg" },
  rounds: { min: 1, max: 50, unit: "rounds" },
  round_duration: { min: 1, max: 30, unit: "minutes" },
  session_rpe: { min: 1, max: 10, unit: "RPE" },
} as const;

/** Default configuration */
export const DEFAULT_ANOMALY_CONFIG: Required<AnomalyDetectorConfig> = {
  zScoreThreshold: 2.5,
  iqrMultiplier: 1.5,
  method: "zscore",
  maxAgeDays: 3650,
  maxGapDays: 365,
  volumeThresholdRatio: 2.0,
};

// ── Statistical Helpers ────────────────────────────────────────────────

/** Calculate mean of numeric array */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Calculate standard deviation */
export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Calculate median */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Calculate Q1 (25th percentile) and Q3 (75th percentile) */
export function quartiles(values: number[]): { q1: number; q3: number; iqr: number } {
  if (values.length < 4) return { q1: 0, q3: 0, iqr: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lowerHalf = sorted.slice(0, mid);
  const upperHalf = sorted.length % 2 !== 0 ? sorted.slice(mid + 1) : sorted.slice(mid);
  const q1 = median(lowerHalf);
  const q3 = median(upperHalf);
  return { q1, q3, iqr: q3 - q1 };
}

// ── Core Detection Functions ───────────────────────────────────────────

/**
 * Detect statistical outliers using z-score or IQR method.
 *
 * @param values - Array of numeric values
 * @param config - Detection configuration
 * @returns Array of anomaly points
 */
export function detectOutliers(
  values: number[],
  config: AnomalyDetectorConfig = {}
): AnomalyPoint[] {
  const cfg = { ...DEFAULT_ANOMALY_CONFIG, ...config };
  if (values.length < 3) return [];

  const anomalies: AnomalyPoint[] = [];

  if (cfg.method === "zscore") {
    const m = mean(values);
    const sd = stddev(values);
    if (sd === 0) return [];

    for (let i = 0; i < values.length; i++) {
      const z = Math.abs((values[i] - m) / sd);
      if (z > cfg.zScoreThreshold) {
        anomalies.push({
          index: i,
          value: values[i],
          score: Math.round(z * 100) / 100,
          reason: `Z-score ${z.toFixed(2)} exceeds threshold ${cfg.zScoreThreshold}`,
          severity: z > cfg.zScoreThreshold * 1.5 ? "high" : z > cfg.zScoreThreshold * 1.2 ? "medium" : "low",
        });
      }
    }
  } else {
    // IQR method
    const { q1, q3, iqr } = quartiles(values);
    if (iqr === 0) return [];
    const lower = q1 - cfg.iqrMultiplier * iqr;
    const upper = q3 + cfg.iqrMultiplier * iqr;

    for (let i = 0; i < values.length; i++) {
      if (values[i] < lower || values[i] > upper) {
        const distance = values[i] < lower
          ? (lower - values[i]) / iqr
          : (values[i] - upper) / iqr;
        anomalies.push({
          index: i,
          value: values[i],
          score: Math.round(distance * 100) / 100,
          reason: `Value ${values[i]} outside IQR range [${lower.toFixed(1)}, ${upper.toFixed(1)}]`,
          severity: distance > cfg.iqrMultiplier * 2 ? "high" : distance > cfg.iqrMultiplier ? "medium" : "low",
        });
      }
    }
  }

  return anomalies;
}

/**
 * Detect duplicate records based on specified field keys.
 *
 * @param records - Array of objects to check
 * @param keys - Field names to compare for duplicates
 * @returns Array of duplicate groups
 */
export function detectDuplicates<T extends Record<string, unknown>>(
  records: T[],
  keys: (keyof T & string)[]
): DuplicateGroup[] {
  const seen = new Map<string, number[]>();

  for (let i = 0; i < records.length; i++) {
    const fingerprint = keys.map((k) => String(records[i][k] ?? "")).join("|");
    const existing = seen.get(fingerprint);
    if (existing) {
      existing.push(i);
    } else {
      seen.set(fingerprint, [i]);
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [fingerprint, indices] of seen) {
    if (indices.length > 1) {
      const parts = fingerprint.split("|");
      const fields: Record<string, string | number> = {};
      keys.forEach((k, idx) => {
        fields[k] = parts[idx];
      });
      groups.push({ indices, fields });
    }
  }

  return groups;
}

/**
 * Detect temporal anomalies in date-ordered data.
 *
 * @param dates - Array of ISO date strings (YYYY-MM-DD or full ISO)
 * @param config - Detection configuration
 * @returns Array of temporal anomalies
 */
export function detectTemporalAnomalies(
  dates: string[],
  config: AnomalyDetectorConfig = {}
): TemporalAnomaly[] {
  const cfg = { ...DEFAULT_ANOMALY_CONFIG, ...config };
  const anomalies: TemporalAnomaly[] = [];
  const nowMs = Date.now() + 9 * 60 * 60 * 1000; // JST
  const maxAgeMs = cfg.maxAgeDays * 24 * 60 * 60 * 1000;
  const maxGapMs = cfg.maxGapDays * 24 * 60 * 60 * 1000;

  const timestamps = dates.map((d) => new Date(d).getTime());

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const dateStr = dates[i];

    // Future date (more than 1 day ahead)
    if (ts > nowMs + 24 * 60 * 60 * 1000) {
      anomalies.push({
        index: i,
        type: "future_date",
        description: `Date ${dateStr} is in the future`,
        date: dateStr,
      });
    }

    // Too old
    if (nowMs - ts > maxAgeMs) {
      anomalies.push({
        index: i,
        type: "too_old",
        description: `Date ${dateStr} is older than ${cfg.maxAgeDays} days`,
        date: dateStr,
      });
    }

    // Out of order
    if (i > 0 && ts < timestamps[i - 1]) {
      anomalies.push({
        index: i,
        type: "out_of_order",
        description: `Date ${dateStr} is before previous date ${dates[i - 1]}`,
        date: dateStr,
      });
    }

    // Impossible gap
    if (i > 0 && Math.abs(ts - timestamps[i - 1]) > maxGapMs) {
      anomalies.push({
        index: i,
        type: "impossible_gap",
        description: `Gap of ${Math.round(Math.abs(ts - timestamps[i - 1]) / (24 * 60 * 60 * 1000))} days exceeds max ${cfg.maxGapDays}`,
        date: dateStr,
      });
    }
  }

  return anomalies;
}

/**
 * Detect volume anomalies (unusual spikes or drops in activity).
 *
 * @param dates - Array of ISO date strings
 * @param config - Detection configuration
 * @returns Array of volume anomalies
 */
export function detectVolumeAnomalies(
  dates: string[],
  config: AnomalyDetectorConfig = {}
): VolumeAnomaly[] {
  const cfg = { ...DEFAULT_ANOMALY_CONFIG, ...config };
  if (dates.length < 7) return [];

  // Group by ISO week
  const weekCounts = new Map<string, number>();
  for (const d of dates) {
    const dt = new Date(d);
    const year = dt.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const dayOfYear = Math.ceil((dt.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((dayOfYear + jan1.getDay()) / 7);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
  }

  const weeks = [...weekCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (weeks.length < 4) return [];

  const anomalies: VolumeAnomaly[] = [];
  const counts = weeks.map(([, c]) => c);

  // Rolling average (4-week window)
  for (let i = 4; i < weeks.length; i++) {
    const windowCounts = counts.slice(i - 4, i);
    const avg = mean(windowCounts);
    if (avg === 0) continue;

    const ratio = counts[i] / avg;
    if (ratio > cfg.volumeThresholdRatio) {
      anomalies.push({
        period: weeks[i][0],
        count: counts[i],
        expected: Math.round(avg * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
        type: "spike",
      });
    } else if (ratio < 1 / cfg.volumeThresholdRatio) {
      anomalies.push({
        period: weeks[i][0],
        count: counts[i],
        expected: Math.round(avg * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
        type: "drop",
      });
    }
  }

  return anomalies;
}

/**
 * Validate values against domain-specific ranges.
 *
 * @param field - Field name (must be in DOMAIN_RANGES)
 * @param values - Array of numeric values
 * @returns Array of anomaly points for out-of-range values
 */
export function validateDomainRange(
  field: string,
  values: number[]
): AnomalyPoint[] {
  const range = DOMAIN_RANGES[field];
  if (!range) return [];

  const anomalies: AnomalyPoint[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] < range.min || values[i] > range.max) {
      const severity: "low" | "medium" | "high" =
        values[i] < 0 || values[i] > range.max * 2 ? "high" :
        values[i] < range.min * 0.5 || values[i] > range.max * 1.5 ? "medium" : "low";
      anomalies.push({
        index: i,
        value: values[i],
        score: 0,
        reason: `${field} value ${values[i]} outside valid range [${range.min}, ${range.max}] ${range.unit}`,
        severity,
      });
    }
  }

  return anomalies;
}

// ── Report Generation ──────────────────────────────────────────────────

/**
 * Run a comprehensive anomaly report on a dataset.
 *
 * @param data - Object with values (numeric arrays), dates, and records
 * @param config - Detection configuration
 * @returns Full anomaly report
 */
export function runAnomalyReport(
  data: {
    values?: Record<string, number[]>;
    dates?: string[];
    records?: Record<string, unknown>[];
    duplicateKeys?: string[];
  },
  config: AnomalyDetectorConfig = {}
): AnomalyReport {
  const allOutliers: AnomalyPoint[] = [];
  let totalRecords = 0;

  // Statistical outliers per field
  if (data.values) {
    for (const [field, vals] of Object.entries(data.values)) {
      totalRecords = Math.max(totalRecords, vals.length);

      // Domain range check
      allOutliers.push(...validateDomainRange(field, vals));

      // Statistical outlier check
      allOutliers.push(...detectOutliers(vals, config));
    }
  }

  // Duplicate detection
  const duplicates = data.records && data.duplicateKeys
    ? detectDuplicates(data.records, data.duplicateKeys)
    : [];

  // Temporal anomalies
  const temporalAnomalies = data.dates
    ? detectTemporalAnomalies(data.dates, config)
    : [];

  // Volume anomalies
  const volumeAnomalies = data.dates
    ? detectVolumeAnomalies(data.dates, config)
    : [];

  if (data.dates) {
    totalRecords = Math.max(totalRecords, data.dates.length);
  }
  if (data.records) {
    totalRecords = Math.max(totalRecords, data.records.length);
  }

  const stats = {
    outlierCount: allOutliers.length,
    duplicateCount: duplicates.reduce((sum, g) => sum + g.indices.length - 1, 0),
    temporalCount: temporalAnomalies.length,
    volumeCount: volumeAnomalies.length,
    totalAnomalies: 0,
  };
  stats.totalAnomalies = stats.outlierCount + stats.duplicateCount + stats.temporalCount + stats.volumeCount;

  const health: "clean" | "warning" | "critical" =
    stats.totalAnomalies === 0 ? "clean" :
    allOutliers.some((o) => o.severity === "high") || stats.duplicateCount > 5 ? "critical" :
    "warning";

  return {
    totalRecords,
    outliers: allOutliers,
    duplicates,
    temporalAnomalies,
    volumeAnomalies,
    health,
    stats,
  };
}

/**
 * Format an anomaly report as a human-readable string.
 */
export function formatAnomalyReport(report: AnomalyReport): string {
  const lines: string[] = [
    `=== Anomaly Report ===`,
    `Records analyzed: ${report.totalRecords}`,
    `Health: ${report.health.toUpperCase()}`,
    ``,
    `Summary:`,
    `  Outliers: ${report.stats.outlierCount}`,
    `  Duplicates: ${report.stats.duplicateCount}`,
    `  Temporal issues: ${report.stats.temporalCount}`,
    `  Volume anomalies: ${report.stats.volumeCount}`,
    `  Total: ${report.stats.totalAnomalies}`,
  ];

  if (report.outliers.length > 0) {
    lines.push("", "Outliers:");
    for (const o of report.outliers.slice(0, 10)) {
      lines.push(`  [${o.severity}] idx=${o.index} val=${o.value} — ${o.reason}`);
    }
    if (report.outliers.length > 10) {
      lines.push(`  ... and ${report.outliers.length - 10} more`);
    }
  }

  if (report.temporalAnomalies.length > 0) {
    lines.push("", "Temporal Issues:");
    for (const t of report.temporalAnomalies.slice(0, 10)) {
      lines.push(`  [${t.type}] idx=${t.index} — ${t.description}`);
    }
  }

  return lines.join("\n");
}
