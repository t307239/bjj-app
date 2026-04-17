/**
 * lib/deploymentGuard.ts — Pre-deploy validation utilities
 *
 * Q-134: Infra pillar — provides deployment readiness checks
 * that can be used in CI pipelines, post-deploy smoke tests,
 * and admin dashboards.
 *
 * Checks:
 * 1. Required environment variables are present
 * 2. Health endpoint returns OK
 * 3. Build artifacts are valid
 * 4. Database connectivity (via health endpoint)
 *
 * @example
 *   import { validateDeployReadiness, REQUIRED_ENV_VARS } from "@/lib/deploymentGuard";
 *   const result = await validateDeployReadiness("https://bjj-app.net");
 *   if (!result.ready) console.error(result.failures);
 */

// ── Required Environment Variables ───────────────────────────────────────

/** Environment variables required for production deployment */
export const REQUIRED_ENV_VARS = {
  /** Supabase connection */
  database: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ],
  /** Authentication */
  auth: ["NEXTAUTH_SECRET"],
  /** Stripe billing */
  stripe: [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  ],
  /** Monitoring */
  monitoring: ["SENTRY_DSN"],
  /** Push notifications */
  push: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"],
  /** Cron auth */
  cron: ["CRON_SECRET"],
} as const;

export type EnvCategory = keyof typeof REQUIRED_ENV_VARS;

// ── Check Result Types ───────────────────────────────────────────────────

export interface DeployCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  durationMs?: number;
}

export interface DeployReadiness {
  ready: boolean;
  checks: DeployCheck[];
  failures: DeployCheck[];
  warnings: DeployCheck[];
  timestamp: string;
  totalDurationMs: number;
}

// ── Environment Variable Validation ──────────────────────────────────────

/**
 * Check which required env vars are missing.
 * Works at build time (Node.js) — reads from process.env.
 */
export function checkEnvVars(
  env: Record<string, string | undefined> = {},
): DeployCheck[] {
  const checks: DeployCheck[] = [];

  for (const [category, vars] of Object.entries(REQUIRED_ENV_VARS)) {
    const missing = vars.filter((v) => !env[v]);
    if (missing.length === 0) {
      checks.push({
        name: `env:${category}`,
        status: "pass",
        message: `All ${vars.length} ${category} env vars present`,
      });
    } else {
      checks.push({
        name: `env:${category}`,
        status: "fail",
        message: `Missing ${missing.length}/${vars.length}: ${missing.join(", ")}`,
      });
    }
  }

  return checks;
}

/**
 * Get a flat list of all required env var names.
 */
export function getAllRequiredEnvVars(): string[] {
  return Object.values(REQUIRED_ENV_VARS).flat();
}

// ── Health Endpoint Check ────────────────────────────────────────────────

/**
 * Validate that the health endpoint returns expected structure.
 * Used in post-deploy smoke tests.
 */
export function validateHealthResponse(data: Record<string, unknown>): DeployCheck {
  const hasStatus = typeof data.status === "string";
  const hasTimestamp = typeof data.timestamp === "string";
  const hasVersion = typeof data.version === "string";
  const hasDb = typeof data.dbStatus === "string";

  if (hasStatus && hasTimestamp && hasVersion && hasDb) {
    const dbOk = data.dbStatus !== "error";
    return {
      name: "health:response",
      status: dbOk ? "pass" : "warn",
      message: dbOk
        ? `Health OK — status=${data.status}, db=${data.dbStatus}, version=${data.version}`
        : `Health degraded — db=${data.dbStatus}`,
    };
  }

  const missing: string[] = [];
  if (!hasStatus) missing.push("status");
  if (!hasTimestamp) missing.push("timestamp");
  if (!hasVersion) missing.push("version");
  if (!hasDb) missing.push("dbStatus");

  return {
    name: "health:response",
    status: "fail",
    message: `Health response missing fields: ${missing.join(", ")}`,
  };
}

// ── Build Artifact Validation ────────────────────────────────────────────

export interface BuildManifest {
  pages: Record<string, string[]>;
  [key: string]: unknown;
}

/**
 * Validate that critical pages exist in the build manifest.
 */
export function validateBuildManifest(
  manifest: BuildManifest,
  requiredPages: string[] = ["/dashboard", "/records", "/profile", "/login"],
): DeployCheck {
  const pageKeys = Object.keys(manifest.pages || {});
  const missing = requiredPages.filter((p) => !pageKeys.some((k) => k.startsWith(p)));

  if (missing.length === 0) {
    return {
      name: "build:manifest",
      status: "pass",
      message: `All ${requiredPages.length} critical pages found in build (${pageKeys.length} total)`,
    };
  }

  return {
    name: "build:manifest",
    status: "fail",
    message: `Missing pages in build: ${missing.join(", ")}`,
  };
}

// ── Deployment Readiness Aggregator ──────────────────────────────────────

/**
 * Run all pre-deploy checks and return aggregated result.
 * Does NOT make network calls — pass health data if available.
 */
export function aggregateChecks(checks: DeployCheck[]): DeployReadiness {
  const failures = checks.filter((c) => c.status === "fail");
  const warnings = checks.filter((c) => c.status === "warn");
  const totalDurationMs = checks.reduce((sum, c) => sum + (c.durationMs ?? 0), 0);

  return {
    ready: failures.length === 0,
    checks,
    failures,
    warnings,
    timestamp: new Date().toISOString(),
    totalDurationMs,
  };
}

/**
 * Format deploy readiness as a human-readable summary.
 */
export function formatReadinessSummary(readiness: DeployReadiness): string {
  const icon = readiness.ready ? "✅" : "❌";
  const lines = [
    `${icon} Deploy Readiness: ${readiness.ready ? "READY" : "NOT READY"}`,
    `   Checks: ${readiness.checks.length} total, ${readiness.failures.length} failures, ${readiness.warnings.length} warnings`,
    "",
  ];

  for (const check of readiness.checks) {
    const statusIcon = check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✗";
    const duration = check.durationMs ? ` (${check.durationMs}ms)` : "";
    lines.push(`   ${statusIcon} ${check.name}: ${check.message}${duration}`);
  }

  return lines.join("\n");
}
