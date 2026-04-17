/**
 * lib/apiDocGenerator.ts — API documentation generation utilities
 *
 * Q-161: DX pillar — provides automated API endpoint documentation
 * generation, request/response schema documentation, and API
 * changelog tracking to improve developer experience.
 *
 * Pure utility layer — no DB access, no UI.
 *
 * @example
 *   import { defineEndpoint, buildApiDoc, API_METHODS } from "@/lib/apiDocGenerator";
 *   const endpoint = defineEndpoint("/api/health", "GET", { ... });
 *   const doc = buildApiDoc([endpoint]);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface ApiEndpoint {
  /** Path (e.g., /api/health) */
  path: string;
  /** HTTP method */
  method: HttpMethod;
  /** Description */
  description: string;
  /** Auth requirement */
  auth: AuthRequirement;
  /** Rate limit (requests per minute) */
  rateLimit: number | null;
  /** Request schema */
  request: SchemaDoc | null;
  /** Response schema */
  response: SchemaDoc;
  /** Error responses */
  errors: ErrorDoc[];
  /** Tags for grouping */
  tags: string[];
  /** Version added */
  since: string;
  /** Whether deprecated */
  deprecated: boolean;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AuthRequirement = "none" | "user" | "admin" | "api_key";

export interface SchemaDoc {
  /** Content type */
  contentType: string;
  /** Field documentation */
  fields: FieldDoc[];
  /** Example value */
  example: string;
}

export interface FieldDoc {
  /** Field name */
  name: string;
  /** Type */
  type: string;
  /** Required */
  required: boolean;
  /** Description */
  description: string;
}

export interface ErrorDoc {
  /** HTTP status code */
  status: number;
  /** Error code */
  code: string;
  /** Description */
  description: string;
}

export interface ApiDoc {
  /** Generated timestamp */
  generatedAt: string;
  /** API version */
  version: string;
  /** Base URL */
  baseUrl: string;
  /** Endpoints grouped by tag */
  endpointsByTag: Record<string, ApiEndpoint[]>;
  /** Total endpoints */
  totalEndpoints: number;
  /** Coverage stats */
  coverage: ApiCoverage;
}

export interface ApiCoverage {
  /** Endpoints with descriptions */
  documented: number;
  /** Endpoints with examples */
  withExamples: number;
  /** Endpoints with error docs */
  withErrors: number;
  /** Coverage percentage */
  coveragePercent: number;
}

export interface ApiChangelog {
  /** Version */
  version: string;
  /** Date */
  date: string;
  /** Changes */
  changes: ApiChange[];
}

