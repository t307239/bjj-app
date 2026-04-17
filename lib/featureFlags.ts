/**
 * lib/featureFlags.ts — Q-130: Simple feature flag / A/B test utility
 *
 * Provides deterministic user-based feature flag evaluation for A/B testing.
 * Uses hashing to assign users to variants consistently without external services.
 *
 * Usage:
 *   import { getVariant, isFeatureEnabled, EXPERIMENTS } from "@/lib/featureFlags";
 *
 *   const variant = getVariant("progate_copy", userId);
 *   if (variant === "b") { ... }
 */

/**
 * Active experiments configuration.
 * Each experiment defines variants and their traffic allocation.
 */
export const EXPERIMENTS = {
  progate_copy: {
    description: "ProGate social proof copy optimization",
    variants: ["a", "b"] as const,
    /** Percentage of traffic for variant B (0-100) */
    trafficPercent: 50,
    enabled: true,
  },
  pricing_layout: {
    description: "Pricing section layout optimization",
    variants: ["a", "b"] as const,
    trafficPercent: 50,
    enabled: false, // ready for future use
  },
  onboarding_flow: {
    description: "Onboarding step count optimization",
    variants: ["a", "b"] as const,
    trafficPercent: 50,
    enabled: false,
  },
} as const;

export type ExperimentName = keyof typeof EXPERIMENTS;
export type Variant = "a" | "b";

/**
 * Simple deterministic hash function.
 * Converts a string to a number between 0-99 for consistent bucketing.
 */
function hashToPercent(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0; // Convert to 32-bit int
  }
  return Math.abs(hash) % 100;
}

/**
 * Get the variant assigned to a user for a given experiment.
 * Returns "a" (control) if experiment is disabled or user not in treatment group.
 *
 * @param experiment - Experiment name from EXPERIMENTS
 * @param userId - Unique user identifier for consistent bucketing
 * @returns "a" (control) or "b" (treatment)
 */
export function getVariant(experiment: ExperimentName, userId: string): Variant {
  const config = EXPERIMENTS[experiment];
  if (!config.enabled) return "a";

  const bucket = hashToPercent(`${experiment}:${userId}`);
  return bucket < config.trafficPercent ? "b" : "a";
}

/**
 * Check if a feature flag is enabled for a user.
 * Convenience wrapper around getVariant for boolean flags.
 */
export function isFeatureEnabled(experiment: ExperimentName, userId: string): boolean {
  return getVariant(experiment, userId) === "b";
}

/**
 * Get all experiment assignments for a user.
 * Useful for analytics event properties.
 */
export function getAllAssignments(userId: string): Record<ExperimentName, Variant> {
  const assignments = {} as Record<ExperimentName, Variant>;
  for (const name of Object.keys(EXPERIMENTS) as ExperimentName[]) {
    assignments[name] = getVariant(name, userId);
  }
  return assignments;
}
