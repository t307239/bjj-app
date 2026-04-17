/**
 * __tests__/qualityQ142_145.test.ts
 *
 * Q-142: Performance — Server Component analysis (classifyComponent, migrationROI, SC ratio)
 * Q-143: a11y — List keyboard navigation (getNextIndex, findByTypeAhead, keyToDirection, buildProps)
 * Q-144: Security — CSP builder + SRI (generateNonce, buildCSPHeader, isValidSRI, parseViolation)
 * Q-145: Obs — Synthetic probe (buildProbeReport, shouldAlert, buildTelegramMessage)
 */
import { describe, it, expect } from "vitest";

// ── Q-142: Server Component Analysis ────────────────────────────────────

import {
  classifyComponent,
  calculateMigrationROI,
  createSCRatioSnapshot,
  isSCRatioHealthy,
  formatMigrationSummary,
  SC_BUDGET,
  CLIENT_PATTERNS,
  SERVER_PATTERNS,
} from "@/lib/serverComponentAnalysis";

describe("Q-142: serverComponentAnalysis", () => {
  it("SC_BUDGET has sensible defaults", () => {
    expect(SC_BUDGET.targetServerPercent).toBe(40);
    expect(SC_BUDGET.warningServerPercent).toBe(25);
    expect(SC_BUDGET.avgBytesPerLine).toBeGreaterThan(0);
  });

  it("CLIENT_PATTERNS and SERVER_PATTERNS are non-empty", () => {
    expect(CLIENT_PATTERNS.length).toBeGreaterThan(0);
    expect(SERVER_PATTERNS.length).toBeGreaterThan(0);
  });

  it("classifyComponent — server (no use client)", () => {
    const result = classifyComponent('export default function Page() { return <div/>; }');
    expect(result.hasUseClient).toBe(false);
    expect(result.classification).toBe("server");
  });

  it("classifyComponent — candidate (use client but no client APIs)", () => {
    const result = classifyComponent('"use client";\nexport default function Foo() { return <p>hi</p>; }');
    expect(result.hasUseClient).toBe(true);
    expect(result.classification).toBe("candidate");
    expect(result.migrationScore).toBe(100);
  });

  it("classifyComponent — client (heavy hook usage)", () => {
    const src = '"use client";\nimport { useState, useEffect } from "react";\nfunction X() { const [a,b] = useState(0); useEffect(() => {}, []); onClick={fn} }';
    const result = classifyComponent(src);
    expect(result.hasUseClient).toBe(true);
    expect(result.classification).toBe("client");
    expect(result.clientScore).toBeGreaterThan(15);
    expect(result.clientIndicators.length).toBeGreaterThan(0);
  });

  it("classifyComponent — review (low client usage)", () => {
    const src = '"use client";\nconst x = window.innerWidth;';
    const result = classifyComponent(src);
    expect(result.hasUseClient).toBe(true);
    expect(result.clientScore).toBeLessThanOrEqual(15);
    expect(result.classification).toBe("review");
  });

  it("calculateMigrationROI — sorts by score desc", () => {
    const roi = calculateMigrationROI([
      { path: "a.tsx", lines: 50, migrationScore: 80 },
      { path: "b.tsx", lines: 100, migrationScore: 100 },
    ]);
    expect(roi.candidateCount).toBe(2);
    expect(roi.priority[0].path).toBe("b.tsx");
    expect(roi.estimatedBundleReductionKB).toBeGreaterThan(0);
  });

  it("calculateMigrationROI — empty candidates", () => {
    const roi = calculateMigrationROI([]);
    expect(roi.candidateCount).toBe(0);
    expect(roi.totalLines).toBe(0);
  });

  it("createSCRatioSnapshot — correct percentages", () => {
    const snap = createSCRatioSnapshot(100, 70);
    expect(snap.serverComponents).toBe(30);
    expect(snap.serverPercent).toBe(30);
  });

  it("isSCRatioHealthy — healthy above target", () => {
    const snap = createSCRatioSnapshot(100, 50);
    const health = isSCRatioHealthy(snap);
    expect(health.healthy).toBe(true);
  });

  it("isSCRatioHealthy — warning between thresholds", () => {
    const snap = createSCRatioSnapshot(100, 70);
    const health = isSCRatioHealthy(snap);
    expect(health.healthy).toBe(false);
    expect(health.warning).toBe(true);
  });

  it("isSCRatioHealthy — critical below warning", () => {
    const snap = createSCRatioSnapshot(100, 80);
    const health = isSCRatioHealthy(snap);
    expect(health.healthy).toBe(false);
    expect(health.warning).toBe(false);
  });

  it("formatMigrationSummary — includes key info", () => {
    const roi = calculateMigrationROI([{ path: "x.tsx", lines: 50, migrationScore: 100 }]);
    const snap = createSCRatioSnapshot(100, 60);
    const summary = formatMigrationSummary(roi, snap);
    expect(summary).toContain("40%");
    expect(summary).toContain("x.tsx");
  });

  it("barrel exports accessible", async () => {
    const mod = await import("@/lib");
    expect(mod.classifyComponent).toBeDefined();
    expect(mod.SC_BUDGET).toBeDefined();
    expect(mod.calculateMigrationROI).toBeDefined();
  });
});