export interface ApiChange {
  /** Change type */
  type: "added" | "changed" | "deprecated" | "removed";
  /** Endpoint path */
  path: string;
  /** Description */
  description: string;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Valid HTTP methods */
export const API_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/** Standard error responses */
export const STANDARD_ERRORS: ErrorDoc[] = [
  { status: 400, code: "BAD_REQUEST", description: "Invalid request parameters" },
  { status: 401, code: "UNAUTHORIZED", description: "Authentication required" },
  { status: 403, code: "FORBIDDEN", description: "Insufficient permissions" },
  { status: 404, code: "NOT_FOUND", description: "Resource not found" },
  { status: 429, code: "RATE_LIMITED", description: "Too many requests" },
  { status: 500, code: "INTERNAL_ERROR", description: "Internal server error" },
];

/** Auth level display names */
export const AUTH_LABELS: Record<AuthRequirement, string> = {
  none: "Public",
  user: "Authenticated User",
  admin: "Admin Only",
  api_key: "API Key",
};

// ── Endpoint Definition ─────────────────────────────────────────────────

/**
 * Define an API endpoint with documentation.
 */
export function defineEndpoint(
  path: string,
  method: HttpMethod,
  options: {
    description: string;
    auth?: AuthRequirement;
    rateLimit?: number;
    request?: SchemaDoc;
    response: SchemaDoc;
    errors?: ErrorDoc[];
    tags?: string[];
    since?: string;
    deprecated?: boolean;
  },
): ApiEndpoint {
  return {
    path,
    method,
    description: options.description,
    auth: options.auth ?? "user",
    rateLimit: options.rateLimit ?? null,
    request: options.request ?? null,
    response: options.response,
    errors: options.errors ?? [],
    tags: options.tags ?? ["general"],
    since: options.since ?? "1.0.0",
    deprecated: options.deprecated ?? false,
  };
}

/**
 * Build full API documentation from endpoints.
 */
export function buildApiDoc(
  endpoints: ApiEndpoint[],
  options: { version?: string; baseUrl?: string } = {},
): ApiDoc {
  const endpointsByTag: Record<string, ApiEndpoint[]> = {};

  for (const endpoint of endpoints) {
    for (const tag of endpoint.tags) {
      if (!endpointsByTag[tag]) endpointsByTag[tag] = [];
      endpointsByTag[tag].push(endpoint);
    }
  }

  const documented = endpoints.filter((e) => e.description.length > 0).length;
  const withExamples = endpoints.filter((e) => e.response.example.length > 0).length;
  const withErrors = endpoints.filter((e) => e.errors.length > 0).length;
  const coveragePercent = endpoints.length > 0
    ? ((documented + withExamples + withErrors) / (endpoints.length * 3)) * 100
    : 100;

  return {
    generatedAt: new Date().toISOString(),
    version: options.version ?? "1.0.0",
    baseUrl: options.baseUrl ?? "https://bjj-app.net",
    endpointsByTag,
    totalEndpoints: endpoints.length,
    coverage: {
      documented,
      withExamples,
      withErrors,
      coveragePercent,
    },
  };
}

/**
 * Find undocumented endpoints.
 */
export function findUndocumented(endpoints: ApiEndpoint[]): ApiEndpoint[] {
  return endpoints.filter(
    (e) => !e.description || e.response.example.length === 0 || e.errors.length === 0,
  );
}

/**
 * Find deprecated endpoints.
 */
export function findDeprecated(endpoints: ApiEndpoint[]): ApiEndpoint[] {
  return endpoints.filter((e) => e.deprecated);
}

/**
 * Build a changelog from two endpoint snapshots.
 */
export function buildChangelog(
  oldEndpoints: ApiEndpoint[],
  newEndpoints: ApiEndpoint[],
  version: string,
): ApiChangelog {
  const changes: ApiChange[] = [];
  const oldPaths = new Set(oldEndpoints.map((e) => `${e.method} ${e.path}`));
  const newPaths = new Set(newEndpoints.map((e) => `${e.method} ${e.path}`));

  for (const endpoint of newEndpoints) {
    const key = `${endpoint.method} ${endpoint.path}`;
    if (!oldPaths.has(key)) {
      changes.push({ type: "added", path: endpoint.path, description: `Added ${endpoint.method} ${endpoint.path}` });
    }
  }

  for (const endpoint of oldEndpoints) {
    const key = `${endpoint.method} ${endpoint.path}`;
    if (!newPaths.has(key)) {
      changes.push({ type: "removed", path: endpoint.path, description: `Removed ${endpoint.method} ${endpoint.path}` });
    }
  }

  for (const newEp of newEndpoints) {
    if (newEp.deprecated) {
      const oldEp = oldEndpoints.find((e) => e.method === newEp.method && e.path === newEp.path);
      if (oldEp && !oldEp.deprecated) {
        changes.push({ type: "deprecated", path: newEp.path, description: `Deprecated ${newEp.method} ${newEp.path}` });
      }
    }
  }

  return {
    version,
    date: new Date().toISOString().split("T")[0],
    changes,
  };
}

/**
 * Format API documentation as human-readable string.
 */
export function formatApiDoc(doc: ApiDoc): string {
  const lines = [
    `📖 API Documentation v${doc.version}`,
    `   Base URL: ${doc.baseUrl}`,
    `   Endpoints: ${doc.totalEndpoints}`,
    `   Coverage: ${doc.coverage.coveragePercent.toFixed(0)}%`,
  ];

  for (const [tag, endpoints] of Object.entries(doc.endpointsByTag)) {
    lines.push("", `[${tag}]`);
    for (const ep of endpoints) {
      const auth = AUTH_LABELS[ep.auth];
      const deprecated = ep.deprecated ? " ⚠️ DEPRECATED" : "";
      lines.push(`  ${ep.method} ${ep.path} — ${ep.description} (${auth})${deprecated}`);
    }
  }

  return lines.join("\n");
}
