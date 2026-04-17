/**
 * __tests__/qualityQ160_162.test.ts
 *
 * Q-160: Obs — traceContext
 * Q-161: DX — apiDocGenerator
 * Q-162: Infra — featureToggleManager
 */
import { describe, it, expect } from "vitest";

// ── Q-160: traceContext ─────────────────────────────────────────────────

import {
  generateHexId,
  generateTraceId,
  generateSpanId,
  createTraceContext,
  createSpan,
  endSpan,
  formatTraceparent,
  parseTraceparent,
  formatBaggage,
  parseBaggage,
  calculateTraceMetrics,
  formatTraceMetrics,
  TRACEPARENT_HEADER,
  TRACE_VERSION,
  MAX_BAGGAGE_ITEMS,
} from "@/lib/traceContext";

describe("Q-160 traceContext", () => {
  describe("constants", () => {
    it("TRACEPARENT_HEADER is traceparent", () => {
      expect(TRACEPARENT_HEADER).toBe("traceparent");
    });
    it("TRACE_VERSION is 00", () => {
      expect(TRACE_VERSION).toBe("00");
    });
    it("MAX_BAGGAGE_ITEMS is positive", () => {
      expect(MAX_BAGGAGE_ITEMS).toBeGreaterThan(0);
    });
  });

  describe("ID generation", () => {
    it("generateHexId produces correct length", () => {
      expect(generateHexId(8)).toHaveLength(16);
      expect(generateHexId(16)).toHaveLength(32);
    });
    it("generateHexId uses hex chars", () => {
      expect(generateHexId(8)).toMatch(/^[0-9a-f]+$/);
    });
    it("generateTraceId is 32 chars", () => {
      expect(generateTraceId()).toHaveLength(32);
    });
    it("generateSpanId is 16 chars", () => {
      expect(generateSpanId()).toHaveLength(16);
    });
  });

  describe("createTraceContext", () => {
    it("creates with defaults", () => {
      const ctx = createTraceContext();
      expect(ctx.traceId).toHaveLength(32);
      expect(ctx.spanId).toHaveLength(16);
      expect(ctx.flags.sampled).toBe(true);
      expect(ctx.parentSpanId).toBeNull();
    });
    it("respects sampled option", () => {
      const ctx = createTraceContext({ sampled: false });
      expect(ctx.flags.sampled).toBe(false);
    });
    it("accepts baggage", () => {
      const ctx = createTraceContext({ baggage: { userId: "123" } });
      expect(ctx.baggage.userId).toBe("123");
    });
  });

  describe("createSpan", () => {
    it("creates child span", () => {
      const ctx = createTraceContext();
      const span = createSpan(ctx, "db.query");
      expect(span.traceId).toBe(ctx.traceId);
      expect(span.parentSpanId).toBe(ctx.spanId);
      expect(span.operationName).toBe("db.query");
      expect(span.status).toBe("unset");
      expect(span.endTime).toBeNull();
    });
    it("accepts attributes", () => {
      const ctx = createTraceContext();
      const span = createSpan(ctx, "http.request", { "http.method": "GET", "http.status": 200 });
      expect(span.attributes["http.method"]).toBe("GET");
    });
  });

  describe("endSpan", () => {
    it("sets endTime and duration", () => {
      const ctx = createTraceContext();
      const span = createSpan(ctx, "test");
      const ended = endSpan(span, "ok");
      expect(ended.endTime).toBeTruthy();
      expect(ended.durationMs).toBeGreaterThanOrEqual(0);
      expect(ended.status).toBe("ok");
    });
    it("can set error status", () => {
      const ctx = createTraceContext();
      const span = createSpan(ctx, "test");
      const ended = endSpan(span, "error");
      expect(ended.status).toBe("error");
    });
  });

  describe("formatTraceparent / parseTraceparent", () => {
    it("round-trips", () => {
      const ctx = createTraceContext();
      const header = formatTraceparent(ctx);
      const parsed = parseTraceparent(header);
      expect(parsed?.traceId).toBe(ctx.traceId);
      expect(parsed?.spanId).toBe(ctx.spanId);
      expect(parsed?.flags.sampled).toBe(ctx.flags.sampled);
    });
    it("format matches W3C pattern", () => {
      const ctx = createTraceContext();
      const header = formatTraceparent(ctx);
      expect(header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-(00|01)$/);
    });
    it("parse rejects invalid header", () => {
      expect(parseTraceparent("invalid")).toBeNull();
      expect(parseTraceparent("00-short-short-00")).toBeNull();
      expect(parseTraceparent("99-" + "a".repeat(32) + "-" + "b".repeat(16) + "-00")).toBeNull();
    });
  });

  describe("formatBaggage / parseBaggage", () => {
    it("round-trips", () => {
      const baggage = { userId: "123", env: "prod" };
      const header = formatBaggage(baggage);
      const parsed = parseBaggage(header);
      expect(parsed.userId).toBe("123");
      expect(parsed.env).toBe("prod");
    });
    it("handles empty", () => {
      expect(formatBaggage({})).toBe("");
      expect(parseBaggage("")).toEqual({});
    });
  });

  describe("calculateTraceMetrics", () => {
    it("handles empty spans", () => {
      const metrics = calculateTraceMetrics([]);
      expect(metrics.totalSpans).toBe(0);
      expect(metrics.avgDurationMs).toBe(0);
    });
    it("counts by status", () => {
      const ctx = createTraceContext();
      const spans = [
        endSpan(createSpan(ctx, "a"), "ok"),
        endSpan(createSpan(ctx, "b"), "ok"),
        endSpan(createSpan(ctx, "c"), "error"),
      ];
      const metrics = calculateTraceMetrics(spans);
      expect(metrics.byStatus.ok).toBe(2);
      expect(metrics.byStatus.error).toBe(1);
      expect(metrics.errorSpans).toBe(1);
    });
  });

  describe("formatTraceMetrics", () => {
    it("includes span count", () => {
      const metrics = calculateTraceMetrics([]);
      const text = formatTraceMetrics(metrics);
      expect(text).toContain("Trace Metrics");
      expect(text).toContain("0 spans");
    });
  });

  describe("barrel exports", () => {
    it("exports from lib/index", async () => {
      const mod = await import("@/lib/index");
      expect(mod.createTraceContext).toBeDefined();
      expect(mod.formatTraceparent).toBeDefined();
      expect(mod.TRACEPARENT_HEADER).toBeDefined();
    });
  });
});

