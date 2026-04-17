/**
 * Q-181: Data Migration Helper (Data 94→95)
 *
 * Schema version management, migration validation, rollback planning,
 * and data transformation pipelines for SaaS-grade data integrity.
 */

// ── Types & Constants ──────────────────────────────────────

export interface MigrationStep {
  version: string;       // semver e.g. "2.1.0"
  name: string;          // human-readable name
  description: string;
  up: string;            // SQL or transformation description
  down: string;          // rollback SQL
  destructive: boolean;
  estimatedRows?: number;
  requiresDowntime: boolean;
}

export interface MigrationPlan {
  current: string;
  target: string;
  steps: MigrationStep[];
  totalSteps: number;
  hasDestructive: boolean;
  requiresDowntime: boolean;
  estimatedDuration: string;
  rollbackPlan: MigrationStep[];
}

export interface MigrationValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SchemaSnapshot {
  version: string;
  tables: string[];
  timestamp: string;
}

export type VersionComparison = "ahead" | "behind" | "equal" | "diverged";

// ── Version Utilities ──────────────────────────────────────

/**
 * Parse semver string into components
 */
export function parseSemver(version: string): {
  major: number;
  minor: number;
  patch: number;
} | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two semver strings: -1 (a<b), 0 (equal), 1 (a>b)
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
  return 0;
}

/**
 * Compare current version against target
 */
export function compareVersions(
  current: string,
  target: string
): VersionComparison {
  const result = compareSemver(current, target);
  if (result === 0) return "equal";
  return result > 0 ? "ahead" : "behind";
}

// ── Migration Planning ─────────────────────────────────────

/**
 * Filter and sort migration steps between two versions
 */
export function getStepsBetween(
  steps: MigrationStep[],
  from: string,
  to: string
): MigrationStep[] {
  const direction = compareSemver(from, to);
  if (direction === 0) return [];

  const sorted = [...steps].sort((a, b) => compareSemver(a.version, b.version));

  if (direction < 0) {
    // Forward: from < to
    return sorted.filter(
      (s) => compareSemver(s.version, from) > 0 && compareSemver(s.version, to) <= 0
    );
  } else {
    // Rollback: from > to — reverse order
    return sorted
      .filter(
        (s) => compareSemver(s.version, to) > 0 && compareSemver(s.version, from) <= 0
      )
      .reverse();
  }
}

/**
 * Build a full migration plan
 */
export function buildMigrationPlan(
  steps: MigrationStep[],
  current: string,
  target: string
): MigrationPlan {
  const planSteps = getStepsBetween(steps, current, target);
  const hasDestructive = planSteps.some((s) => s.destructive);
  const requiresDowntime = planSteps.some((s) => s.requiresDowntime);

  // Estimate: 1 min per step, 5 min for destructive, 10 min for downtime
  const minutes = planSteps.reduce((sum, s) => {
    return sum + (s.requiresDowntime ? 10 : s.destructive ? 5 : 1);
  }, 0);
  const estimatedDuration =
    minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60 * 10) / 10} hr`;

  // Rollback plan is the reverse steps
  const rollbackPlan = planSteps
    .slice()
    .reverse()
    .map((s) => ({
      ...s,
      up: s.down,
      down: s.up,
      name: `Rollback: ${s.name}`,
    }));

  return {
    current,
    target,
    steps: planSteps,
    totalSteps: planSteps.length,
    hasDestructive,
    requiresDowntime,
    estimatedDuration,
    rollbackPlan,
  };
}

// ── Validation ─────────────────────────────────────────────

/**
 * Validate a migration plan for safety
 */
export function validateMigrationPlan(
  plan: MigrationPlan
): MigrationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (plan.steps.length === 0) {
    errors.push("No migration steps found between versions");
  }

  // Check for gaps in version sequence
  for (let i = 1; i < plan.steps.length; i++) {
    const prev = plan.steps[i - 1];
    const curr = plan.steps[i];
    if (compareSemver(prev.version, curr.version) >= 0) {
      errors.push(
        `Version ordering error: ${prev.version} should come before ${curr.version}`
      );
    }
  }

  // Check destructive steps have rollback
  for (const step of plan.steps) {
    if (step.destructive && !step.down) {
      errors.push(
        `Destructive step "${step.name}" (${step.version}) has no rollback defined`
      );
    }
    if (step.destructive) {
      warnings.push(
        `Destructive step "${step.name}" will modify data irreversibly`
      );
    }
    if (step.requiresDowntime) {
      warnings.push(
        `Step "${step.name}" requires downtime — schedule maintenance window`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate schema snapshot consistency
 */
export function validateSchemaSnapshot(
  before: SchemaSnapshot,
  after: SchemaSnapshot,
  expectedNewTables: string[],
  expectedDroppedTables: string[]
): MigrationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const beforeSet = new Set(before.tables);
  const afterSet = new Set(after.tables);

  for (const table of expectedNewTables) {
    if (!afterSet.has(table)) {
      errors.push(`Expected new table "${table}" not found after migration`);
    }
  }

  for (const table of expectedDroppedTables) {
    if (afterSet.has(table)) {
      errors.push(`Expected dropped table "${table}" still exists`);
    }
  }

  // Check for unexpected changes
  for (const table of before.tables) {
    if (!afterSet.has(table) && !expectedDroppedTables.includes(table)) {
      warnings.push(`Table "${table}" was unexpectedly removed`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Format migration plan as readable string
 */
export function formatMigrationPlan(plan: MigrationPlan): string {
  const lines = [
    `# Migration Plan: ${plan.current} → ${plan.target}`,
    `Steps: ${plan.totalSteps} | Duration: ~${plan.estimatedDuration}`,
    `Destructive: ${plan.hasDestructive ? "YES ⚠️" : "No"}`,
    `Downtime: ${plan.requiresDowntime ? "REQUIRED ⚠️" : "No"}`,
    ``,
    `## Steps`,
  ];
  for (let i = 0; i < plan.steps.length; i++) {
    const s = plan.steps[i];
    const flags = [
      s.destructive ? "💥" : "",
      s.requiresDowntime ? "🔒" : "",
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`${i + 1}. [${s.version}] ${s.name} ${flags}`);
    lines.push(`   ${s.description}`);
  }
  return lines.join("\n");
}
