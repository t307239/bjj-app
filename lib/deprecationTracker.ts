/**
 * deprecationTracker.ts — Deprecated API & code migration tracker
 *
 * Tracks deprecated functions/APIs, generates migration guides,
 * and enforces sunset timelines.
 *
 * Pure functions — no file system access.
 *
 * @module Q-191 DX 95→97
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface DeprecatedItem {
  readonly name: string;
  readonly type: "function" | "component" | "api" | "hook" | "type" | "constant";
  readonly location: string;
  readonly deprecatedSince: string; // semver
  readonly removalTarget: string; // semver
  readonly replacement?: string;
  readonly migrationGuide?: string;
  readonly usageCount: number;
  readonly severity: "info" | "warning" | "urgent";
}

export interface MigrationStep {
  readonly file: string;
  readonly oldCode: string;
  readonly newCode: string;
  readonly description: string;
}

export interface MigrationPlan {
  readonly item: DeprecatedItem;
  readonly steps: readonly MigrationStep[];
  readonly estimatedEffort: "trivial" | "small" | "medium" | "large";
  readonly breakingChange: boolean;
  readonly testRequired: boolean;
}

export interface DeprecationReport {
  readonly items: readonly DeprecatedItem[];
  readonly urgentCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly migrationPlans: readonly MigrationPlan[];
  readonly healthScore: number;
  readonly grade: string;
}

export interface SunsetTimeline {
  readonly version: string;
  readonly items: readonly DeprecatedItem[];
  readonly daysUntilRemoval: number;
  readonly status: "safe" | "approaching" | "overdue";
}

// ── Constants ───────────────────────────────────────────────────────────────

/** How many days before removal to escalate severity */
export const SUNSET_WARNING_DAYS = 30;
export const SUNSET_URGENT_DAYS = 7;

/** Effort estimation thresholds */
const EFFORT_THRESHOLDS = {
  trivial: 1, // 1 usage
  small: 5,   // 2-5 usages
  medium: 15, // 6-15 usages
  // large: 16+
} as const;

// ── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Parse semver string to comparable tuple.
 */
function parseSemver(version: string): [number, number, number] {
  const parts = version.replace(/^v/, "").split(".");
  return [
    parseInt(parts[0] || "0", 10),
    parseInt(parts[1] || "0", 10),
    parseInt(parts[2] || "0", 10),
  ];
}

/**
 * Compare two semver strings. Returns -1/0/1.
 */
