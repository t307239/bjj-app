/**
 * apiSecurityAudit.ts
 *
 * Automated security audit for API routes.
 * Analyses route definitions against a checklist of security best practices
 * (authentication, rate limiting, input validation, CORS, error exposure,
 * CSRF protection, method restriction, and response headers) and produces
 * a scored audit report with prioritised recommendations.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Describes a single API route to audit. */
export type APIRoute = {
  /** Route path, e.g. `/api/training-log` */
  path: string;
  /** Allowed HTTP methods */
  methods: string[];
  /** Whether the route requires authentication */
  hasAuth: boolean;
  /** Whether a rate limiter is applied */
  hasRateLimit: boolean;
  /** Whether request body / params are validated (e.g. zod) */
  hasInputValidation: boolean;
  /** Whether CORS is explicitly configured */
  hasCorsConfig: boolean;
  /** Whether internal errors / stack traces can leak to the client */
  exposesErrors: boolean;
  /** Whether CSRF protection is present */
  hasCsrfProtection: boolean;
  /** Whether unused HTTP methods are explicitly rejected */
  hasMethodRestriction: boolean;
  /** Whether security response headers are set */
  hasSecurityHeaders: boolean;
};

export type CheckSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Result of a single security check. */
export type SecurityCheck = {
  name: string;
  passed: boolean;
  severity: CheckSeverity;
  message: string;
};

/** Audit result for a single route. */
export type AuditResult = {
  route: string;
  /** Score 0-100 */
  score: number;
  checks: SecurityCheck[];
  failedChecks: SecurityCheck[];
};

