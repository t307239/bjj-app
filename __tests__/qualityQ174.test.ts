/**
 * Tests for Q-174: permissionPolicy (Security 94→95)
 */
import { describe, it, expect } from "vitest";

describe("Q-174: permissionPolicy", () => {
  it("PERMISSION_DIRECTIVES defaults", async () => {
    const m = await import("@/lib/permissionPolicy");
    expect(m.PERMISSION_DIRECTIVES.camera).toBe("none");
    expect(m.PERMISSION_DIRECTIVES.microphone).toBe("none");
    expect(m.PERMISSION_DIRECTIVES.fullscreen).toBe("self");
    expect(m.PERMISSION_DIRECTIVES.geolocation).toBe("none");
    expect(m.PERMISSION_DIRECTIVES["browsing-topics"]).toBe("none");
  });

  it("SECURITY_HEADERS", async () => {
    const m = await import("@/lib/permissionPolicy");
    expect(m.SECURITY_HEADERS["Strict-Transport-Security"].required).toBe(true);
    expect(m.SECURITY_HEADERS["Strict-Transport-Security"].severity).toBe("critical");
    expect(m.SECURITY_HEADERS["X-Content-Type-Options"].recommended).toBe("nosniff");
  });

  it("buildPermissionsPolicy: defaults", async () => {
    const m = await import("@/lib/permissionPolicy");
    const policy = m.buildPermissionsPolicy();
    expect(policy).toContain("camera=()");
    expect(policy).toContain("fullscreen=(self)");
    expect(policy).toContain("geolocation=()");
  });

  it("buildPermissionsPolicy: with overrides", async () => {
    const m = await import("@/lib/permissionPolicy");
    const policy = m.buildPermissionsPolicy({
      overrides: { camera: "self" },
    });
    expect(policy).toContain("camera=(self)");
  });

  it("buildPermissionsPolicy: with allowOrigins", async () => {
    const m = await import("@/lib/permissionPolicy");
    const policy = m.buildPermissionsPolicy({
      allowOrigins: { camera: ["https://example.com"] },
    });
    expect(policy).toContain('camera=("https://example.com")');
  });

  it("parsePermissionsPolicy", async () => {
    const m = await import("@/lib/permissionPolicy");
    const parsed = m.parsePermissionsPolicy('camera=(), fullscreen=(self), geolocation=("https://example.com")');
    expect(parsed.camera).toEqual([]);
    expect(parsed.fullscreen).toEqual(["self"]);
    expect(parsed.geolocation).toEqual(["https://example.com"]);
  });

  it("auditPermissionsPolicy: third-party access warning", async () => {
    const m = await import("@/lib/permissionPolicy");
    const issues = m.auditPermissionsPolicy('camera=("https://evil.com"), microphone=()');
    expect(issues.some((i) => i.directive === "camera" && i.severity === "warning")).toBe(true);
  });

  it("auditPermissionsPolicy: missing directives", async () => {
    const m = await import("@/lib/permissionPolicy");
    const issues = m.auditPermissionsPolicy("camera=()");
    // Many directives will be "not specified"
    const missingInfos = issues.filter((i) => i.severity === "info" && i.message.includes("not specified"));
    expect(missingInfos.length).toBeGreaterThan(5);
  });

  it("auditSecurityHeaders: all present", async () => {
    const m = await import("@/lib/permissionPolicy");
    const headers: Record<string, string> = {
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
      "Content-Security-Policy": "default-src 'self'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "0",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
    };
    const result = m.auditSecurityHeaders(headers);
    expect(result.missing.length).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.grade).toBe("A+");
  });

  it("auditSecurityHeaders: missing critical", async () => {
    const m = await import("@/lib/permissionPolicy");
    const result = m.auditSecurityHeaders({});
    expect(result.missing.length).toBe(10);
    expect(result.score).toBeLessThan(50);
    expect(result.grade).toBe("F");
  });

  it("auditSecurityHeaders: misconfigured", async () => {
    const m = await import("@/lib/permissionPolicy");
    const result = m.auditSecurityHeaders({
      "X-Content-Type-Options": "wrong",
      "X-XSS-Protection": "1; mode=block",
    });
    expect(result.misconfigured.length).toBe(2);
  });

  it("formatHeaderAudit", async () => {
    const m = await import("@/lib/permissionPolicy");
    const result = m.auditSecurityHeaders({
      "Strict-Transport-Security": "max-age=63072000",
    });
    const formatted = m.formatHeaderAudit(result);
    expect(formatted).toContain("Security Header Audit");
    expect(formatted).toContain("Score:");
    expect(formatted).toContain("Grade:");
    expect(formatted).toContain("Missing Headers:");
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("buildPermissionsPolicy");
    expect(idx).toContain("auditSecurityHeaders");
    expect(idx).toContain("PERMISSION_DIRECTIVES");
  });
});