// ── Q-161: apiDocGenerator ──────────────────────────────────────────────

import {
  defineEndpoint,
  buildApiDoc,
  findUndocumented,
  findDeprecated,
  buildChangelog,
  formatApiDoc,
  API_METHODS,
  STANDARD_ERRORS,
  AUTH_LABELS,
} from "@/lib/apiDocGenerator";

const sampleEndpoint = () => defineEndpoint("/api/health", "GET", {
  description: "Health check endpoint",
  auth: "none",
  response: { contentType: "application/json", fields: [], example: '{"status":"ok"}' },
  errors: [{ status: 500, code: "INTERNAL", description: "Server error" }],
  tags: ["system"],
});

describe("Q-161 apiDocGenerator", () => {
  describe("API_METHODS", () => {
    it("has 5 methods", () => {
      expect(API_METHODS).toHaveLength(5);
      expect(API_METHODS).toContain("GET");
      expect(API_METHODS).toContain("POST");
    });
  });

  describe("STANDARD_ERRORS", () => {
    it("includes common status codes", () => {
      const codes = STANDARD_ERRORS.map((e) => e.status);
      expect(codes).toContain(400);
      expect(codes).toContain(401);
      expect(codes).toContain(404);
      expect(codes).toContain(500);
    });
  });

  describe("AUTH_LABELS", () => {
    it("maps all auth types", () => {
      expect(AUTH_LABELS.none).toBe("Public");
      expect(AUTH_LABELS.admin).toBe("Admin Only");
    });
  });

  describe("defineEndpoint", () => {
    it("creates with defaults", () => {
      const ep = defineEndpoint("/api/test", "POST", {
        description: "Test",
        response: { contentType: "application/json", fields: [], example: "{}" },
      });
      expect(ep.auth).toBe("user");
      expect(ep.deprecated).toBe(false);
      expect(ep.tags).toEqual(["general"]);
    });
    it("respects all options", () => {
      const ep = defineEndpoint("/api/admin", "DELETE", {
        description: "Delete user",
        auth: "admin",
        rateLimit: 10,
        response: { contentType: "application/json", fields: [], example: "{}" },
        deprecated: true,
        tags: ["admin"],
      });
      expect(ep.auth).toBe("admin");
      expect(ep.rateLimit).toBe(10);
      expect(ep.deprecated).toBe(true);
    });
  });

  describe("buildApiDoc", () => {
    it("groups by tag", () => {
      const endpoints = [
        sampleEndpoint(),
        defineEndpoint("/api/users", "GET", {
          description: "List users",
          response: { contentType: "application/json", fields: [], example: "[]" },
          tags: ["users"],
        }),
      ];
      const doc = buildApiDoc(endpoints);
      expect(doc.endpointsByTag["system"]).toHaveLength(1);
      expect(doc.endpointsByTag["users"]).toHaveLength(1);
      expect(doc.totalEndpoints).toBe(2);
    });
    it("calculates coverage", () => {
      const ep = sampleEndpoint();
      const doc = buildApiDoc([ep]);
      expect(doc.coverage.documented).toBe(1);
      expect(doc.coverage.withExamples).toBe(1);
      expect(doc.coverage.withErrors).toBe(1);
      expect(doc.coverage.coveragePercent).toBe(100);
    });
    it("handles empty endpoints", () => {
      const doc = buildApiDoc([]);
      expect(doc.totalEndpoints).toBe(0);
      expect(doc.coverage.coveragePercent).toBe(100);
    });
  });

  describe("findUndocumented", () => {
    it("finds endpoints without examples", () => {
      const ep = defineEndpoint("/api/test", "GET", {
        description: "Test",
        response: { contentType: "application/json", fields: [], example: "" },
      });
      expect(findUndocumented([ep])).toHaveLength(1);
    });
    it("returns empty for fully documented", () => {
      expect(findUndocumented([sampleEndpoint()])).toHaveLength(0);
    });
  });

  describe("findDeprecated", () => {
    it("finds deprecated endpoints", () => {
      const ep = defineEndpoint("/api/old", "GET", {
        description: "Old",
        response: { contentType: "application/json", fields: [], example: "{}" },
        deprecated: true,
      });
      expect(findDeprecated([ep])).toHaveLength(1);
    });
  });

  describe("buildChangelog", () => {
    it("detects added endpoints", () => {
      const old: ReturnType<typeof defineEndpoint>[] = [];
      const newEps = [sampleEndpoint()];
      const changelog = buildChangelog(old, newEps, "1.1.0");
      expect(changelog.changes).toHaveLength(1);
      expect(changelog.changes[0].type).toBe("added");
    });
    it("detects removed endpoints", () => {
      const old = [sampleEndpoint()];
      const newEps: ReturnType<typeof defineEndpoint>[] = [];
      const changelog = buildChangelog(old, newEps, "2.0.0");
      expect(changelog.changes).toHaveLength(1);
      expect(changelog.changes[0].type).toBe("removed");
    });
    it("detects deprecated endpoints", () => {
      const old = [sampleEndpoint()];
      const dep = { ...sampleEndpoint(), deprecated: true };
      const changelog = buildChangelog(old, [dep], "1.2.0");
      expect(changelog.changes.some((c) => c.type === "deprecated")).toBe(true);
    });
  });

  describe("formatApiDoc", () => {
    it("includes version and count", () => {
      const doc = buildApiDoc([sampleEndpoint()]);
      const text = formatApiDoc(doc);
      expect(text).toContain("API Documentation");
      expect(text).toContain("1");
    });
  });

  describe("barrel exports", () => {
    it("exports from lib/index", async () => {
      const mod = await import("@/lib/index");
      expect(mod.defineEndpoint).toBeDefined();
      expect(mod.buildApiDoc).toBeDefined();
      expect(mod.API_METHODS).toBeDefined();
    });
  });
});

