/**
 * zeroDowntimeDeploy.ts — Zero-downtime deployment strategy and health check sequencing
 *
 * Pure-function utility for planning zero-downtime deployments,
 * evaluating health checks, and determining rollback conditions
 * across rolling, blue-green, and canary strategies.
 *
 * @module Q-198
 * @since Q-198
 */

/* ---------- Types ---------- */

export type DeployStrategy = "rolling" | "blue-green" | "canary";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface DeployPhase {
  readonly name: string;
  readonly order: number;
  readonly trafficPercent: number;
  readonly instancesUpdated: number;
  readonly healthCheckRequired: boolean;
  readonly rollbackTrigger: string;
  readonly estimatedDurationSec: number;
}

export interface HealthCheckResult {
  readonly endpoint: string;
  readonly status: HealthStatus;
  readonly statusCode: number;
  readonly responseTimeMs: number;
  readonly message: string;
}

export interface DeployPlan {
  readonly strategy: DeployStrategy;
  readonly currentVersion: string;
  readonly targetVersion: string;
  readonly totalInstances: number;
  readonly phases: readonly DeployPhase[];
  readonly estimatedTotalDurationSec: number;
  readonly rollbackPlan: string;
}

export interface DeployAudit {
  readonly score: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly readiness: "ready" | "caution" | "not_ready";
  readonly checks: readonly { readonly name: string; readonly passed: boolean; readonly detail: string }[];
  readonly recommendations: readonly string[];
}

/* ---------- Constants ---------- */

export const DEPLOY_STRATEGIES: Record<
  DeployStrategy,
  { readonly pros: readonly string[]; readonly cons: readonly string[]; readonly minInstances: number }
> = {
  rolling: {
    pros: ["Simple setup", "No extra infrastructure", "Gradual rollout"],
    cons: ["Mixed versions during deploy", "Slower rollback"],
    minInstances: 2,
  },
  "blue-green": {
    pros: ["Instant rollback", "No mixed versions", "Full testing before switch"],
    cons: ["Double infrastructure cost", "Database migration complexity"],
    minInstances: 2,
  },
  canary: {
    pros: ["Risk mitigation", "Real traffic validation", "Gradual exposure"],
    cons: ["Complex routing", "Longer deploy time", "Monitoring required"],
    minInstances: 3,
  },
} as const;

export const HEALTH_CHECK_ENDPOINTS = [
  "/api/health",
  "/api/health/db",
  "/api/health/ready",
] as const;

export const CANARY_TRAFFIC_STEPS = [1, 5, 10, 25, 50, 100] as const;

/** Response time thresholds in ms */
const RESPONSE_TIME_HEALTHY = 500;
const RESPONSE_TIME_DEGRADED = 2000;

/* ---------- Functions ---------- */

/**
 * Create a deployment plan with phased rollout and rollback triggers.
 */
export function createDeployPlan(
  strategy: DeployStrategy,
  currentVersion: string,
  targetVersion: string,
  instances: number
): DeployPlan {
  const phases: DeployPhase[] = [];

  switch (strategy) {
    case "rolling": {
      const batchSize = Math.max(1, Math.floor(instances / 3));
      let updated = 0;
      let order = 1;
      while (updated < instances) {
        const batch = Math.min(batchSize, instances - updated);
        updated += batch;
        const trafficPercent = Math.round((updated / instances) * 100);
        phases.push({
          name: `Rolling batch ${order}`,
          order,
          trafficPercent,
          instancesUpdated: updated,
          healthCheckRequired: true,
          rollbackTrigger: "Health check failure on updated instances",
          estimatedDurationSec: 60 * order,
        });
        order++;
      }
      break;
    }
    case "blue-green": {
      phases.push(
        {
          name: "Deploy to green environment",
          order: 1,
          trafficPercent: 0,
          instancesUpdated: instances,
          healthCheckRequired: true,
          rollbackTrigger: "Green environment health check failure",
          estimatedDurationSec: 120,
        },
        {
          name: "Verify green environment",
          order: 2,
          trafficPercent: 0,
          instancesUpdated: instances,
          healthCheckRequired: true,
          rollbackTrigger: "Smoke test failure on green",
          estimatedDurationSec: 60,
        },
        {
          name: "Switch traffic to green",
          order: 3,
          trafficPercent: 100,
          instancesUpdated: instances,
          healthCheckRequired: true,
          rollbackTrigger: "Error rate spike after switch",
          estimatedDurationSec: 10,
        }
      );
      break;
    }
    case "canary": {
      for (let i = 0; i < CANARY_TRAFFIC_STEPS.length; i++) {
        const pct = CANARY_TRAFFIC_STEPS[i];
        const canaryInstances = Math.max(1, Math.round((pct / 100) * instances));
        phases.push({
          name: `Canary ${pct}% traffic`,
          order: i + 1,
          trafficPercent: pct,
          instancesUpdated: canaryInstances,
          healthCheckRequired: true,
          rollbackTrigger: `Error rate > 1% or p95 latency > ${RESPONSE_TIME_DEGRADED}ms`,
          estimatedDurationSec: pct < 25 ? 300 : 120,
        });
      }
      break;
    }
  }

  const estimatedTotalDurationSec = phases.reduce((sum, p) => sum + p.estimatedDurationSec, 0);

  return {
    strategy,
    currentVersion,
    targetVersion,
    totalInstances: instances,
    phases,
    estimatedTotalDurationSec,
    rollbackPlan: strategy === "blue-green"
      ? `Switch traffic back to blue (${currentVersion})`
      : `Redeploy ${currentVersion} using same ${strategy} strategy`,
  };
}

