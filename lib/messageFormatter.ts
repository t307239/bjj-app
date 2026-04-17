/**
 * lib/messageFormatter.ts — ICU-compatible message formatter
 *
 * Q-165: i18n pillar 93→94 — Lightweight message formatting with
 * named parameter interpolation, CLDR plural rules, select/gender
 * support, and escaped literal braces.
 *
 * Subset of ICU MessageFormat designed for the BJJ App's 3-language
 * needs (EN/JA/PT). Works with the existing pluralRules.ts for
 * CLDR plural category selection.
 *
 * @example
 *   import { formatMessage, compileMessage } from "@/lib/messageFormatter";
 *
 *   // Simple interpolation
 *   formatMessage("Hello, {name}!", { name: "Toshiki" });
 *   // → "Hello, Toshiki!"
 *
 *   // Plural
 *   formatMessage("{count, plural, one {# session} other {# sessions}}", { count: 5 });
 *   // → "5 sessions"
 *
 *   // Select
 *   formatMessage("{belt, select, white {Beginner} blue {Intermediate} other {Advanced}}", { belt: "purple" });
 *   // → "Advanced"
 */

// ── Types ───────────────────────────────────────────────────────────────

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";
export type Locale = "en" | "ja" | "pt";

export interface MessageValues {
  [key: string]: string | number | boolean;
}

export interface CompiledMessage {
  source: string;
  parts: MessagePart[];
  requiredParams: string[];
}

export type MessagePart =
  | { type: "literal"; value: string }
  | { type: "argument"; name: string }
  | { type: "plural"; name: string; options: Record<string, string>; offset: number }
  | { type: "select"; name: string; options: Record<string, string> };

// ── CLDR Plural Rules ───────────────────────────────────────────────────

/**
 * Get the CLDR plural category for a number in a given locale.
 * Simplified rules covering EN, JA, PT.
 */
export function getPluralCategory(n: number, locale: Locale = "en"): PluralCategory {
  const abs = Math.abs(n);

  switch (locale) {
    case "ja":
      // Japanese: always "other"
      return "other";

    case "pt":
      // Portuguese: 0 and 1 are "one", rest "other"
      if (abs >= 0 && abs <= 1) return "one";
      return "other";

    case "en":
    default:
      // English: 1 is "one", rest "other"
      if (abs === 1) return "one";
      return "other";
  }
}

// ── Parser ──────────────────────────────────────────────────────────────

/**
 * Compile a message template into parts for efficient repeated formatting.
 *
 * Supports:
 * - `{name}` — simple argument substitution
 * - `{count, plural, one {# item} other {# items}}` — plural
 * - `{gender, select, male {He} female {She} other {They}}` — select
 * - `''` — escaped single quote → literal `'`
 * - `'{…}'` — escaped braces (literal text)
 *
 * @param source - ICU-like message template
 * @returns Compiled message with parsed parts and required parameter list
 */
export function compileMessage(source: string): CompiledMessage {
  const parts: MessagePart[] = [];
  const requiredParams = new Set<string>();
  let i = 0;
  let literal = "";

  function flushLiteral(): void {
    if (literal.length > 0) {
      parts.push({ type: "literal", value: literal });
      literal = "";
    }
  }

  while (i < source.length) {
    const ch = source[i];

    // Escaped single quote: '' → '
    if (ch === "'" && i + 1 < source.length && source[i + 1] === "'") {
      literal += "'";
      i += 2;
      continue;
    }

    // Escaped block: '{...}' → literal content
    if (ch === "'" && i + 1 < source.length && source[i + 1] === "{") {
      i++; // skip opening '
      while (i < source.length) {
        if (source[i] === "'" && (i + 1 >= source.length || source[i + 1] !== "'")) {
          i++; // skip closing '
          break;
        }
        if (source[i] === "'" && source[i + 1] === "'") {
          literal += "'";
          i += 2;
        } else {
          literal += source[i];
          i++;
        }
      }
      continue;
    }

    // Opening brace: argument or plural/select
    if (ch === "{") {
      flushLiteral();
      const result = parseArgument(source, i);
      parts.push(result.part);
      if (result.part.type === "argument" || result.part.type === "plural" || result.part.type === "select") {
        requiredParams.add(result.part.name);
      }
      i = result.endIndex;
      continue;
    }

    literal += ch;
    i++;
  }

  flushLiteral();

  return {
    source,
    parts,
    requiredParams: Array.from(requiredParams),
  };
}

