/**
 * Q-223: Env Health Checker — runtime environment variable validation
 *
 * Validates environment variables at runtime and build time.
 * Extends check-env.mjs with runtime validation, type checking,
 * and format verification for known variable patterns.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnvVarCategory =
  | "supabase"
  | "stripe"
  | "sentry"
  | "auth"
  | "analytics"
  | "push"
  | "email"
  | "social"
  | "custom";

export type EnvVarSeverity = "critical" | "required" | "optional";

export interface EnvVarSpec {
  name: string;
  category: EnvVarCategory;
  severity: EnvVarSeverity;
  /** Regex pattern the value should match */
  pattern?: RegExp;
  /** Human-readable format description */
  formatHint?: string;
  /** Whether this should be public (NEXT_PUBLIC_) */
  isPublic: boolean;
  /** Default value if not set */
  defaultValue?: string;
}

export interface EnvCheckResult {
  name: string;
  status: "ok" | "missing" | "invalid_format" | "security_risk";
  category: EnvVarCategory;
  severity: EnvVarSeverity;
  message: string;
  /** The value (masked for secrets) */
  maskedValue?: string;
}

export interface EnvHealthReport {
  /** Overall health status */
  healthy: boolean;
  /** Total variables checked */
  totalChecked: number;
  /** Number of issues */
  issues: number;
  /** Critical issues (blocks deployment) */
  criticalIssues: number;
  /** Check results */
  results: EnvCheckResult[];
  /** Score 0-100 */
  score: number;
  /** Grade */
  grade: string;
  /** Timestamp */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Known env var specifications
// ---------------------------------------------------------------------------

export const ENV_SPECS: EnvVarSpec[] = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    category: "supabase",
    severity: "critical",
    pattern: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
    formatHint: "https://<project-ref>.supabase.co",
    isPublic: true,
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    category: "supabase",
    severity: "critical",
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    formatHint: "JWT token (eyJ...)",
    isPublic: true,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    category: "supabase",
    severity: "required",
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    formatHint: "JWT token (eyJ...)",
    isPublic: false,
  },
  {
    name: "STRIPE_SECRET_KEY",
    category: "stripe",
    severity: "required",
    pattern: /^sk_(test|live)_[A-Za-z0-9]+$/,
    formatHint: "sk_test_... or sk_live_...",
    isPublic: false,
  },
  {
    name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    category: "stripe",
    severity: "required",
    pattern: /^pk_(test|live)_[A-Za-z0-9]+$/,
    formatHint: "pk_test_... or pk_live_...",
    isPublic: true,
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    category: "stripe",
    severity: "required",
    pattern: /^whsec_[A-Za-z0-9]+$/,
    formatHint: "whsec_...",
    isPublic: false,
  },
  {
    name: "NEXT_PUBLIC_SENTRY_DSN",
    category: "sentry",
    severity: "optional",
    pattern: /^https:\/\/[a-f0-9]+@[a-z0-9.]+\.ingest\.[a-z]+\.sentry\.io\/[0-9]+$/,
    formatHint: "https://<key>@<org>.ingest.<region>.sentry.io/<project>",
    isPublic: true,
  },
  {
    name: "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    category: "push",
    severity: "required",
    pattern: /^B[A-Za-z0-9_-]{85,87}$/,
    formatHint: "VAPID public key (B...)",
    isPublic: true,
  },
  {
    name: "VAPID_PRIVATE_KEY",
    category: "push",
    severity: "required",
    isPublic: false,
  },
  {
    name: "RESEND_API_KEY",
    category: "email",
    severity: "optional",
    pattern: /^re_[A-Za-z0-9]+$/,
    formatHint: "re_...",
    isPublic: false,
  },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Mask a secret value for safe display.
 */
export function maskValue(value: string, isPublic: boolean): string {
  if (isPublic) return value;
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Check a single environment variable against its spec.
 */
export function checkEnvVar(
  spec: EnvVarSpec,
  value: string | undefined
): EnvCheckResult {
  // Missing check
  if (!value || value.trim() === "") {
    return {
      name: spec.name,
      status: "missing",
      category: spec.category,
      severity: spec.severity,
      message: spec.defaultValue
        ? `Missing (default: ${spec.defaultValue})`
        : `Missing ${spec.severity} variable`,
    };
  }

  // Security: server key exposed as NEXT_PUBLIC_
  if (!spec.isPublic && spec.name.startsWith("NEXT_PUBLIC_")) {
    return {
      name: spec.name,
      status: "security_risk",
      category: spec.category,
      severity: "critical",
      message: "Server-only secret exposed as NEXT_PUBLIC_",
      maskedValue: maskValue(value, false),
    };
  }

  // Format validation
  if (spec.pattern && !spec.pattern.test(value)) {
    return {
      name: spec.name,
      status: "invalid_format",
      category: spec.category,
      severity: spec.severity,
      message: `Invalid format. Expected: ${spec.formatHint ?? spec.pattern.toString()}`,
      maskedValue: maskValue(value, spec.isPublic),
    };
  }

  return {
    name: spec.name,
    status: "ok",
    category: spec.category,
    severity: spec.severity,
    message: "Valid",
    maskedValue: maskValue(value, spec.isPublic),
  };
}

/**
 * Check all known environment variables.
 */
export function checkAllEnvVars(
  env: Record<string, string | undefined>
): EnvHealthReport {
  const results = ENV_SPECS.map((spec) => checkEnvVar(spec, env[spec.name]));

  const issues = results.filter((r) => r.status !== "ok");
  const criticalIssues = issues.filter((r) => r.severity === "critical");

  const okCount = results.filter((r) => r.status === "ok").length;
  const score =
    results.length > 0 ? Math.round((okCount / results.length) * 100) : 100;

  return {
    healthy: criticalIssues.length === 0,
    totalChecked: results.length,
    issues: issues.length,
    criticalIssues: criticalIssues.length,
    results,
    score,
    grade: scoreToGrade(score),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Detect potential security risks in environment configuration.
 */
export function detectSecurityRisks(
  env: Record<string, string | undefined>
): EnvCheckResult[] {
  const risks: EnvCheckResult[] = [];

  // Check for server secrets in NEXT_PUBLIC_ vars
  const secretPatterns = [
    /service.role/i,
    /secret/i,
    /private/i,
    /password/i,
    /token/i,
  ];

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("NEXT_PUBLIC_") || !value) continue;

    const isKnownPublic = ENV_SPECS.some(
      (s) => s.name === key && s.isPublic
    );
    if (isKnownPublic) continue;

    for (const pattern of secretPatterns) {
      if (pattern.test(key)) {
        risks.push({
          name: key,
          status: "security_risk",
          category: "custom",
          severity: "critical",
          message: `Potentially secret variable exposed as NEXT_PUBLIC_: ${key}`,
        });
        break;
      }
    }
  }

  return risks;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format the env health report.
 */
export function formatEnvHealthReport(report: EnvHealthReport): string {
  const lines: string[] = [
    `Env Health: ${report.score}/100 (${report.grade})`,
    `Status: ${report.healthy ? "HEALTHY" : "UNHEALTHY"}`,
    `Checked: ${report.totalChecked}`,
    `Issues: ${report.issues} (${report.criticalIssues} critical)`,
  ];

  const issues = report.results.filter((r) => r.status !== "ok");
  if (issues.length > 0) {
    lines.push("", "Issues:");
    for (const r of issues) {
      lines.push(`  [${r.severity}] ${r.name}: ${r.message}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
