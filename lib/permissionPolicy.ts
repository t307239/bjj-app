/**
 * permissionPolicy.ts — Permissions-Policy & security header management
 *
 * Pure-function utility for building Permissions-Policy headers,
 * auditing security header completeness, and generating security recommendations.
 *
 * @module permissionPolicy
 * @since Q-174
 */

/* ---------- Constants ---------- */

/** All Permissions-Policy directives with default deny/allow */
export const PERMISSION_DIRECTIVES = {
  // Sensor APIs
  accelerometer: "self",
  gyroscope: "self",
  magnetometer: "none",
  // Media
  camera: "none",
  microphone: "none",
  autoplay: "none",
  // Display
  fullscreen: "self",
  "picture-in-picture": "self",
  "display-capture": "none",
  // Payment
  payment: "self",
  // Tracking
  "browsing-topics": "none",
  "interest-cohort": "none",
  // Misc
  geolocation: "none",
  usb: "none",
  bluetooth: "none",
  "serial": "none",
  midi: "none",
  "ambient-light-sensor": "none",
} as const;

export type PermissionDirective = keyof typeof PERMISSION_DIRECTIVES;

/** Security header requirements with severity */
export const SECURITY_HEADERS = {
  "Strict-Transport-Security": {
    required: true,
    recommended: "max-age=63072000; includeSubDomains; preload",
    severity: "critical" as const,
  },
  "Content-Security-Policy": {
    required: true,
    recommended: "default-src 'self'",
    severity: "critical" as const,
  },
  "X-Content-Type-Options": {
    required: true,
    recommended: "nosniff",
    severity: "high" as const,
  },
  "X-Frame-Options": {
    required: true,
    recommended: "DENY",
    severity: "high" as const,
  },
  "X-XSS-Protection": {
    required: false,
    recommended: "0",
    severity: "medium" as const,
  },
  "Referrer-Policy": {
    required: true,
    recommended: "strict-origin-when-cross-origin",
    severity: "medium" as const,
  },
  "Permissions-Policy": {
    required: true,
    recommended: "",
    severity: "medium" as const,
  },
  "Cross-Origin-Opener-Policy": {
    required: false,
    recommended: "same-origin",
    severity: "medium" as const,
  },
  "Cross-Origin-Embedder-Policy": {
    required: false,
    recommended: "require-corp",
    severity: "low" as const,
  },
  "Cross-Origin-Resource-Policy": {
    required: false,
    recommended: "same-origin",
    severity: "low" as const,
  },
} as const;

export type SecurityHeaderName = keyof typeof SECURITY_HEADERS;
export type HeaderSeverity = "critical" | "high" | "medium" | "low";

/* ---------- Types ---------- */

export interface PermissionPolicyConfig {
  /** Override defaults for specific directives */
  overrides?: Partial<Record<PermissionDirective, string>>;
  /** Additional origins to allow for specific directives */
  allowOrigins?: Partial<Record<PermissionDirective, string[]>>;
}

export interface HeaderAuditResult {
  present: SecurityHeaderName[];
  missing: Array<{ name: SecurityHeaderName; severity: HeaderSeverity; required: boolean }>;
  misconfigured: Array<{
    name: SecurityHeaderName;
    current: string;
    recommended: string;
    severity: HeaderSeverity;
  }>;
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
}

export interface PermissionAuditIssue {
  directive: string;
  severity: "error" | "warning" | "info";
  message: string;
}

/* ---------- Permissions-Policy Builder ---------- */

/**
 * Build Permissions-Policy header value from config
 */
export function buildPermissionsPolicy(config?: PermissionPolicyConfig): string {
  const directives: string[] = [];

  for (const [directive, defaultValue] of Object.entries(PERMISSION_DIRECTIVES)) {
    const override = config?.overrides?.[directive as PermissionDirective];
    const value = override ?? defaultValue;

    const origins = config?.allowOrigins?.[directive as PermissionDirective];

    if (value === "none" && !origins?.length) {
      directives.push(`${directive}=()`);
    } else if (value === "self" && !origins?.length) {
      directives.push(`${directive}=(self)`);
    } else if (origins?.length) {
      const originList = origins.map((o) => `"${o}"`).join(" ");
      if (value === "self") {
        directives.push(`${directive}=(self ${originList})`);
      } else {
        directives.push(`${directive}=(${originList})`);
      }
    } else {
      directives.push(`${directive}=(${value})`);
    }
  }

  return directives.join(", ");
}

/**
 * Parse a Permissions-Policy header value into individual directives
 */