// ── Q-143: List Keyboard Navigation ─────────────────────────────────────

import {
  getNextIndex,
  findByTypeAhead,
  keyToDirection,
  isSelectionKey,
  isEscapeKey,
  getItemId,
  buildContainerProps,
  buildItemProps,
  LIST_ITEM_ID_PREFIX,
  TYPEAHEAD_RESET_MS,
} from "@/lib/useListKeyNav";

describe("Q-143: useListKeyNav", () => {
  it("getNextIndex — down wraps around", () => {
    expect(getNextIndex(4, "down", 5, true)).toBe(0);
    expect(getNextIndex(4, "down", 5, false)).toBe(4);
  });

  it("getNextIndex — up wraps around", () => {
    expect(getNextIndex(0, "up", 5, true)).toBe(4);
    expect(getNextIndex(0, "up", 5, false)).toBe(0);
  });

  it("getNextIndex — home and end", () => {
    expect(getNextIndex(3, "home", 10)).toBe(0);
    expect(getNextIndex(3, "end", 10)).toBe(9);
  });

  it("getNextIndex — empty list returns -1", () => {
    expect(getNextIndex(0, "down", 0)).toBe(-1);
  });

  it("getNextIndex — normal movement", () => {
    expect(getNextIndex(2, "down", 5)).toBe(3);
    expect(getNextIndex(2, "up", 5)).toBe(1);
  });

  it("findByTypeAhead — finds matching item", () => {
    const labels = ["Apple", "Banana", "Cherry", "Date"];
    expect(findByTypeAhead("c", labels, 0)).toBe(2);
  });

  it("findByTypeAhead — wraps from current", () => {
    const labels = ["Alpha", "Beta", "Alpha2"];
    expect(findByTypeAhead("a", labels, 0)).toBe(2); // skips index 0, finds 2
  });

  it("findByTypeAhead — no match returns -1", () => {
    expect(findByTypeAhead("z", ["Apple", "Banana"], 0)).toBe(-1);
  });

  it("findByTypeAhead — empty labels", () => {
    expect(findByTypeAhead("a", [], 0)).toBe(-1);
  });

  it("keyToDirection — vertical arrows", () => {
    expect(keyToDirection("ArrowUp", "vertical")).toBe("up");
    expect(keyToDirection("ArrowDown", "vertical")).toBe("down");
    expect(keyToDirection("ArrowLeft", "vertical")).toBeNull();
  });

  it("keyToDirection — horizontal arrows", () => {
    expect(keyToDirection("ArrowLeft", "horizontal")).toBe("up");
    expect(keyToDirection("ArrowRight", "horizontal")).toBe("down");
    expect(keyToDirection("ArrowUp", "horizontal")).toBeNull();
  });

  it("keyToDirection — Home/End work for both", () => {
    expect(keyToDirection("Home")).toBe("home");
    expect(keyToDirection("End")).toBe("end");
  });

  it("isSelectionKey — Enter and Space", () => {
    expect(isSelectionKey("Enter")).toBe(true);
    expect(isSelectionKey(" ")).toBe(true);
    expect(isSelectionKey("a")).toBe(false);
  });

  it("isEscapeKey", () => {
    expect(isEscapeKey("Escape")).toBe(true);
    expect(isEscapeKey("Enter")).toBe(false);
  });

  it("getItemId — generates correct ID", () => {
    expect(getItemId(3)).toBe(`${LIST_ITEM_ID_PREFIX}3`);
    expect(getItemId(0, "custom-")).toBe("custom-0");
  });

  it("buildContainerProps — correct structure", () => {
    const onKD = () => {};
    const props = buildContainerProps(2, onKD);
    expect(props.role).toBe("listbox");
    expect(props["aria-activedescendant"]).toBe(`${LIST_ITEM_ID_PREFIX}2`);
    expect(props.tabIndex).toBe(0);
  });

  it("buildContainerProps — no active item", () => {
    const props = buildContainerProps(-1, () => {});
    expect(props["aria-activedescendant"]).toBeUndefined();
  });

  it("buildItemProps — active item", () => {
    const props = buildItemProps(2, 2);
    expect(props.role).toBe("option");
    expect(props["aria-selected"]).toBe(true);
    expect(props.tabIndex).toBe(0);
  });

  it("buildItemProps — inactive item", () => {
    const props = buildItemProps(1, 2);
    expect(props["aria-selected"]).toBe(false);
    expect(props.tabIndex).toBe(-1);
  });

  it("TYPEAHEAD_RESET_MS is reasonable", () => {
    expect(TYPEAHEAD_RESET_MS).toBeGreaterThanOrEqual(300);
    expect(TYPEAHEAD_RESET_MS).toBeLessThanOrEqual(1000);
  });

  it("barrel exports accessible", async () => {
    const mod = await import("@/lib");
    expect(mod.getNextIndex).toBeDefined();
    expect(mod.buildContainerProps).toBeDefined();
    expect(mod.LIST_ITEM_ID_PREFIX).toBeDefined();
  });
});