// ── Q-162: featureToggleManager ─────────────────────────────────────────

import {
  defineToggle,
  evaluateToggle,
  findStaleToggles,
  findBrokenDependencies,
  auditToggles,
  formatToggleAudit,
  deterministicHash,
  TOGGLE_STATES,
  STALE_WARNING_THRESHOLD,
  DEFAULT_EXPIRY_DAYS,
} from "@/lib/featureToggleManager";

describe("Q-162 featureToggleManager", () => {
  describe("TOGGLE_STATES", () => {
    it("has 4 states", () => {
      expect(TOGGLE_STATES).toHaveLength(4);
      expect(TOGGLE_STATES).toContain("off");
      expect(TOGGLE_STATES).toContain("on");
      expect(TOGGLE_STATES).toContain("gradual");
      expect(TOGGLE_STATES).toContain("archived");
    });
  });

  describe("constants", () => {
    it("STALE_WARNING_THRESHOLD is positive", () => {
      expect(STALE_WARNING_THRESHOLD).toBeGreaterThan(0);
    });
    it("DEFAULT_EXPIRY_DAYS is positive", () => {
      expect(DEFAULT_EXPIRY_DAYS).toBeGreaterThan(0);
    });
  });

  describe("defineToggle", () => {
    it("creates with defaults", () => {
      const toggle = defineToggle("test_feature");
      expect(toggle.id).toBe("test_feature");
      expect(toggle.state).toBe("off");
      expect(toggle.rolloutPercent).toBe(0);
      expect(toggle.dependencies).toEqual([]);
      expect(toggle.expiresAt).toBeTruthy();
    });
    it("respects options", () => {
      const toggle = defineToggle("premium", {
        state: "gradual",
        rolloutPercent: 50,
        owner: "alice",
        tags: ["billing"],
      });
      expect(toggle.state).toBe("gradual");
      expect(toggle.rolloutPercent).toBe(50);
      expect(toggle.owner).toBe("alice");
    });
    it("clamps rollout percent", () => {
      expect(defineToggle("a", { rolloutPercent: -10 }).rolloutPercent).toBe(0);
      expect(defineToggle("b", { rolloutPercent: 150 }).rolloutPercent).toBe(100);
    });
  });

  describe("evaluateToggle", () => {
    it("returns disabled for off toggle", () => {
      const toggle = defineToggle("test", { state: "off" });
      const result = evaluateToggle(toggle, "user-1");
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe("toggle_off");
    });
    it("returns enabled for on toggle", () => {
      const toggle = defineToggle("test", { state: "on" });
      const result = evaluateToggle(toggle, "user-1");
      expect(result.enabled).toBe(true);
      expect(result.reason).toBe("toggle_on");
    });
    it("returns disabled for archived toggle", () => {
      const toggle = defineToggle("test", { state: "archived" });
      const result = evaluateToggle(toggle, "user-1");
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe("toggle_archived");
    });
    it("gradual rollout is deterministic", () => {
      const toggle = defineToggle("test", { state: "gradual", rolloutPercent: 50 });
      const result1 = evaluateToggle(toggle, "user-123");
      const result2 = evaluateToggle(toggle, "user-123");
      expect(result1.enabled).toBe(result2.enabled);
    });
    it("100% rollout enables everyone", () => {
      const toggle = defineToggle("test", { state: "gradual", rolloutPercent: 100 });
      for (let i = 0; i < 10; i++) {
        expect(evaluateToggle(toggle, `user-${i}`).enabled).toBe(true);
      }
    });
    it("0% rollout enables no one", () => {
      const toggle = defineToggle("test", { state: "gradual", rolloutPercent: 0 });
      for (let i = 0; i < 10; i++) {
        expect(evaluateToggle(toggle, `user-${i}`).enabled).toBe(false);
      }
    });
    it("checks dependencies", () => {
      const dep = defineToggle("dep", { state: "off" });
      const toggle = defineToggle("test", { state: "on", dependencies: ["dep"] });
      const result = evaluateToggle(toggle, "user-1", [dep, toggle]);
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe("dependency_not_met");
    });
    it("passes when dependency is on", () => {
      const dep = defineToggle("dep", { state: "on" });
      const toggle = defineToggle("test", { state: "on", dependencies: ["dep"] });
      const result = evaluateToggle(toggle, "user-1", [dep, toggle]);
      expect(result.enabled).toBe(true);
    });
  });

  describe("findStaleToggles", () => {
    it("finds expired toggles", () => {
      const toggle = defineToggle("old", { expiryDays: -1 });
      // Force expiry to past
      const staleToggle = { ...toggle, expiresAt: new Date(Date.now() - 86400000).toISOString() };
      expect(findStaleToggles([staleToggle])).toHaveLength(1);
    });
    it("excludes archived", () => {
      const toggle = defineToggle("old", { state: "archived" });
      const staleToggle = { ...toggle, expiresAt: new Date(Date.now() - 86400000).toISOString() };
      expect(findStaleToggles([staleToggle])).toHaveLength(0);
    });
    it("excludes non-expired", () => {
      const toggle = defineToggle("fresh");
      expect(findStaleToggles([toggle])).toHaveLength(0);
    });
  });

  describe("findBrokenDependencies", () => {
    it("finds toggles with missing deps", () => {
      const toggle = defineToggle("test", { state: "on", dependencies: ["nonexistent"] });
      const broken = findBrokenDependencies([toggle]);
      expect(broken).toHaveLength(1);
      expect(broken[0].missingDeps).toContain("nonexistent");
    });
    it("returns empty when deps met", () => {
      const dep = defineToggle("dep", { state: "on" });
      const toggle = defineToggle("test", { state: "on", dependencies: ["dep"] });
      expect(findBrokenDependencies([dep, toggle])).toHaveLength(0);
    });
  });

  describe("auditToggles", () => {
    it("counts by state", () => {
      const toggles = [
        defineToggle("a", { state: "on" }),
        defineToggle("b", { state: "off" }),
        defineToggle("c", { state: "archived" }),
      ];
      const audit = auditToggles(toggles);
      expect(audit.total).toBe(3);
      expect(audit.byState.on).toBe(1);
      expect(audit.byState.off).toBe(1);
      expect(audit.byState.archived).toBe(1);
      expect(audit.active).toBe(2);
    });
    it("healthy with no stale", () => {
      const audit = auditToggles([defineToggle("a", { state: "on" })]);
      expect(audit.health).toBe("healthy");
    });
  });

  describe("deterministicHash", () => {
    it("is deterministic", () => {
      expect(deterministicHash("test")).toBe(deterministicHash("test"));
    });
    it("different inputs produce different hashes", () => {
      expect(deterministicHash("a")).not.toBe(deterministicHash("b"));
    });
    it("returns non-negative", () => {
      expect(deterministicHash("test")).toBeGreaterThanOrEqual(0);
    });
  });

  describe("formatToggleAudit", () => {
    it("includes health status", () => {
      const audit = auditToggles([defineToggle("a", { state: "on" })]);
      const text = formatToggleAudit(audit);
      expect(text).toContain("Feature Toggles");
      expect(text).toContain("✅");
    });
  });

  describe("barrel exports", () => {
    it("exports from lib/index", async () => {
      const mod = await import("@/lib/index");
      expect(mod.defineToggle).toBeDefined();
      expect(mod.evaluateToggle).toBeDefined();
      expect(mod.TOGGLE_STATES).toBeDefined();
      expect(mod.auditToggles).toBeDefined();
    });
  });
});
