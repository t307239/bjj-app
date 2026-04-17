#!/usr/bin/env node
/**
 * scripts/smoke-test.mjs — Post-deploy smoke test
 *
 * Q-113: Infra pillar — lightweight health verification after deploy.
 * Checks /api/health and key pages to ensure the deployment is functional.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                           # default: https://bjj-app.net
 *   node scripts/smoke-test.mjs --base-url http://localhost:3000
 *   node scripts/smoke-test.mjs --json                    # JSON output for CI
 *   node scripts/smoke-test.mjs --timeout 10000           # 10s timeout
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

const DEFAULT_BASE_URL = "https://bjj-app.net";
const DEFAULT_TIMEOUT_MS = 8000;

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = DEFAULT_BASE_URL;
  let jsonOutput = false;
  let timeoutMs = DEFAULT_TIMEOUT_MS;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base-url" && args[i + 1]) {
      baseUrl = args[i + 1];
      i++;
    }
    if (args[i] === "--json") {
      jsonOutput = true;
    }
    if (args[i] === "--timeout" && args[i + 1]) {
      timeoutMs = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), jsonOutput, timeoutMs };
}

/**
 * @typedef {{ name: string; path: string; expectedStatus: number; checkBody?: (body: unknown) => string | null }} Check
 */

/** @type {Check[]} */
const CHECKS = [
  {
    name: "Health endpoint",
    path: "/api/health",
    expectedStatus: 200,
    checkBody: (body) => {
      if (typeof body !== "object" || body === null) return "Response is not JSON object";
      if (!("status" in body)) return "Missing 'status' field";
      if (body.status !== "ok") return `status = "${body.status}" (expected "ok")`;
      if (!("dbLatencyMs" in body)) return "Missing 'dbLatencyMs' field";
      if (body.dbLatencyMs > 5000) return `DB latency ${body.dbLatencyMs}ms > 5000ms threshold`;
      return null;
    },
  },
  {
    name: "Landing page",
    path: "/",
    expectedStatus: 200,
  },
  {
    name: "Login page",
    path: "/login",
    expectedStatus: 200,
  },
  {
    name: "Privacy page",
    path: "/privacy",
    expectedStatus: 200,
  },
  {
    name: "Terms page",
    path: "/terms",
    expectedStatus: 200,
  },
  {
    name: "Help page",
    path: "/help",
    expectedStatus: 200,
  },
  {
    name: "OG image endpoint",
    path: "/api/og?belt=white&count=0&months=0&streak=0&mode=lp",
    expectedStatus: 200,
  },
];

async function runCheck(check, baseUrl, timeoutMs) {
  const url = `${baseUrl}${check.path}`;
  const t0 = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "bjj-app-smoke-test/1.0" },
      redirect: "follow",
    });

    clearTimeout(timer);
    const durationMs = Date.now() - t0;

    if (res.status !== check.expectedStatus) {
      return {
        name: check.name,
        path: check.path,
        status: "fail",
        durationMs,
        error: `HTTP ${res.status} (expected ${check.expectedStatus})`,
      };
    }

    // Body validation for JSON endpoints
    if (check.checkBody) {
      const body = await res.json().catch(() => null);
      const bodyError = check.checkBody(body);
      if (bodyError) {
        return {
          name: check.name,
          path: check.path,
          status: "fail",
          durationMs,
          error: bodyError,
        };
      }
    }

    return {
      name: check.name,
      path: check.path,
      status: "pass",
      durationMs,
    };
  } catch (err) {
    return {
      name: check.name,
      path: check.path,
      status: "fail",
      durationMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const { baseUrl, jsonOutput, timeoutMs } = parseArgs();

  if (!jsonOutput) {
    console.log(`🔍 Smoke testing ${baseUrl} …\n`);
  }

  const results = await Promise.all(
    CHECKS.map((check) => runCheck(check, baseUrl, timeoutMs))
  );

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;

  if (jsonOutput) {
    console.log(JSON.stringify({
      baseUrl,
      passed,
      failed,
      total: results.length,
      checks: results,
    }));
  } else {
    for (const r of results) {
      const icon = r.status === "pass" ? "✅" : "❌";
      const timing = `${r.durationMs}ms`;
      const err = r.error ? ` — ${r.error}` : "";
      console.log(`  ${icon} ${r.name} (${timing})${err}`);
    }
    console.log(`\n${passed}/${results.length} passed${failed > 0 ? ` · ${failed} FAILED` : ""}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
