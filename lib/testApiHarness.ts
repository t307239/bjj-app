/**
 * lib/testApiHarness.ts — API test harness utilities
 *
 * Q-230: Test pillar — provides mock request/response builders,
 * test case runners, and coverage reporting for Next.js API routes.
 *
 * Pure utility layer — no DB access, no UI. Consumers pass handlers in,
 * get test results back.
 *
 * @example
 *   import { buildApiTestCase, runTestSuite, buildTestSuite } from "@/lib/testApiHarness";
 *   const tc = buildApiTestCase("GET", "/api/users", null, 200, { users: [] });
 *   const suite = buildTestSuite("Users API", [tc]);
 *   const result = runTestSuite(suite, handler);
 */

// ── Types ────────────────────────────────────────────────────────────────

/** Common HTTP methods */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/** Mock request object mimicking Next.js API request */
export interface MockRequest {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
  readonly query: Record<string, string>;
  readonly cookies: Record<string, string>;
}

/** Tracked response data from a mock response */
export interface MockResponseData {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody: unknown;
  ended: boolean;
}

/** Mock response object with tracking */
export interface MockResponse {
  status: (code: number) => MockResponse;
  json: (body: unknown) => MockResponse;
  setHeader: (name: string, value: string) => MockResponse;
  end: () => void;
  /** Inspect captured state */
  _getData: () => MockResponseData;
}

/** A single API test case */
export interface ApiTestCase {
  readonly id: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly body: unknown;
  readonly headers: Record<string, string>;
  readonly expectedStatus: number;
  readonly expectedBody: unknown;
  readonly description: string;
}

/** Result of a single test case execution */
export interface ApiTestResult {
  readonly caseId: string;
  readonly passed: boolean;
  readonly actualStatus: number;
  readonly actualBody: unknown;
  readonly expectedStatus: number;
  readonly expectedBody: unknown;
  readonly diffs: string[];
  readonly durationMs: number;
}

/** A group of related test cases */
export interface ApiTestSuite {
  readonly name: string;
  readonly cases: ApiTestCase[];
}

/** Result of running an entire suite */
export interface ApiTestSuiteResult {
  readonly suiteName: string;
  readonly results: ApiTestResult[];
  readonly passCount: number;
  readonly failCount: number;
  readonly totalDurationMs: number;
}

/** Coverage report across multiple suites */
export interface ApiCoverageReport {
  readonly totalSuites: number;
  readonly totalCases: number;
  readonly totalPassed: number;
  readonly totalFailed: number;
  readonly passRate: number;
  readonly suiteBreakdown: Array<{
    name: string;
    passed: number;
    failed: number;
    passRate: number;
  }>;
  readonly generatedAt: string;
}

/** API handler type */
export type ApiHandler = (
  req: MockRequest,
  res: MockResponse,
) => void | Promise<void>;

// ── Request/Response Builders ────────────────────────────────────────────

/** Build a mock Next.js-style request object */
export function createMockRequest(
  overrides: Partial<MockRequest> = {},
): MockRequest {
  return {
    method: overrides.method ?? "GET",
    url: overrides.url ?? "/api/test",
    headers: overrides.headers ?? {},
    body: overrides.body ?? null,
    query: overrides.query ?? {},
    cookies: overrides.cookies ?? {},
  };
}

/** Build a mock response with json/status/headers tracking */
export function createMockResponse(): MockResponse {
  const data: MockResponseData = {
    statusCode: 200,
    headers: {},
    jsonBody: null,
    ended: false,
  };

  const res: MockResponse = {
    status(code: number) {
      data.statusCode = code;
      return res;
    },
    json(body: unknown) {
      data.jsonBody = body;
      return res;
    },
    setHeader(name: string, value: string) {
      data.headers[name.toLowerCase()] = value;
      return res;
    },
    end() {
      data.ended = true;
    },
    _getData() {
      return { ...data, headers: { ...data.headers } };
    },
  };

  return res;
}

// ── Auth Helpers ─────────────────────────────────────────────────────────

/** Attach auth headers to a mock request (simulates authenticated user) */
export function withAuth(request: MockRequest, userId: string): MockRequest {
  return {
    ...request,
    headers: {
      ...request.headers,
      authorization: `Bearer mock-token-${userId}`,
      "x-user-id": userId,
    },
  };
}

/** Strip auth headers from a mock request (simulates unauthenticated user) */
export function withoutAuth(request: MockRequest): MockRequest {
  const headers = { ...request.headers };
  delete headers.authorization;
  delete headers["x-user-id"];
  return { ...request, headers };
}

// ── Test Case Builders ───────────────────────────────────────────────────

let caseCounter = 0;

/** Create a test case definition */
export function buildApiTestCase(
  method: HttpMethod,
  path: string,
  body: unknown,
  expectedStatus: number,
  expectedBody: unknown,
  description?: string,
): ApiTestCase {
  caseCounter += 1;
  return {
    id: `tc-${caseCounter}`,
    method,
    path,
    body,
    headers: {},
    expectedStatus,
    expectedBody,
    description: description ?? `${method} ${path} → ${expectedStatus}`,
  };
}

// ── Deep Comparison ──────────────────────────────────────────────────────