// ── Q-144: CSP Builder ──────────────────────────────────────────────────

import {
  generateNonce,
  buildCSPHeader,
  isValidSRIFormat,
  parseCSPViolation,
  formatCSPSummary,
  uint8ToBase64url,
  CSP_DIRECTIVES,
  TRUSTED_SCRIPT_DOMAINS,
  SRI_ALGORITHMS,
  NONCE_BYTES,
} from "@/lib/cspBuilder";

describe("Q-144: cspBuilder", () => {
  it("NONCE_BYTES is 32", () => {
    expect(NONCE_BYTES).toBe(32);
  });

  it("CSP_DIRECTIVES covers essential directives", () => {
    expect(CSP_DIRECTIVES["default-src"]).toContain("'self'");
    expect(CSP_DIRECTIVES["frame-ancestors"]).toContain("'none'");
    expect(CSP_DIRECTIVES["object-src"]).toContain("'none'");
  });

  it("TRUSTED_SCRIPT_DOMAINS includes Stripe", () => {
    expect(TRUSTED_SCRIPT_DOMAINS).toContain("https://js.stripe.com");
  });

  it("SRI_ALGORITHMS includes sha384", () => {
    expect(SRI_ALGORITHMS).toContain("sha384");
  });

  it("generateNonce — produces unique values", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(10);
  });

  it("generateNonce — no padding characters", () => {
    const nonce = generateNonce();
    expect(nonce).not.toContain("=");
    expect(nonce).not.toContain("+");
    expect(nonce).not.toContain("/");
  });

  it("uint8ToBase64url — deterministic", () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const a = uint8ToBase64url(bytes);
    const b = uint8ToBase64url(bytes);
    expect(a).toBe(b);
  });

  it("buildCSPHeader — default (no nonce, enforced)", () => {
    const result = buildCSPHeader();
    expect(result.headerName).toBe("Content-Security-Policy");
    expect(result.headerValue).toContain("default-src 'self'");
    expect(result.headerValue).toContain("frame-ancestors 'none'");
    expect(result.nonce).toBeUndefined();
  });

  it("buildCSPHeader — report-only mode", () => {
    const result = buildCSPHeader({ reportOnly: true });
    expect(result.headerName).toBe("Content-Security-Policy-Report-Only");
  });

  it("buildCSPHeader — with nonce", () => {
    const result = buildCSPHeader({ nonce: "test123" });
    expect(result.headerValue).toContain("'nonce-test123'");
    expect(result.headerValue).toContain("'strict-dynamic'");
    expect(result.nonce).toBe("test123");
  });

  it("buildCSPHeader — with report URI", () => {
    const result = buildCSPHeader({ reportUri: "https://report.example.com" });
    expect(result.headerValue).toContain("report-uri https://report.example.com");
  });

  it("buildCSPHeader — extra directives merged", () => {
    const result = buildCSPHeader({
      extraDirectives: { "img-src": ["https://cdn.example.com"] },
    });
    expect(result.directives["img-src"]).toContain("https://cdn.example.com");
    expect(result.directives["img-src"]).toContain("'self'");
  });

  it("isValidSRIFormat — valid sha384", () => {
    expect(isValidSRIFormat("sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC")).toBe(true);
  });

  it("isValidSRIFormat — invalid", () => {
    expect(isValidSRIFormat("md5-abc123")).toBe(false);
    expect(isValidSRIFormat("")).toBe(false);
    expect(isValidSRIFormat("sha256-")).toBe(false);
  });

  it("parseCSPViolation — valid report", () => {
    const violation = parseCSPViolation({
      "csp-report": {
        "violated-directive": "script-src",
        "blocked-uri": "https://evil.com/script.js",
        "document-uri": "https://bjj-app.net/dashboard",
        "original-policy": "script-src 'self'",
      },
    });
    expect(violation).not.toBeNull();
    expect(violation!.violatedDirective).toBe("script-src");
    expect(violation!.blockedUri).toContain("evil.com");
  });

  it("parseCSPViolation — empty report returns null", () => {
    expect(parseCSPViolation({})).toBeNull();
  });

  it("formatCSPSummary — includes key info", () => {
    const result = buildCSPHeader({ reportOnly: true, nonce: "abc" });
    const summary = formatCSPSummary(result);
    expect(summary).toContain("report-only");
    expect(summary).toContain("with nonce");
  });

  it("formatCSPSummary — enforced no nonce", () => {
    const result = buildCSPHeader();
    const summary = formatCSPSummary(result);
    expect(summary).toContain("enforced");
    expect(summary).toContain("no nonce");
  });

  it("barrel exports accessible", async () => {
    const mod = await import("@/lib");
    expect(mod.generateNonce).toBeDefined();
    expect(mod.buildCSPHeader).toBeDefined();
    expect(mod.CSP_DIRECTIVES).toBeDefined();
  });
});

