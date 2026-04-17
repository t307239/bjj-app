/**
 * lib/formValidator.ts — Form validation UX utilities
 *
 * Q-151: UX pillar — provides form validation patterns,
 * error message generation, field-level validation state management,
 * and accessibility announcements for form errors.
 *
 * Pure utility layer — no React, no DOM. Returns validation results
 * that components can use for rendering.
 *
 * @example
 *   import { validateField, validateForm, getErrorAnnouncement, VALIDATION_RULES } from "@/lib/formValidator";
 *   const result = validateField("email", value, VALIDATION_RULES.email);
 *   const formResult = validateForm(fields, rules);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface ValidationRule {
  /** Rule identifier */
  id: string;
  /** Validation function — returns error message or null */
  validate: (value: string) => string | null;
  /** Priority (lower = checked first) */
  priority: number;
}

export interface FieldValidation {
  /** Field name */
  field: string;
  /** Whether field is valid */
  valid: boolean;
  /** Error message (null if valid) */
  error: string | null;
  /** Whether field has been touched (user interacted) */
  touched: boolean;
}

export interface FormValidation {
  /** Whether entire form is valid */
  valid: boolean;
  /** Per-field validation results */
  fields: Record<string, FieldValidation>;
  /** Total error count */
  errorCount: number;
  /** First field with error (for focus management) */
  firstErrorField: string | null;
  /** Accessibility announcement text */
  announcement: string;
}

export interface FormField {
  /** Field name */
  name: string;
  /** Current value */
  value: string;
  /** Whether user has interacted with field */
  touched: boolean;
  /** Validation rules to apply */
  rules: ValidationRule[];
}

// ── Constants ────────────────────────────────────────────────────────────

/** Built-in validation rules */
export const VALIDATION_RULES: Record<string, ValidationRule> = {
  required: {
    id: "required",
    validate: (v) => (v.trim().length === 0 ? "This field is required" : null),
    priority: 0,
  },
  email: {
    id: "email",
    validate: (v) => {
      if (v.trim().length === 0) return null; // let 'required' handle empty
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Please enter a valid email address";
    },
    priority: 1,
  },
  minLength3: {
    id: "minLength3",
    validate: (v) => (v.length > 0 && v.length < 3 ? "Must be at least 3 characters" : null),
    priority: 1,
  },
  maxLength100: {
    id: "maxLength100",
    validate: (v) => (v.length > 100 ? "Must be 100 characters or fewer" : null),
    priority: 1,
  },
  maxLength500: {
    id: "maxLength500",
    validate: (v) => (v.length > 500 ? "Must be 500 characters or fewer" : null),
    priority: 1,
  },
  numericPositive: {
    id: "numericPositive",
    validate: (v) => {
      if (v.trim().length === 0) return null;
      const n = Number(v);
      return isNaN(n) || n <= 0 ? "Must be a positive number" : null;
    },
    priority: 1,
  },
  dateNotFuture: {
    id: "dateNotFuture",
    validate: (v) => {
      if (v.trim().length === 0) return null;
      const d = new Date(v);
      if (isNaN(d.getTime())) return "Please enter a valid date";
      return d > new Date() ? "Date cannot be in the future" : null;
    },
    priority: 1,
  },
  urlOptional: {
    id: "urlOptional",
    validate: (v) => {
      if (v.trim().length === 0) return null;
      try {
        new URL(v);
        return null;
      } catch {
        return "Please enter a valid URL";
      }
    },
    priority: 1,
  },
};

/** Aria-live announcement delay (ms) for debouncing */
export const ANNOUNCE_DELAY_MS = 300;

// ── Validation ──────────────────────────────────────────────────────────

/**
 * Validate a single field value against rules.
 * Returns the first error found (rules sorted by priority).
 */
export function validateField(
  fieldName: string,
  value: string,
  rules: ValidationRule[],
  touched: boolean = true,
): FieldValidation {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const error = rule.validate(value);
    if (error !== null) {
      return { field: fieldName, valid: false, error, touched };
    }
  }

  return { field: fieldName, valid: true, error: null, touched };
}

/**
 * Validate an entire form.
 */
export function validateForm(fields: FormField[]): FormValidation {
  const fieldResults: Record<string, FieldValidation> = {};
  let firstErrorField: string | null = null;

  for (const f of fields) {
    const result = validateField(f.name, f.value, f.rules, f.touched);
    fieldResults[f.name] = result;
    if (!result.valid && firstErrorField === null) {
      firstErrorField = f.name;
    }
  }

  const errorCount = Object.values(fieldResults).filter((f) => !f.valid).length;
  const valid = errorCount === 0;

  const announcement = getErrorAnnouncement(fieldResults);

  return {
    valid,
    fields: fieldResults,
    errorCount,
    firstErrorField,
    announcement,
  };
}

/**
 * Generate an accessibility announcement for form errors.
 * Returns a string suitable for aria-live region.
 */
export function getErrorAnnouncement(
  fields: Record<string, FieldValidation>,
): string {
  const errors = Object.values(fields).filter((f) => !f.valid && f.touched);

  if (errors.length === 0) return "";
  if (errors.length === 1) {
    return `Error in ${errors[0].field}: ${errors[0].error}`;
  }
  return `${errors.length} errors found. First error in ${errors[0].field}: ${errors[0].error}`;
}

/**
 * Build aria attributes for a form field.
 */
export function getFieldAriaProps(
  validation: FieldValidation,
  errorElementId: string,
): Record<string, string | boolean> {
  const props: Record<string, string | boolean> = {};

  if (!validation.valid && validation.touched) {
    props["aria-invalid"] = true;
    props["aria-describedby"] = errorElementId;
    props["aria-errormessage"] = errorElementId;
  } else {
    props["aria-invalid"] = false;
  }

  return props;
}

/**
 * Create a custom validation rule.
 */
export function createRule(
  id: string,
  validate: (value: string) => string | null,
  priority: number = 1,
): ValidationRule {
  return { id, validate, priority };
}

/**
 * Combine multiple validation rules.
 */
export function combineRules(...rules: ValidationRule[]): ValidationRule[] {
  return [...rules].sort((a, b) => a.priority - b.priority);
}

/**
 * Format a form validation summary.
 */
export function formatValidationSummary(form: FormValidation): string {
  if (form.valid) return "✅ Form is valid";

  const lines = [`❌ ${form.errorCount} error(s) found:`];
  for (const [name, field] of Object.entries(form.fields)) {
    if (!field.valid) {
      lines.push(`  • ${name}: ${field.error}`);
    }
  }
  return lines.join("\n");
}