/** Deep comparison with diff reporting */
export function assertResponse(
  actual: { status: number; body: unknown },
  expected: { status: number; body: unknown },
): { passed: boolean; diffs: string[] } {
  const diffs: string[] = [];

  if (actual.status !== expected.status) {
    diffs.push(
      `Status: expected ${expected.status}, got ${actual.status}`,
    );
  }

  const actualJson = JSON.stringify(actual.body, null, 2);
  const expectedJson = JSON.stringify(expected.body, null, 2);

  if (actualJson !== expectedJson && expected.body !== null) {
    diffs.push(
      `Body mismatch:\n  expected: ${expectedJson}\n  actual:   ${actualJson}`,
    );
  }

  return { passed: diffs.length === 0, diffs };
}

// ── Test Runner ──────────────────────────────────────────────────────────

/** Run a single test case against an API handler */
export async function runApiTestCase(
  handler: ApiHandler,
  testCase: ApiTestCase,
): Promise<ApiTestResult> {
  const req = createMockRequest({
    method: testCase.method,
    url: testCase.path,
    body: testCase.body,
    headers: testCase.headers,
  });
  const res = createMockResponse();

  const start = Date.now();
  await handler(req, res);
  const durationMs = Date.now() - start;

  const data = res._getData();
  const { passed, diffs } = assertResponse(
    { status: data.statusCode, body: data.jsonBody },
    { status: testCase.expectedStatus, body: testCase.expectedBody },
  );

  return {
    caseId: testCase.id,
    passed,
    actualStatus: data.statusCode,
    actualBody: data.jsonBody,
    expectedStatus: testCase.expectedStatus,
    expectedBody: testCase.expectedBody,
    diffs,
    durationMs,
  };
}

// ── Suite Builder & Runner ───────────────────────────────────────────────

/** Group test cases into a suite */
export function buildTestSuite(
  name: string,
  cases: ApiTestCase[],
): ApiTestSuite {
  return { name, cases };
}

/** Run all cases in a suite and aggregate results */
export async function runTestSuite(
  suite: ApiTestSuite,
  handler: ApiHandler,
): Promise<ApiTestSuiteResult> {
  const start = Date.now();
  const results: ApiTestResult[] = [];

  for (const tc of suite.cases) {
    const result = await runApiTestCase(handler, tc);
    results.push(result);
  }

  const totalDurationMs = Date.now() - start;
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.length - passCount;

  return {
    suiteName: suite.name,
    results,
    passCount,
    failCount,
    totalDurationMs,
  };
}

// ── Coverage & Reporting ─────────────────────────────────────────────────

/** Generate a coverage report across multiple suite results */
export function generateApiCoverageReport(
  suites: ApiTestSuiteResult[],
): ApiCoverageReport {
  const totalCases = suites.reduce((sum, s) => sum + s.results.length, 0);
  const totalPassed = suites.reduce((sum, s) => sum + s.passCount, 0);
  const totalFailed = suites.reduce((sum, s) => sum + s.failCount, 0);

  return {
    totalSuites: suites.length,
    totalCases,
    totalPassed,
    totalFailed,
    passRate: totalCases > 0 ? totalPassed / totalCases : 0,
    suiteBreakdown: suites.map((s) => ({
      name: s.suiteName,
      passed: s.passCount,
      failed: s.failCount,
      passRate:
        s.results.length > 0 ? s.passCount / s.results.length : 0,
    })),
    generatedAt: new Date().toISOString(),
  };
}

/** Format test results as human-readable text */
export function formatApiTestReport(result: ApiTestSuiteResult): string {
  const lines: string[] = [
    `=== ${result.suiteName} ===`,
    `Pass: ${result.passCount} / ${result.results.length}  (${result.totalDurationMs}ms)`,
    "",
  ];

  for (const r of result.results) {
    const icon = r.passed ? "PASS" : "FAIL";
    lines.push(`  [${icon}] ${r.caseId} — ${r.actualStatus}`);
    if (!r.passed) {
      for (const d of r.diffs) {
        lines.push(`         ${d}`);
      }
    }
  }

  return lines.join("\n");
}

// ── Rate Limit Helper ────────────────────────────────────────────────────

/** Test that a handler enforces rate limiting */
export async function testRateLimitBehavior(
  handler: ApiHandler,
  limit: number,
  _windowMs: number,
): Promise<{
  requestsSent: number;
  firstRejectedAt: number | null;
  allPassedBeforeLimit: boolean;
}> {
  let firstRejectedAt: number | null = null;
  const attemptsToMake = limit + 5;

  for (let i = 0; i < attemptsToMake; i++) {
    const req = createMockRequest({
      method: "GET",
      url: "/api/test-rate-limit",
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const res = createMockResponse();
    await handler(req, res);

    const data = res._getData();
    if (data.statusCode === 429 && firstRejectedAt === null) {
      firstRejectedAt = i;
    }
  }

  return {
    requestsSent: attemptsToMake,
    firstRejectedAt,
    allPassedBeforeLimit:
      firstRejectedAt === null || firstRejectedAt >= limit,
  };
}

// ── Constants ────────────────────────────────────────────────────────────

/** Common HTTP methods for iteration */
export const HTTP_METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
] as const;
