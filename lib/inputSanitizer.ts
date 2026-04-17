/**
 * lib/inputSanitizer.ts — Input sanitization & validation utilities
 *
 * Q-159: Security pillar — provides defense-in-depth input sanitization
 * for XSS, SQL injection, path traversal, and command injection attacks.
 * Works alongside existing zod validation as an additional safety layer.
 *
 * Pure utility layer — no DB access, no UI.
 *
 * @example
 *   import { sanitizeHTML, detectInjection, INJECTION_PATTERNS } from "@/lib/inputSanitizer";
 *   const clean = sanitizeHTML("<script>alert('xss')</script>");
 *   const threats = detectInjection(userInput);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface SanitizeResult {
  /** Sanitized output */
  output: string;
  /** Whether any sanitization was applied */
  wasModified: boolean;
  /** Threats detected and removed */
  removedThreats: ThreatType[];
}

export type ThreatType = "xss" | "sqli" | "path_traversal" | "command_injection" | "null_byte" | "unicode_abuse";

export interface InjectionDetection {
  /** Whether any injection was detected */
  detected: boolean;
  /** Threat types found */
  threats: ThreatType[];
  /** Matched patterns */
  matches: InjectionMatch[];
  /** Risk level */
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
}

export interface InjectionMatch {
  /** Threat type */
  type: ThreatType;
  /** Matched pattern description */
  pattern: string;
  /** Position in input */
  position: number;
}

export interface InjectionPattern {
  /** Pattern type */
  type: ThreatType;
  /** Pattern regex */
  pattern: RegExp;
  /** Description */
  description: string;
  /** Severity */
  severity: "low" | "medium" | "high" | "critical";
}

// ── Constants ────────────────────────────────────────────────────────────

/** HTML entities for escaping */
export const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
};