// ── Q-145: Synthetic Probe ──────────────────────────────────────────────

import {
  buildProbeReport,
  formatProbeSummary,
  shouldAlert,
  buildTelegramMessage,
  PROBE_CONFIG,
  DEFAULT_ALERT_CONFIG,
} from "@/lib/syntheticProbe";
import type { ProbeResult } from "@/lib/syntheticProbe";

describe("Q-145: syntheticProbe", () => {
  const now = new Date().toISOString();

  const healthyResults: ProbeResult[] = [
    { name: "Health", url: "/api/health", passed: true, statusCode: 200, responseTimeMs: 150, critical: true, timestamp: now },
    { name: "Landing", url: "/", passed: true, statusCode: 200, responseTimeMs: 300, critical: true, timestamp: now },
    { name: "Help", url: "/help", passed: true, statusCode: 200, responseTimeMs: 200, critical: false, timestamp: now },
  ];

  const degradedResults: ProbeResult[] = [
    { name: "Health", url: "/api/health", passed: true, statusCode: 200, responseTimeMs: 150, critical: true, timestamp: now },
    { name: "Help", url: "/help", passed: false, statusCode: 500, responseTimeMs: 100, critical: false, timestamp: now, error: "Expected 200, got 500" },
  ];

  const downResults: ProbeResult[] = [
    { name: "Health", url: "/api/health", passed: false, statusCode: 0, responseTimeMs: 10000, critical: true, timestamp: now, error: "Timeout" },
    { name: "Landing", url: "/", passed: false, statusCode: 503, responseTimeMs: 50, critical: true, timestamp: now, error: "Expected 200, got 503" },
  ];

  it("PROBE_CONFIG has endpoints", () => {
    expect(PROBE_CONFIG.endpoints.length).toBeGreaterThanOrEqual(5);
    expect(PROBE_CONFIG.endpoints[0].critical).toBe(true);
  });

  it("PROBE_CONFIG thresholds are ordered", () => {
    expect(PROBE_CONFIG.thresholds.fast).toBeLessThan(PROBE_CONFIG.thresholds.acceptable);
    expect(PROBE_CONFIG.thresholds.acceptable).toBeLessThan(PROBE_CONFIG.thresholds.slow);
  });

  it("DEFAULT_ALERT_CONFIG has sensible defaults", () => {
    expect(DEFAULT_ALERT_CONFIG.minConsecutiveFailures).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_ALERT_CONFIG.slowThresholdMs).toBeGreaterThan(0);
  });

  it("buildProbeReport — all healthy", () => {
    const report = buildProbeReport(healthyResults);
    expect(report.status).toBe("healthy");
    expect(report.passed).toBe(3);
    expect(report.failed).toBe(0);
    expect(report.failures).toHaveLength(0);
    expect(report.avgResponseTimeMs).toBeGreaterThan(0);
  });

  it("buildProbeReport — degraded (non-critical failure)", () => {
    const report = buildProbeReport(degradedResults);
    expect(report.status).toBe("degraded");
    expect(report.failed).toBe(1);
    expect(report.failures[0].name).toBe("Help");
  });

  it("buildProbeReport — down (critical failure)", () => {
    const report = buildProbeReport(downResults);
    expect(report.status).toBe("down");
    expect(report.failures.some((f) => f.critical)).toBe(true);
  });

  it("buildProbeReport — empty results", () => {
    const report = buildProbeReport([]);
    expect(report.status).toBe("healthy");
    expect(report.total).toBe(0);
    expect(report.avgResponseTimeMs).toBe(0);
  });

  it("buildProbeReport — slowest endpoint tracked", () => {
    const report = buildProbeReport(healthyResults);
    expect(report.slowest).not.toBeNull();
    expect(report.slowest!.name).toBe("Landing");
    expect(report.slowest!.responseTimeMs).toBe(300);
  });

  it("formatProbeSummary — healthy includes checkmark", () => {
    const summary = formatProbeSummary("healthy", 3, 3, 200, []);
    expect(summary).toContain("✅");
    expect(summary).toContain("3/3");
  });

  it("formatProbeSummary — down includes failures", () => {
    const summary = formatProbeSummary("down", 0, 2, 5000, [
      { name: "Health", error: "Timeout", critical: true },
    ]);
    expect(summary).toContain("🔴");
    expect(summary).toContain("Health");
  });

  it("shouldAlert — true for down", () => {
    const report = buildProbeReport(downResults);
    expect(shouldAlert(report)).toBe(true);
  });

  it("shouldAlert — true for degraded with config", () => {
    const report = buildProbeReport(degradedResults);
    expect(shouldAlert(report, { ...DEFAULT_ALERT_CONFIG, alertOnDegraded: true })).toBe(true);
  });

  it("shouldAlert — false for healthy", () => {
    const report = buildProbeReport(healthyResults);
    expect(shouldAlert(report)).toBe(false);
  });

  it("shouldAlert — true for slow average", () => {
    const slowResults: ProbeResult[] = [
      { name: "Health", url: "/api/health", passed: true, statusCode: 200, responseTimeMs: 6000, critical: true, timestamp: now },
    ];
    const report = buildProbeReport(slowResults);
    expect(shouldAlert(report, { ...DEFAULT_ALERT_CONFIG, slowThresholdMs: 5000 })).toBe(true);
  });

  it("buildTelegramMessage — includes status", () => {
    const report = buildProbeReport(downResults);
    const msg = buildTelegramMessage(report);
    expect(msg).toContain("🚨");
    expect(msg).toContain("down");
    expect(msg).toContain("Failures:");
  });

  it("buildTelegramMessage — healthy no failures section", () => {
    const report = buildProbeReport(healthyResults);
    const msg = buildTelegramMessage(report);
    expect(msg).toContain("✅");
    expect(msg).not.toContain("Failures:");
  });

  it("barrel exports accessible", async () => {
    const mod = await import("@/lib");
    expect(mod.buildProbeReport).toBeDefined();
    expect(mod.PROBE_CONFIG).toBeDefined();
    expect(mod.shouldAlert).toBeDefined();
  });
});