/**
 * Evaluate a health check response and determine status.
 */
export function evaluateHealthCheck(
  endpoint: string,
  statusCode: number,
  responseTime: number,
  body?: Record<string, unknown>
): HealthCheckResult {
  let status: HealthStatus;
  let message: string;

  if (statusCode >= 500) {
    status = "unhealthy";
    message = `Server error (${statusCode})`;
  } else if (statusCode >= 400) {
    status = "unhealthy";
    message = `Client error (${statusCode})`;
  } else if (statusCode !== 200) {
    status = "degraded";
    message = `Unexpected status (${statusCode})`;
  } else if (responseTime > RESPONSE_TIME_DEGRADED) {
    status = "unhealthy";
    message = `Response time critical (${responseTime}ms > ${RESPONSE_TIME_DEGRADED}ms)`;
  } else if (responseTime > RESPONSE_TIME_HEALTHY) {
    status = "degraded";
    message = `Response time elevated (${responseTime}ms > ${RESPONSE_TIME_HEALTHY}ms)`;
  } else {
    status = "healthy";
    message = "OK";
  }

  // Check body for explicit status field
  if (body && body.status === "error") {
    status = "unhealthy";
    message = `Health check body reports error: ${body.message ?? "unknown"}`;
  }

  return { endpoint, status, statusCode, responseTimeMs: responseTime, message };
}

/**
 * Determine whether to rollback based on health check results.
 */
export function shouldRollback(
  healthResults: readonly HealthCheckResult[],
  threshold: number = 0.5
): { readonly rollback: boolean; readonly reason: string } {
  if (healthResults.length === 0) {
    return { rollback: true, reason: "No health check results available" };
  }

  const unhealthyCount = healthResults.filter((r) => r.status === "unhealthy").length;
  const degradedCount = healthResults.filter((r) => r.status === "degraded").length;
  const unhealthyRatio = unhealthyCount / healthResults.length;
  const problemRatio = (unhealthyCount + degradedCount * 0.5) / healthResults.length;

  if (unhealthyRatio >= threshold) {
    return {
      rollback: true,
      reason: `${unhealthyCount}/${healthResults.length} endpoints unhealthy (${Math.round(unhealthyRatio * 100)}% >= ${Math.round(threshold * 100)}% threshold)`,
    };
  }

  if (problemRatio >= threshold) {
    return {
      rollback: true,
      reason: `Combined problem ratio ${Math.round(problemRatio * 100)}% exceeds threshold (${unhealthyCount} unhealthy + ${degradedCount} degraded)`,
    };
  }

  return { rollback: false, reason: "All health checks within acceptable thresholds" };
}

/**
 * Calculate canary traffic percentage for a given phase.
 */
export function calculateCanaryTraffic(phase: number, totalPhases: number): number {
  if (totalPhases <= 0 || phase <= 0) return 0;
  if (phase >= totalPhases) return 100;
  const index = Math.min(phase - 1, CANARY_TRAFFIC_STEPS.length - 1);
  return CANARY_TRAFFIC_STEPS[index];
}

/**
 * Audit deployment readiness across health checks, plan, and migrations.
 */
