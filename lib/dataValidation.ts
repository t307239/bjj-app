/**
 * lib/dataValidation.ts — Runtime data validation utilities
 *
 * Q-118: Data pillar — provides validation helpers for training log data,
 * profile data, and other user-generated content before DB writes.
 *
 * These are runtime checks on top of Zod schema validation. They catch
 * domain-specific invariants that schema validation alone cannot express.
 *
 * @example
 *   import { validateTrainingLog, validateBelt } from "@/lib/dataValidation";
 *   const errors = validateTrainingLog({ date: "2026-13-01", duration_min: -5 });
 *   // → ["Invalid date format", "Duration must be positive"]
 */

/** Valid belt values in order of progression */
export const VALID_BELTS = ["white", "blue", "purple", "brown", "black"] as const;
export type Belt = typeof VALID_BELTS[number];

/** Maximum reasonable values for sanity checking */
export const LIMITS = {
  /** Max training duration in minutes (8 hours) */
  MAX_DURATION_MIN: 480,
  /** Max stripe count per belt */
  MAX_STRIPE: 4,
  /** Max reasonable weight in kg */
  MAX_WEIGHT_KG: 300,
  /** Min reasonable weight in kg */
  MIN_WEIGHT_KG: 20,
  /** Max notes length */
  MAX_NOTES_LENGTH: 5000,
  /** Max technique name length */
  MAX_TECHNIQUE_NAME: 200,
} as const;

/**
 * Validate a training log entry before DB write.
 * Returns an array of error messages (empty = valid).
 */
export function validateTrainingLog(data: {
  date?: string;
  duration_min?: number;
  type?: string;
  notes?: string;
}): string[] {
  const errors: string[] = [];

  // Date validation
  if (data.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      errors.push("Invalid date format (expected YYYY-MM-DD)");
    } else {
      const d = new Date(data.date + "T00:00:00Z");
      if (isNaN(d.getTime())) {
        errors.push("Invalid date value");
      }
      // No future dates beyond tomorrow (timezone tolerance)
      const tomorrow = new Date(Date.now() + 2 * 86400000);
      if (d > tomorrow) {
        errors.push("Date cannot be more than 1 day in the future");
      }
    }
  }

  // Duration validation
  if (data.duration_min !== undefined) {
    if (data.duration_min <= 0) {
      errors.push("Duration must be positive");
    }
    if (data.duration_min > LIMITS.MAX_DURATION_MIN) {
      errors.push(`Duration exceeds maximum (${LIMITS.MAX_DURATION_MIN} min)`);
    }
  }

  // Notes length
  if (data.notes && data.notes.length > LIMITS.MAX_NOTES_LENGTH) {
    errors.push(`Notes exceed maximum length (${LIMITS.MAX_NOTES_LENGTH} chars)`);
  }

  return errors;
}

/**
 * Validate belt value.
 */
export function validateBelt(belt: string): belt is Belt {
  return (VALID_BELTS as readonly string[]).includes(belt);
}

/**
 * Validate stripe count for a given belt.
 */
export function validateStripe(stripe: number, belt: string): string | null {
  if (stripe < 0) return "Stripe cannot be negative";
  if (stripe > LIMITS.MAX_STRIPE) return `Stripe exceeds maximum (${LIMITS.MAX_STRIPE})`;
  if (belt === "black" && stripe > LIMITS.MAX_STRIPE) return "Black belt stripe exceeds limit";
  return null;
}

/**
 * Validate weight value (kg).
 */
export function validateWeight(weightKg: number): string | null {
  if (weightKg < LIMITS.MIN_WEIGHT_KG) return `Weight below minimum (${LIMITS.MIN_WEIGHT_KG}kg)`;
  if (weightKg > LIMITS.MAX_WEIGHT_KG) return `Weight exceeds maximum (${LIMITS.MAX_WEIGHT_KG}kg)`;
  return null;
}

/**
 * Sanitize user text input — trim, collapse whitespace, limit length.
 */
export function sanitizeText(text: string, maxLength: number = LIMITS.MAX_NOTES_LENGTH): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}
