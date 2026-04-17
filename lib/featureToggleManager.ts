/**
 * lib/featureToggleManager.ts — Feature toggle lifecycle management
 *
 * Q-162: Infra pillar — provides feature toggle lifecycle management,
 * stale toggle detection, toggle dependency tracking, and rollout
 * percentage control for safe feature releases.
 *
 * Pure utility layer — no DB access, no UI.
 *
 * @example
 *   import { defineToggle, evaluateToggle, findStaleToggles, TOGGLE_STATES } from "@/lib/featureToggleManager";
 *   const toggle = defineToggle("new_dashboard", { rolloutPercent: 50 });
 *   const enabled = evaluateToggle(toggle, userId);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface FeatureToggle {
  /** Unique toggle ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Current state */
  state: ToggleState;
  /** Rollout percentage (0-100) */
  rolloutPercent: number;
  /** Created date */
  createdAt: string;
  /** Last modified */
  modifiedAt: string;
  /** Expiry date (stale detection) */
  expiresAt: string | null;
  /** Owner */
  owner: string;
  /** Dependencies (other toggle IDs that must be enabled) */
  dependencies: string[];
  /** Tags */
  tags: string[];
}

export type ToggleState = "off" | "gradual" | "on" | "archived";

export interface ToggleEvaluation {
  /** Toggle ID */
  toggleId: string;
  /** Whether enabled for this user */
  enabled: boolean;
  /** Reason */
  reason: EvalReason;
}

export type EvalReason =
  | "toggle_off"
  | "toggle_on"
  | "rollout_included"
  | "rollout_excluded"
  | "dependency_not_met"
  | "toggle_archived";

export interface ToggleAudit {
  /** Total toggles */
  total: number;
  /** Active toggles */
  active: number;
  /** Stale toggles (past expiry) */
  stale: number;
  /** Archived toggles */
  archived: number;
  /** Toggles by state */
  byState: Record<ToggleState, number>;
  /** Health status */
  health: "healthy" | "warning" | "critical";
}

// ── Constants ────────────────────────────────────────────────────────────

/** Toggle states */
export const TOGGLE_STATES: ToggleState[] = ["off", "gradual", "on", "archived"];

/** Max stale toggles before warning */
export const STALE_WARNING_THRESHOLD = 5;

/** Max stale toggles before critical */
export const STALE_CRITICAL_THRESHOLD = 10;

/** Default toggle expiry (90 days from creation) */
export const DEFAULT_EXPIRY_DAYS = 90;

// ── Toggle Management ───────────────────────────────────────────────────

/**
 * Define a new feature toggle.
 */
export function defineToggle(
  id: string,
  options: {
    name?: string;
    description?: string;
    state?: ToggleState;
    rolloutPercent?: number;
    expiryDays?: number;
    owner?: string;
    dependencies?: string[];
    tags?: string[];
  } = {},
): FeatureToggle {
  const now = new Date().toISOString();
  const expiryDays = options.expiryDays ?? DEFAULT_EXPIRY_DAYS;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  return {
    id,
    name: options.name ?? id,
    description: options.description ?? "",
    state: options.state ?? "off",
    rolloutPercent: Math.max(0, Math.min(100, options.rolloutPercent ?? 0)),
    createdAt: now,
    modifiedAt: now,
    expiresAt,
    owner: options.owner ?? "team",
    dependencies: options.dependencies ?? [],
    tags: options.tags ?? [],
  };
}

/**
 * Evaluate whether a toggle is enabled for a given user.
 */
export function evaluateToggle(
  toggle: FeatureToggle,
  userId: string,
  allToggles: FeatureToggle[] = [],
): ToggleEvaluation {
  if (toggle.state === "archived") {
    return { toggleId: toggle.id, enabled: false, reason: "toggle_archived" };
  }

  if (toggle.state === "off") {
    return { toggleId: toggle.id, enabled: false, reason: "toggle_off" };
  }

  if (toggle.state === "on") {
    // Check dependencies
    if (toggle.dependencies.length > 0) {
      const depsMet = toggle.dependencies.every((depId) => {
        const depToggle = allToggles.find((t) => t.id === depId);
        return depToggle ? depToggle.state === "on" || depToggle.state === "gradual" : false;
      });
      if (!depsMet) {
        return { toggleId: toggle.id, enabled: false, reason: "dependency_not_met" };
      }
    }
    return { toggleId: toggle.id, enabled: true, reason: "toggle_on" };
  }

  // Gradual rollout — deterministic hash
  if (toggle.dependencies.length > 0) {
    const depsMet = toggle.dependencies.every((depId) => {
      const depToggle = allToggles.find((t) => t.id === depId);
      return depToggle ? depToggle.state === "on" || depToggle.state === "gradual" : false;
    });
    if (!depsMet) {
      return { toggleId: toggle.id, enabled: false, reason: "dependency_not_met" };
    }
  }

  const hash = deterministicHash(`${toggle.id}:${userId}`);
  const bucket = hash % 100;
  const enabled = bucket < toggle.rolloutPercent;

  return {
    toggleId: toggle.id,
    enabled,
    reason: enabled ? "rollout_included" : "rollout_excluded",
  };
}

/**
 * Find stale toggles (past expiry date).
 */
export function findStaleToggles(
  toggles: FeatureToggle[],
  now: Date = new Date(),
): FeatureToggle[] {
  return toggles.filter((t) => {
    if (t.state === "archived") return false;
    if (!t.expiresAt) return false;
    return new Date(t.expiresAt) < now;
  });
}

/**
 * Find toggles with unmet dependencies.
 */
export function findBrokenDependencies(toggles: FeatureToggle[]): { toggle: FeatureToggle; missingDeps: string[] }[] {
  const toggleMap = new Map(toggles.map((t) => [t.id, t]));
  const broken: { toggle: FeatureToggle; missingDeps: string[] }[] = [];

  for (const toggle of toggles) {
    if (toggle.state === "archived") continue;
    const missingDeps = toggle.dependencies.filter((depId) => {
      const dep = toggleMap.get(depId);
      return !dep || dep.state === "archived" || dep.state === "off";
    });
    if (missingDeps.length > 0) {
      broken.push({ toggle, missingDeps });
    }
  }

  return broken;
}

/**
 * Audit toggle health.
 */
export function auditToggles(toggles: FeatureToggle[]): ToggleAudit {
  const byState: Record<ToggleState, number> = { off: 0, gradual: 0, on: 0, archived: 0 };
  for (const t of toggles) byState[t.state]++;

  const stale = findStaleToggles(toggles).length;
  const active = toggles.filter((t) => t.state !== "archived").length;

  let health: ToggleAudit["health"];
  if (stale >= STALE_CRITICAL_THRESHOLD) {
    health = "critical";
  } else if (stale >= STALE_WARNING_THRESHOLD) {
    health = "warning";
  } else {
    health = "healthy";
  }

  return {
    total: toggles.length,
    active,
    stale,
    archived: byState.archived,
    byState,
    health,
  };
}

/**
 * Format toggle audit as human-readable string.
 */
export function formatToggleAudit(audit: ToggleAudit): string {
  const icon = audit.health === "healthy" ? "✅" : audit.health === "warning" ? "⚠️" : "🔴";
  return [
    `${icon} Feature Toggles: ${audit.total} total (${audit.active} active, ${audit.archived} archived)`,
    `   Stale: ${audit.stale} | On: ${audit.byState.on} | Gradual: ${audit.byState.gradual} | Off: ${audit.byState.off}`,
  ].join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Deterministic hash for consistent bucketing.
 */
export function deterministicHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}