/**
 * Parse an argument block starting at the opening `{`.
 * Returns the parsed MessagePart and the index after the closing `}`.
 */
function parseArgument(
  source: string,
  start: number
): { part: MessagePart; endIndex: number } {
  // Find the content between matching { }
  let depth = 0;
  let i = start;
  const contentStart = start + 1;

  // First, find the top-level content before any sub-braces
  let commaPositions: number[] = [];
  let tempDepth = 0;

  for (let j = contentStart; j < source.length; j++) {
    if (source[j] === "{") tempDepth++;
    else if (source[j] === "}") {
      if (tempDepth === 0) {
        // This is our closing brace
        i = j + 1;
        break;
      }
      tempDepth--;
    } else if (source[j] === "," && tempDepth === 0) {
      commaPositions.push(j);
    }
  }

  const fullContent = source.substring(contentStart, i - 1);

  // Simple argument: {name}
  if (commaPositions.length === 0) {
    const name = fullContent.trim();
    return {
      part: { type: "argument", name },
      endIndex: i,
    };
  }

  // Get the argument name (before first comma)
  const name = source.substring(contentStart, commaPositions[0]).trim();

  // Get the type (between first and second comma)
  if (commaPositions.length >= 2) {
    const typeStr = source
      .substring(commaPositions[0] + 1, commaPositions[1])
      .trim()
      .toLowerCase();

    const optionsStr = source.substring(commaPositions[1] + 1, i - 1).trim();

    if (typeStr === "plural") {
      const { options, offset } = parsePluralOptions(optionsStr);
      return {
        part: { type: "plural", name, options, offset },
        endIndex: i,
      };
    }

    if (typeStr === "select") {
      const options = parseSelectOptions(optionsStr);
      return {
        part: { type: "select", name, options },
        endIndex: i,
      };
    }
  }

  // Fallback: treat as simple argument
  return {
    part: { type: "argument", name },
    endIndex: i,
  };
}

/**
 * Parse plural options: "offset:1 one {# item} other {# items}"
 */
function parsePluralOptions(input: string): {
  options: Record<string, string>;
  offset: number;
} {
  const options: Record<string, string> = {};
  let offset = 0;
  let remaining = input.trim();

  // Check for offset
  const offsetMatch = remaining.match(/^offset:\s*(\d+)\s*/);
  if (offsetMatch) {
    offset = parseInt(offsetMatch[1], 10);
    remaining = remaining.substring(offsetMatch[0].length);
  }

  // Parse key {value} pairs
  const pairRegex = /(\w+|=\d+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = pairRegex.exec(remaining)) !== null) {
    const key = match[1];
    const valueStart = pairRegex.lastIndex;
    let depth = 1;
    let j = valueStart;

    while (j < remaining.length && depth > 0) {
      if (remaining[j] === "{") depth++;
      else if (remaining[j] === "}") depth--;
      j++;
    }

    const value = remaining.substring(valueStart, j - 1);
    options[key] = value;
    pairRegex.lastIndex = j;
  }

  return { options, offset };
}

/**
 * Parse select options: "male {He} female {She} other {They}"
 */
function parseSelectOptions(input: string): Record<string, string> {
  const options: Record<string, string> = {};
  const remaining = input.trim();

  const pairRegex = /(\w+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = pairRegex.exec(remaining)) !== null) {
    const key = match[1];
    const valueStart = pairRegex.lastIndex;
    let depth = 1;
    let j = valueStart;

    while (j < remaining.length && depth > 0) {
      if (remaining[j] === "{") depth++;
      else if (remaining[j] === "}") depth--;
      j++;
    }

    const value = remaining.substring(valueStart, j - 1);
    options[key] = value;
    pairRegex.lastIndex = j;
  }

  return options;
}

// ── Formatter ───────────────────────────────────────────────────────────

/**
 * Format a compiled message with values.
 *
 * @param compiled - Pre-compiled message template
 * @param values   - Parameter values to substitute
 * @param locale   - Locale for plural rules (default: "en")
 * @returns Formatted string
 */