export function compareSemver(a: string, b: string): number {
  const [a1, a2, a3] = parseSemver(a);
  const [b1, b2, b3] = parseSemver(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

/**
 * Classify severity based on current version vs removal target.
 */
export function classifySeverity(
  currentVersion: string,
  removalTarget: string
): "info" | "warning" | "urgent" {
  const current = parseSemver(currentVersion);
  const target = parseSemver(removalTarget);

  // If current >= removal target, it's urgent (overdue)
  if (current[0] > target[0]) return "urgent";
  if (current[0] === target[0] && current[1] > target[1]) return "urgent";
  if (current[0] === target[0] && current[1] === target[1] && current[2] >= target[2]) return "urgent";

  // If same major, approaching
  if (current[0] === target[0]) {
    const minorDiff = target[1] - current[1];
    if (minorDiff <= 1) return "warning";
  }

  return "info";
}

/**
 * Estimate migration effort based on usage count and item type.
 */
export function estimateEffort(
  item: DeprecatedItem
): "trivial" | "small" | "medium" | "large" {
  const count = item.usageCount;
  if (count <= EFFORT_THRESHOLDS.trivial) return "trivial";
  if (count <= EFFORT_THRESHOLDS.small) return "small";
  if (count <= EFFORT_THRESHOLDS.medium) return "medium";
  return "large";
}

/**
 * Generate migration plan for a deprecated item.
 */
export function generateMigrationPlan(
  item: DeprecatedItem
): MigrationPlan {
  const steps: MigrationStep[] = [];

  if (item.replacement) {
    steps.push({
      file: item.location,
      oldCode: item.name,
      newCode: item.replacement,
      description: `Replace ${item.name} with ${item.replacement}`,
    });
  }

  if (item.migrationGuide) {
    steps.push({
      file: "migration-notes",
      oldCode: "",
      newCode: "",
      description: item.migrationGuide,
    });
  }

  const effort = estimateEffort(item);
  const breakingChange = item.type === "api" || item.type === "type";
  const testRequired = item.type !== "constant" && item.usageCount > 0;

  return {
    item,
    steps,
    estimatedEffort: effort,
    breakingChange,
    testRequired,
  };
}

/**
 * Build deprecation report from list of deprecated items.
 */
export function buildDeprecationReport(
  items: readonly DeprecatedItem[],
  currentVersion: string
): DeprecationReport {
  const classifiedItems = items.map((item) => ({
    ...item,
    severity: classifySeverity(currentVersion, item.removalTarget),
  }));

  const urgentCount = classifiedItems.filter((i) => i.severity === "urgent").length;
  const warningCount = classifiedItems.filter((i) => i.severity === "warning").length;
  const infoCount = classifiedItems.filter((i) => i.severity === "info").length;

  const migrationPlans = classifiedItems
    .filter((i) => i.severity !== "info")
    .map(generateMigrationPlan);

  // Health score: 100 - penalties
  let healthScore = 100;
  healthScore -= urgentCount * 15;
  healthScore -= warningCount * 5;
  healthScore -= infoCount * 1;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const grade =
    healthScore >= 95 ? "A+" :
    healthScore >= 90 ? "A" :
    healthScore >= 80 ? "B" :
    healthScore >= 70 ? "C" :
    healthScore >= 50 ? "D" : "F";

  return {
    items: classifiedItems,
    urgentCount,
    warningCount,
    infoCount,
    migrationPlans,
    healthScore,
    grade,
  };
}

/**
 * Group deprecated items by removal target version.
 */
export function buildSunsetTimeline(
  items: readonly DeprecatedItem[],
  currentVersion: string
): SunsetTimeline[] {
  const versionGroups: Record<string, DeprecatedItem[]> = {};

  for (const item of items) {
    if (!versionGroups[item.removalTarget]) {
      versionGroups[item.removalTarget] = [];
    }
    versionGroups[item.removalTarget].push(item);
  }

  return Object.entries(versionGroups)
    .map(([version, groupItems]) => {
      const cmp = compareSemver(currentVersion, version);
      let status: "safe" | "approaching" | "overdue" = "safe";
      let daysUntilRemoval = 90; // default estimate

      if (cmp >= 0) {
        status = "overdue";
        daysUntilRemoval = 0;
      } else {
        const current = parseSemver(currentVersion);
        const target = parseSemver(version);
        const minorDiff = (target[0] - current[0]) * 12 + (target[1] - current[1]);
        daysUntilRemoval = minorDiff * 30; // rough estimate
        if (daysUntilRemoval <= SUNSET_URGENT_DAYS) status = "overdue";
        else if (daysUntilRemoval <= SUNSET_WARNING_DAYS) status = "approaching";
      }

      return {
        version,
        items: groupItems,
        daysUntilRemoval,
        status,
      };
    })
    .sort((a, b) => compareSemver(a.version, b.version));
}

/**
 * Find items that need immediate attention.
 */
export function findUrgentDeprecations(
  items: readonly DeprecatedItem[],
  currentVersion: string
): DeprecatedItem[] {
  return items.filter(
    (item) => classifySeverity(currentVersion, item.removalTarget) === "urgent"
  );
}

/**
 * Format deprecation report as string.
 */
export function formatDeprecationReport(report: DeprecationReport): string {
  const lines = [
    `=== Deprecation Report ===`,
    `Health: ${report.healthScore}/100 (${report.grade})`,
    `Urgent: ${report.urgentCount} | Warning: ${report.warningCount} | Info: ${report.infoCount}`,
  ];

  if (report.items.length === 0) {
    lines.push("No deprecated items found ✅");
    return lines.join("\n");
  }

  lines.push("");
  for (const item of report.items) {
    const icon = item.severity === "urgent" ? "🔴" : item.severity === "warning" ? "🟡" : "🟢";
    lines.push(
      `${icon} ${item.name} (${item.type}) — remove by ${item.removalTarget}${item.replacement ? ` → ${item.replacement}` : ""} [${item.usageCount} usages]`
    );
  }

  if (report.migrationPlans.length > 0) {
    lines.push("", "--- Migration Plans ---");
    for (const plan of report.migrationPlans) {
      lines.push(
        `• ${plan.item.name}: effort=${plan.estimatedEffort}, breaking=${plan.breakingChange}, tests=${plan.testRequired}`
      );
    }
  }

  return lines.join("\n");
}