/** Injection detection patterns */
export const INJECTION_PATTERNS: InjectionPattern[] = [
  // XSS
  { type: "xss", pattern: /<script[\s>]/i, description: "Script tag injection", severity: "critical" },
  { type: "xss", pattern: /on\w+\s*=/i, description: "Event handler injection", severity: "high" },
  { type: "xss", pattern: /javascript:/i, description: "JavaScript protocol", severity: "high" },
  { type: "xss", pattern: /data:\s*text\/html/i, description: "Data URI HTML", severity: "high" },
  { type: "xss", pattern: /expression\s*\(/i, description: "CSS expression", severity: "medium" },
  { type: "xss", pattern: /<iframe[\s>]/i, description: "Iframe injection", severity: "high" },
  { type: "xss", pattern: /<object[\s>]/i, description: "Object tag injection", severity: "high" },
  { type: "xss", pattern: /<embed[\s>]/i, description: "Embed tag injection", severity: "high" },

  // SQL Injection
  { type: "sqli", pattern: /('\s*(OR|AND)\s+')/i, description: "SQL OR/AND injection", severity: "critical" },
  { type: "sqli", pattern: /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER)\s/i, description: "SQL statement injection", severity: "critical" },
  { type: "sqli", pattern: /UNION\s+SELECT/i, description: "UNION SELECT injection", severity: "critical" },
  { type: "sqli", pattern: /--\s*$/m, description: "SQL comment injection", severity: "medium" },

  // Path Traversal
  { type: "path_traversal", pattern: /\.\.[/\\]/g, description: "Directory traversal", severity: "high" },
  { type: "path_traversal", pattern: /%2e%2e[%2f%5c]/i, description: "URL-encoded traversal", severity: "high" },
  { type: "path_traversal", pattern: /\/etc\/passwd/i, description: "System file access", severity: "critical" },

  // Command Injection
  { type: "command_injection", pattern: /[;&|`$]\s*(cat|ls|rm|wget|curl)\b/i, description: "Shell command injection", severity: "critical" },
  { type: "command_injection", pattern: /\$\(.*\)/g, description: "Command substitution", severity: "high" },

  // Null Byte
  { type: "null_byte", pattern: /\x00|%00/g, description: "Null byte injection", severity: "high" },

  // Unicode Abuse
  { type: "unicode_abuse", pattern: /[\u200B-\u200F\u202A-\u202E\uFEFF]/g, description: "Invisible unicode characters", severity: "low" },
];

/** Maximum input length for sanitization (to prevent ReDoS) */
export const MAX_INPUT_LENGTH = 10000;

/** Characters to strip from filenames */
export const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

// ── Sanitization ────────────────────────────────────────────────────────

/**
 * Escape HTML entities in a string.
 */
export function escapeHTML(input: string): string {
  return input.replace(/[&<>"'`/]/g, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Sanitize HTML — strip dangerous tags and attributes.
 */
export function sanitizeHTML(input: string): SanitizeResult {
  if (input.length > MAX_INPUT_LENGTH) {
    input = input.slice(0, MAX_INPUT_LENGTH);
  }

  const threats: ThreatType[] = [];
  let output = input;

  // Remove script tags and content
  const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  if (scriptPattern.test(output)) {
    threats.push("xss");
    output = output.replace(scriptPattern, "");
  }

  // Remove event handlers
  const eventPattern = /\s+on\w+\s*=\s*["'][^"']*["']/gi;
  if (eventPattern.test(output)) {
    if (!threats.includes("xss")) threats.push("xss");
    output = output.replace(eventPattern, "");
  }

  // Remove javascript: protocols
  const jsProtocol = /javascript\s*:/gi;
  if (jsProtocol.test(output)) {
    if (!threats.includes("xss")) threats.push("xss");
    output = output.replace(jsProtocol, "");
  }

  // Remove dangerous tags
  const dangerousTags = /<(iframe|object|embed|form|input|meta|link|base)\b[^>]*\/?>/gi;
  if (dangerousTags.test(output)) {
    if (!threats.includes("xss")) threats.push("xss");
    output = output.replace(dangerousTags, "");
  }

  // Remove null bytes
  if (/\x00/.test(output)) {
    threats.push("null_byte");
    output = output.replace(/\x00/g, "");
  }

  return {
    output,
    wasModified: output !== input,
    removedThreats: threats,
  };
}

/**
 * Sanitize a filename.
 */
export function sanitizeFilename(input: string): string {
  let clean = input.replace(UNSAFE_FILENAME_CHARS, "_");
  // Remove path traversal
  clean = clean.replace(/\.\./g, "_");
  // Trim dots and spaces from ends
  clean = clean.replace(/^[\s.]+|[\s.]+$/g, "");
  // Limit length
  if (clean.length > 255) clean = clean.slice(0, 255);
  return clean || "unnamed";
}

/**
 * Sanitize a URL — ensure it's safe to redirect to.
 */
export function sanitizeURL(input: string): string | null {
  const trimmed = input.trim();

  // Block javascript: and data: protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return null;
  }

  // Block double-encoded characters
  if (/%25/.test(trimmed)) {
    return null;
  }

  // Must start with http(s), /, or #
  if (!/^(https?:\/\/|\/(?!\/)|#)/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

// ── Detection ───────────────────────────────────────────────────────────

/**
 * Detect injection attempts in input.
 */
export function detectInjection(input: string): InjectionDetection {
  if (!input || input.length === 0) {
    return { detected: false, threats: [], matches: [], riskLevel: "none" };
  }

  // Truncate to prevent ReDoS
  const checked = input.length > MAX_INPUT_LENGTH ? input.slice(0, MAX_INPUT_LENGTH) : input;
  const matches: InjectionMatch[] = [];
  const threatSet = new Set<ThreatType>();
  let maxSeverity: InjectionPattern["severity"] = "low";

  for (const pattern of INJECTION_PATTERNS) {
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    const match = regex.exec(checked);
    if (match) {
      threatSet.add(pattern.type);
      matches.push({
        type: pattern.type,
        pattern: pattern.description,
        position: match.index,
      });

      const severityOrder: InjectionPattern["severity"][] = ["low", "medium", "high", "critical"];
      if (severityOrder.indexOf(pattern.severity) > severityOrder.indexOf(maxSeverity)) {
        maxSeverity = pattern.severity;
      }
    }
  }

  const threats = [...threatSet];
  return {
    detected: threats.length > 0,
    threats,
    matches,
    riskLevel: threats.length === 0 ? "none" : maxSeverity,
  };
}

/**
 * Check if a string contains only safe characters for a given context.
 */
export function isSafeForContext(
  input: string,
  context: "html" | "url" | "sql" | "filename",
): boolean {
  switch (context) {
    case "html":
      return !/<[^>]*>/.test(input) && !/[&<>"']/.test(input);
    case "url":
      return sanitizeURL(input) !== null;
    case "sql":
      return !detectInjection(input).threats.includes("sqli");
    case "filename":
      return !UNSAFE_FILENAME_CHARS.test(input) && !/\.\./.test(input);
    default:
      return true;
  }
}

/**
 * Format injection detection result.
 */
export function formatInjectionReport(detection: InjectionDetection): string {
  if (!detection.detected) {
    return "✅ No injection threats detected";
  }

  const icon = detection.riskLevel === "critical" ? "🔴" :
    detection.riskLevel === "high" ? "🟠" :
    detection.riskLevel === "medium" ? "🟡" : "⚪";

  const lines = [
    `${icon} Injection detected: ${detection.riskLevel} risk`,
    `   Threats: ${detection.threats.join(", ")}`,
  ];

  for (const match of detection.matches.slice(0, 5)) {
    lines.push(`   - [${match.type}] ${match.pattern} at position ${match.position}`);
  }

  return lines.join("\n");
}