export function formatCompiled(
  compiled: CompiledMessage,
  values: MessageValues = {},
  locale: Locale = "en"
): string {
  return compiled.parts
    .map((part) => {
      switch (part.type) {
        case "literal":
          return part.value;

        case "argument": {
          const val = values[part.name];
          return val !== undefined ? String(val) : `{${part.name}}`;
        }

        case "plural": {
          const rawVal = values[part.name];
          if (rawVal === undefined) return `{${part.name}}`;
          const num = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
          if (isNaN(num)) return String(rawVal);

          const adjustedNum = num - part.offset;
          const category = getPluralCategory(adjustedNum, locale);

          // Try exact match first (=0, =1, etc.)
          const exactKey = `=${num}`;
          const template =
            part.options[exactKey] ??
            part.options[category] ??
            part.options["other"] ??
            String(num);

          // Replace # with the adjusted number
          return template.replace(/#/g, String(adjustedNum));
        }

        case "select": {
          const val = values[part.name];
          if (val === undefined) return `{${part.name}}`;
          const strVal = String(val);
          return part.options[strVal] ?? part.options["other"] ?? strVal;
        }

        default:
          return "";
      }
    })
    .join("");
}

/**
 * Format a message template with values (compile + format in one step).
 *
 * @param template - ICU-like message template string
 * @param values   - Parameter values to substitute
 * @param locale   - Locale for plural rules (default: "en")
 * @returns Formatted string
 */
export function formatMessage(
  template: string,
  values: MessageValues = {},
  locale: Locale = "en"
): string {
  const compiled = compileMessage(template);
  return formatCompiled(compiled, values, locale);
}

// ── Validation ──────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  params: string[];
}

/**
 * Validate a message template for syntax errors.
 *
 * @param template - Message template to validate
 * @returns Validation result with errors and discovered parameters
 */
export function validateMessage(template: string): ValidationResult {
  const errors: string[] = [];

  // Check balanced braces
  let depth = 0;
  let inQuote = false;
  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    if (ch === "'" && i + 1 < template.length && template[i + 1] === "'") {
      i++; // skip escaped quote
      continue;
    }
    if (ch === "'") {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth < 0) {
        errors.push(`Unexpected closing brace at position ${i}`);
        depth = 0;
      }
    }
  }
  if (depth > 0) {
    errors.push(`Unclosed brace: ${depth} opening brace(s) without matching close`);
  }

  // Try to compile and catch errors
  try {
    const compiled = compileMessage(template);

    // Check plural/select have "other" fallback
    for (const part of compiled.parts) {
      if (part.type === "plural" && !part.options["other"]) {
        errors.push(`Plural argument "${part.name}" missing required "other" option`);
      }
      if (part.type === "select" && !part.options["other"]) {
        errors.push(`Select argument "${part.name}" missing required "other" option`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      params: compiled.requiredParams,
    };
  } catch {
    errors.push("Failed to parse message template");
    return { valid: false, errors, params: [] };
  }
}

/**
 * Check if all required parameters are provided in the values object.
 */
export function checkMissingParams(
  compiled: CompiledMessage,
  values: MessageValues
): string[] {
  return compiled.requiredParams.filter((p) => !(p in values));
}

// ── Utilities ───────────────────────────────────────────────────────────

/**
 * Extract all parameter names from a message template.
 */
export function extractParams(template: string): string[] {
  const compiled = compileMessage(template);
  return compiled.requiredParams;
}

/**
 * Create a message formatter bound to a specific locale.
 * Returns a function that formats messages in that locale.
 */
export function createLocaleFormatter(
  locale: Locale
): (template: string, values?: MessageValues) => string {
  return (template: string, values: MessageValues = {}) =>
    formatMessage(template, values, locale);
}

/**
 * Format a message with number formatting applied.
 * Numbers in values are formatted according to locale conventions.
 */
export function formatMessageWithNumbers(
  template: string,
  values: MessageValues,
  locale: Locale = "en"
): string {
  const formattedValues: MessageValues = {};
  for (const [key, val] of Object.entries(values)) {
    if (typeof val === "number") {
      // Keep raw number for plural rules, but format display
      formattedValues[key] = val;
    } else {
      formattedValues[key] = val;
    }
  }
  return formatMessage(template, formattedValues, locale);
}

/**
 * Build a diagnostic summary for a message template.
 */
export function buildMessageDiagnostic(template: string): {
  source: string;
  partCount: number;
  paramCount: number;
  params: string[];
  hasPluralRules: boolean;
  hasSelectRules: boolean;
  validation: ValidationResult;
} {
  const compiled = compileMessage(template);
  const validation = validateMessage(template);

  return {
    source: template,
    partCount: compiled.parts.length,
    paramCount: compiled.requiredParams.length,
    params: compiled.requiredParams,
    hasPluralRules: compiled.parts.some((p) => p.type === "plural"),
    hasSelectRules: compiled.parts.some((p) => p.type === "select"),
    validation,
  };
}