export function parsePermissionsPolicy(
  header: string,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  // Split by comma, handling parenthesized groups
  const parts = header.split(/,\s*/);

  for (const part of parts) {
    const match = part.match(/^([a-z-]+)=\(([^)]*)\)$/);
    if (match) {
      const directive = match[1];
      const values = match[2]
        .split(/\s+/)
        .filter(Boolean)
        .map((v) => v.replace(/"/g, ""));
      result[directive] = values;
    }
  }

  return result;
}

/* ---------- Permission Audit ---------- */

/**
 * Audit Permissions-Policy for security best practices
 */
export function auditPermissionsPolicy(
  policyHeader: string,
): PermissionAuditIssue[] {
  const issues: PermissionAuditIssue[] = [];
  const parsed = parsePermissionsPolicy(policyHeader);

  // Check for dangerous permissions left open
  const dangerousOpen = ["camera", "microphone", "geolocation", "payment", "usb"];
  for (const directive of dangerousOpen) {
    if (parsed[directive] && parsed[directive].length > 0 && !parsed[directive].includes("self")) {
      // Third-party origins have access to sensitive features
      issues.push({
        directive,
        severity: "warning",
        message: `${directive} is allowed for third-party origins: ${parsed[directive].join(", ")}`,
      });
    }
  }

  // Check for tracking-related permissions
  const trackingDirectives = ["browsing-topics", "interest-cohort"];
  for (const directive of trackingDirectives) {
    if (!parsed[directive] || parsed[directive].length > 0) {
      issues.push({
        directive,
        severity: "info",
        message: `Consider blocking ${directive} to prevent ad tracking`,
      });
    }
  }

  // Check for missing directives
  for (const directive of Object.keys(PERMISSION_DIRECTIVES)) {
    if (!parsed[directive]) {
      issues.push({
        directive,
        severity: "info",
        message: `${directive} not specified — browser default applies`,
      });
    }
  }

  return issues;
}

/* ---------- Security Header Audit ---------- */

/**
 * Audit response headers for security completeness
 */
export function auditSecurityHeaders(
  headers: Record<string, string>,
): HeaderAuditResult {
  const present: SecurityHeaderName[] = [];
  const missing: HeaderAuditResult["missing"] = [];
  const misconfigured: HeaderAuditResult["misconfigured"] = [];

  for (const [name, config] of Object.entries(SECURITY_HEADERS)) {
    const headerName = name as SecurityHeaderName;
    const value = headers[name] || headers[name.toLowerCase()];

    if (!value) {
      missing.push({
        name: headerName,
        severity: config.severity,
        required: config.required,
      });
    } else {
      present.push(headerName);

      // Check for known misconfigurations
      if (name === "X-XSS-Protection" && value !== "0") {
        misconfigured.push({
          name: headerName,
          current: value,
          recommended: "0",
          severity: "medium",
        });
      }
      if (name === "X-Content-Type-Options" && value !== "nosniff") {
        misconfigured.push({
          name: headerName,
          current: value,
          recommended: "nosniff",
          severity: "high",
        });
      }
    }
  }

  // Score calculation
  const totalHeaders = Object.keys(SECURITY_HEADERS).length;
  const severityWeights: Record<string, number> = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
  };

  let penalty = 0;
  for (const m of missing) {
    if (m.required) {
      penalty += severityWeights[m.severity] || 5;
    } else {
      penalty += (severityWeights[m.severity] || 5) * 0.5;
    }
  }
  for (const m of misconfigured) {
    penalty += (severityWeights[m.severity] || 5) * 0.5;
  }

  const score = Math.max(0, Math.round(100 - penalty));

  let grade: HeaderAuditResult["grade"];
  if (score >= 95) grade = "A+";
  else if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 55) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";

  return { present, missing, misconfigured, score, grade };
}

/* ---------- Formatting ---------- */

export function formatHeaderAudit(result: HeaderAuditResult): string {
  const lines: string[] = [
    "=== Security Header Audit ===",
    "",
    `Score: ${result.score}/100 (Grade: ${result.grade})`,
    `Present: ${result.present.length}/${result.present.length + result.missing.length}`,
  ];

  if (result.missing.length > 0) {
    lines.push("", "Missing Headers:");
    for (const m of result.missing) {
      const icon = m.required ? "❌" : "⚠️";
      lines.push(`  ${icon} ${m.name} [${m.severity}]${m.required ? " (required)" : ""}`);
    }
  }

  if (result.misconfigured.length > 0) {
    lines.push("", "Misconfigured:");
    for (const m of result.misconfigured) {
      lines.push(`  ⚠️ ${m.name}: "${m.current}" → recommended: "${m.recommended}"`);
    }
  }

  return lines.join("\n");
}