export function auditDeployReadiness(
  plan: DeployPlan,
  healthChecks: readonly HealthCheckResult[],
  dbMigrations: readonly { readonly name: string; readonly reversible: boolean }[]
): DeployAudit {
  let score = 100;
  const checks: { name: string; passed: boolean; detail: string }[] = [];
  const recommendations: string[] = [];

  // Check: minimum instances
  const minInstances = DEPLOY_STRATEGIES[plan.strategy].minInstances;
  const hasMinInstances = plan.totalInstances >= minInstances;
  checks.push({
    name: "Minimum instances",
    passed: hasMinInstances,
    detail: `${plan.totalInstances} instances (min: ${minInstances} for ${plan.strategy})`,
  });
  if (!hasMinInstances) score -= 20;

  // Check: all health checks healthy
  const allHealthy = healthChecks.length > 0 && healthChecks.every((h) => h.status === "healthy");
  checks.push({
    name: "Pre-deploy health",
    passed: allHealthy,
    detail: allHealthy
      ? "All endpoints healthy"
      : `${healthChecks.filter((h) => h.status !== "healthy").length} endpoint(s) not healthy`,
  });
  if (!allHealthy) score -= 25;

  // Check: health check coverage
  const checkedEndpoints = new Set(healthChecks.map((h) => h.endpoint));
  const hasAllEndpoints = HEALTH_CHECK_ENDPOINTS.every((e) => checkedEndpoints.has(e));
  checks.push({
    name: "Health check coverage",
    passed: hasAllEndpoints,
    detail: hasAllEndpoints
      ? "All required endpoints checked"
      : `Missing: ${HEALTH_CHECK_ENDPOINTS.filter((e) => !checkedEndpoints.has(e)).join(", ")}`,
  });
  if (!hasAllEndpoints) score -= 10;

  // Check: DB migrations reversible
  const irreversible = dbMigrations.filter((m) => !m.reversible);
  const allReversible = irreversible.length === 0;
  checks.push({
    name: "Migration reversibility",
    passed: allReversible,
    detail: allReversible
      ? `All ${dbMigrations.length} migration(s) reversible`
      : `${irreversible.length} irreversible migration(s): ${irreversible.map((m) => m.name).join(", ")}`,
  });
  if (!allReversible) {
    score -= 15;
    recommendations.push("Consider making migrations reversible for safe rollback");
  }

  // Check: deploy plan has phases
  const hasPhases = plan.phases.length > 0;
  checks.push({
    name: "Deploy phases defined",
    passed: hasPhases,
    detail: `${plan.phases.length} phase(s)`,
  });
  if (!hasPhases) score -= 20;

  if (plan.strategy === "canary" && plan.totalInstances < 5) {
    recommendations.push("Canary deploys work best with 5+ instances for meaningful traffic splitting");
  }

  if (plan.estimatedTotalDurationSec > 1800) {
    recommendations.push("Deploy estimated > 30 minutes — consider off-peak scheduling");
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const readiness = finalScore >= 80 ? "ready" : finalScore >= 60 ? "caution" : "not_ready";

  return {
    score: finalScore,
    grade: finalScore >= 90 ? "A" : finalScore >= 80 ? "B" : finalScore >= 70 ? "C" : finalScore >= 60 ? "D" : "F",
    readiness,
    checks,
    recommendations,
  };
}

/**
 * Format a deploy plan as a human-readable string report.
 */
export function formatDeployPlan(plan: DeployPlan): string {
  const lines: string[] = [
    "=== Zero-Downtime Deploy Plan ===",
    `Strategy:  ${plan.strategy}`,
    `Version:   ${plan.currentVersion} → ${plan.targetVersion}`,
    `Instances: ${plan.totalInstances}`,
    `Est. Time: ${Math.round(plan.estimatedTotalDurationSec / 60)} min`,
    "",
    "Phases:",
  ];

  for (const phase of plan.phases) {
    lines.push(
      `  ${phase.order}. ${phase.name}`,
      `     Traffic: ${phase.trafficPercent}% | Instances: ${phase.instancesUpdated}`,
      `     Health check: ${phase.healthCheckRequired ? "Required" : "Skipped"}`,
      `     Rollback if: ${phase.rollbackTrigger}`
    );
  }

  lines.push("", `Rollback Plan: ${plan.rollbackPlan}`);

  return lines.join("\n");
}