/** Aggregate audit report for all routes. */
export type AuditReport = {
  generatedAt: number;
  totalRoutes: number;
  averageScore: number;
  /** Routes sorted worst-first */
  results: AuditResult[];
  /** Top failing check names across all routes */
  topFailures: Array<{ check: string; count: number }>;
  recommendations: string[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Weight per check (sums to 100). */
const CHECK_WEIGHTS: Record<string, number> = {
  auth_required: 20,
  rate_limit: 15,
  input_validation: 15,
  cors_config: 10,
  error_exposure: 15,
  csrf_protection: 10,
  method_restriction: 5,
  response_headers: 10,
};

/** Severity mapping per check. */
const CHECK_SEVERITY: Record<string, CheckSeverity> = {
  auth_required: 'critical',
  rate_limit: 'high',
  input_validation: 'high',
  cors_config: 'medium',
  error_exposure: 'high',
  csrf_protection: 'medium',
  method_restriction: 'low',
  response_headers: 'medium',
};

/** All security check names in evaluation order. */
export const SECURITY_CHECKS = Object.keys(CHECK_WEIGHTS);

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/** Verifies the route requires authentication. */
export function checkAuthRequired(route: APIRoute): SecurityCheck {
  return {
    name: 'auth_required',
    passed: route.hasAuth,
    severity: CHECK_SEVERITY['auth_required'],
    message: route.hasAuth
      ? 'Route requires authentication.'
      : 'Route is publicly accessible without authentication.',
  };
}

/** Verifies rate limiter presence. */
export function checkRateLimit(route: APIRoute): SecurityCheck {
  return {
    name: 'rate_limit',
    passed: route.hasRateLimit,
    severity: CHECK_SEVERITY['rate_limit'],
    message: route.hasRateLimit
      ? 'Rate limiter is applied.'
      : 'No rate limiter detected; route is vulnerable to abuse.',
  };
}

/** Verifies input validation (zod / schema). */
export function checkInputValidation(route: APIRoute): SecurityCheck {
  return {
    name: 'input_validation',
    passed: route.hasInputValidation,
    severity: CHECK_SEVERITY['input_validation'],
    message: route.hasInputValidation
      ? 'Input validation is present.'
      : 'No input validation detected; route may accept malformed data.',
  };
}

/** Checks for stack trace / internal error leaks. */
export function checkErrorExposure(route: APIRoute): SecurityCheck {
  return {
    name: 'error_exposure',
    passed: !route.exposesErrors,
    severity: CHECK_SEVERITY['error_exposure'],
    message: route.exposesErrors
      ? 'Internal errors or stack traces may leak to clients.'
      : 'Errors are properly masked from clients.',
  };
}

/** Checks CORS configuration. */
export function checkCorsConfig(route: APIRoute): SecurityCheck {
  return {
    name: 'cors_config',
    passed: route.hasCorsConfig,
    severity: CHECK_SEVERITY['cors_config'],
    message: route.hasCorsConfig
      ? 'CORS is explicitly configured.'
      : 'CORS is not configured; default browser behaviour applies.',
  };
}

/** Checks CSRF protection. */
export function checkCsrfProtection(route: APIRoute): SecurityCheck {
  return {
    name: 'csrf_protection',
    passed: route.hasCsrfProtection,
    severity: CHECK_SEVERITY['csrf_protection'],
    message: route.hasCsrfProtection
      ? 'CSRF protection is active.'
      : 'No CSRF protection detected on mutation routes.',
  };
}

/** Checks HTTP method restriction. */
export function checkMethodRestriction(route: APIRoute): SecurityCheck {
  return {
    name: 'method_restriction',
    passed: route.hasMethodRestriction,
    severity: CHECK_SEVERITY['method_restriction'],
    message: route.hasMethodRestriction
      ? 'Unused HTTP methods are rejected.'
      : 'Route does not restrict HTTP methods; unexpected verbs may be accepted.',
  };
}

/** Checks security response headers. */
export function checkResponseHeaders(route: APIRoute): SecurityCheck {
  return {
    name: 'response_headers',
    passed: route.hasSecurityHeaders,
    severity: CHECK_SEVERITY['response_headers'],
    message: route.hasSecurityHeaders
      ? 'Security response headers are set.'
      : 'Missing security headers (X-Content-Type-Options, X-Frame-Options, etc.).',
  };
}

// ---------------------------------------------------------------------------
// Route-level audit
// ---------------------------------------------------------------------------

const ALL_CHECKS: Array<(route: APIRoute) => SecurityCheck> = [
  checkAuthRequired,
  checkRateLimit,
  checkInputValidation,
  checkCorsConfig,
  checkErrorExposure,
  checkCsrfProtection,
  checkMethodRestriction,
  checkResponseHeaders,
];

/**
 * Run all security checks on a single route.
 * Returns a scored result (0-100) with details per check.
 */
export function auditRoute(route: APIRoute): AuditResult {
  const checks = ALL_CHECKS.map((fn) => fn(route));
  const failedChecks = checks.filter((c) => !c.passed);

  let score = 0;
  for (const check of checks) {
    if (check.passed) {
      score += CHECK_WEIGHTS[check.name] ?? 0;
    }
  }

  return {
    route: route.path,
    score,
    checks,
    failedChecks,
  };
}

/**
 * Audit an array of routes and produce an aggregate report.
 * Includes average score, worst routes, top failures, and recommendations.
 */
export function auditAllRoutes(routes: APIRoute[]): AuditReport {
  const results = routes.map(auditRoute).sort((a, b) => a.score - b.score);

  const avg = results.length
    ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 100) / 100
    : 0;

  // Aggregate failure counts
  const failureCounts = new Map<string, number>();
  for (const r of results) {
    for (const f of r.failedChecks) {
      failureCounts.set(f.name, (failureCounts.get(f.name) ?? 0) + 1);
    }
  }
  const topFailures = [...failureCounts.entries()]
    .map(([check, count]) => ({ check, count }))
    .sort((a, b) => b.count - a.count);

  const recommendations: string[] = [];
  for (const { check, count } of topFailures) {
    recommendations.push(
      `${check} failed on ${count}/${routes.length} routes. Prioritise fixing this across all routes.`,
    );
  }

  return {
    generatedAt: Date.now(),
    totalRoutes: routes.length,
    averageScore: avg,
    results,
    topFailures,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format an audit report as a human-readable string. */
export function formatSecurityAudit(report: AuditReport): string {
  const lines: string[] = [
    '=== API Security Audit ===',
    `Generated: ${new Date(report.generatedAt).toISOString()}`,
    `Routes audited: ${report.totalRoutes}`,
    `Average score: ${report.averageScore}/100`,
    '',
  ];

  if (report.topFailures.length) {
    lines.push('--- Top failures ---');
    for (const f of report.topFailures) {
      lines.push(`  ${f.check}: failed on ${f.count} route(s)`);
    }
    lines.push('');
  }

  lines.push('--- Per-route results ---');
  for (const r of report.results) {
    const status = r.score === 100 ? 'PASS' : 'FAIL';
    lines.push(`  [${status}] ${r.score.toString().padStart(3)}/100 | ${r.route}`);
    for (const f of r.failedChecks) {
      lines.push(`         [${f.severity.toUpperCase()}] ${f.name}: ${f.message}`);
    }
  }

  if (report.recommendations.length) {
    lines.push('', '--- Recommendations ---');
    for (const rec of report.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }

  return lines.join('\n');
}
