/**
 * qualityQ138_141 — tests for Q-138 through Q-141 quality improvements
 *
 * Tests:
 * - Q-138: Consent manager (consentManager.ts)
 * - Q-139: Uptime monitor (uptimeMonitor.ts)
 * - Q-140: Data retention (dataRetention.ts)
 * - Q-141: Admin search (adminSearch.ts)
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.resolve(ROOT, "lib");

// ── Q-138: Consent Manager ──────────────────────────────────────────────
describe("Q-138: Legal — consentManager", () => {
  let createConsentRecord: typeof import("../lib/consentManager").createConsentRecord;
  let isConsentValid: typeof import("../lib/consentManager").isConsentValid;
  let findExpiredConsents: typeof import("../lib/consentManager").findExpiredConsents;
  let buildConsentSummary: typeof import("../lib/consentManager").buildConsentSummary;
  let formatConsentAuditEntry: typeof import("../lib/consentManager").formatConsentAuditEntry;
  let CONSENT_VERSIONS: typeof import("../lib/consentManager").CONSENT_VERSIONS;
  let REQUIRED_CONSENTS: typeof import("../lib/consentManager").REQUIRED_CONSENTS;

  beforeAll(async () => {
    const mod = await import("../lib/consentManager");
    createConsentRecord = mod.createConsentRecord;
    isConsentValid = mod.isConsentValid;
    findExpiredConsents = mod.findExpiredConsents;
    buildConsentSummary = mod.buildConsentSummary;
    formatConsentAuditEntry = mod.formatConsentAuditEntry;
    CONSENT_VERSIONS = mod.CONSENT_VERSIONS;
    REQUIRED_CONSENTS = mod.REQUIRED_CONSENTS;
  });

  it("CONSENT_VERSIONS has all consent types", () => {
    expect(CONSENT_VERSIONS).toHaveProperty("privacy_policy");
    expect(CONSENT_VERSIONS).toHaveProperty("cookie_analytics");
    expect(CONSENT_VERSIONS).toHaveProperty("data_processing");
  });

  it("REQUIRED_CONSENTS includes privacy_policy", () => {
    expect(REQUIRED_CONSENTS).toContain("privacy_policy");
    expect(REQUIRED_CONSENTS).toContain("data_processing");
  });

  it("createConsentRecord creates valid record", () => {
    const record = createConsentRecord("user-1", "privacy_policy", true, "signup");
    expect(record.userId).toBe("user-1");
    expect(record.type).toBe("privacy_policy");
    expect(record.granted).toBe(true);
    expect(record.policyVersion).toBe(CONSENT_VERSIONS.privacy_policy);
    expect(record.method).toBe("signup");
    expect(record.timestamp).toBeTruthy();
  });

  it("isConsentValid returns true for fresh consent", () => {
    const record = createConsentRecord("user-1", "privacy_policy", true);
    expect(isConsentValid(record)).toBe(true);
  });

  it("isConsentValid returns false for withdrawn consent", () => {
    const record = createConsentRecord("user-1", "privacy_policy", false);
    expect(isConsentValid(record)).toBe(false);
  });

  it("isConsentValid returns false for outdated version", () => {
    const record = createConsentRecord("user-1", "privacy_policy", true);
    record.policyVersion = "0.1";
    expect(isConsentValid(record)).toBe(false);
  });

  it("isConsentValid returns false for expired consent", () => {
    const record = createConsentRecord("user-1", "cookie_analytics", true);
    // Set timestamp to 200 days ago (analytics max is 180)
    const past = new Date();
    past.setDate(past.getDate() - 200);
    record.timestamp = past.toISOString();
    expect(isConsentValid(record)).toBe(false);
  });

  it("findExpiredConsents finds outdated records", () => {
    const old = createConsentRecord("user-1", "cookie_analytics", true);
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 200);
    old.timestamp = pastDate.toISOString();

    const fresh = createConsentRecord("user-1", "privacy_policy", true);
    const expired = findExpiredConsents([old, fresh]);
    expect(expired.length).toBe(1);
    expect(expired[0].type).toBe("cookie_analytics");
  });

  it("buildConsentSummary uses latest record per type", () => {
    const old = createConsentRecord("user-1", "privacy_policy", false);
    old.timestamp = "2024-01-01T00:00:00Z";
    const newer = createConsentRecord("user-1", "privacy_policy", true);
    newer.timestamp = "2025-01-01T00:00:00Z";

    const summary = buildConsentSummary("user-1", [old, newer]);
    expect(summary.consents.privacy_policy.granted).toBe(true);
  });

  it("buildConsentSummary checks allRequired", () => {
    const records = REQUIRED_CONSENTS.map((type) =>
      createConsentRecord("user-1", type, true),
    );
    const summary = buildConsentSummary("user-1", records);
    expect(summary.allRequired).toBe(true);
  });

  it("formatConsentAuditEntry contains action and type", () => {
    const record = createConsentRecord("user-1", "privacy_policy", true, "banner");
    const entry = formatConsentAuditEntry(record);
    expect(entry).toContain("GRANTED");
    expect(entry).toContain("privacy_policy");
    expect(entry).toContain("banner");
  });

  it("barrel export includes consentManager", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("createConsentRecord");
    expect(barrel).toContain("isConsentValid");
    expect(barrel).toContain("CONSENT_VERSIONS");
    expect(barrel).toContain("ConsentRecord");
  });
});

// ── Q-139: Uptime Monitor ───────────────────────────────────────────────
describe("Q-139: Obs — uptimeMonitor", () => {
  let classifyStatus: typeof import("../lib/uptimeMonitor").classifyStatus;
  let createHealthCheck: typeof import("../lib/uptimeMonitor").createHealthCheck;
  let calculateUptime: typeof import("../lib/uptimeMonitor").calculateUptime;
  let determineOverallStatus: typeof import("../lib/uptimeMonitor").determineOverallStatus;
  let formatUptimePercent: typeof import("../lib/uptimeMonitor").formatUptimePercent;
  let MONITOR_ENDPOINTS: typeof import("../lib/uptimeMonitor").MONITOR_ENDPOINTS;

  beforeAll(async () => {
    const mod = await import("../lib/uptimeMonitor");
    classifyStatus = mod.classifyStatus;
    createHealthCheck = mod.createHealthCheck;
    calculateUptime = mod.calculateUptime;
    determineOverallStatus = mod.determineOverallStatus;
    formatUptimePercent = mod.formatUptimePercent;
    MONITOR_ENDPOINTS = mod.MONITOR_ENDPOINTS;
  });

  it("MONITOR_ENDPOINTS has critical endpoints", () => {
    const critical = MONITOR_ENDPOINTS.filter((e) => e.critical);
    expect(critical.length).toBeGreaterThanOrEqual(2);
    expect(MONITOR_ENDPOINTS.some((e) => e.path === "/api/health")).toBe(true);
  });

  it("classifyStatus returns operational for 200 fast", () => {
    expect(classifyStatus(200, 100)).toBe("operational");
  });

  it("classifyStatus returns degraded for slow response", () => {
    expect(classifyStatus(200, 6000)).toBe("degraded");
  });

  it("classifyStatus returns major_outage for 500", () => {
    expect(classifyStatus(500, 100)).toBe("major_outage");
  });

  it("classifyStatus returns partial_outage for 404", () => {
    expect(classifyStatus(404, 100)).toBe("partial_outage");
  });

  it("createHealthCheck marks 200 as healthy", () => {
    const check = createHealthCheck("/api/health", 200, 150);
    expect(check.healthy).toBe(true);
    expect(check.statusCode).toBe(200);
  });

  it("createHealthCheck marks 500 as unhealthy", () => {
    const check = createHealthCheck("/api/health", 500, 100, "Internal error");
    expect(check.healthy).toBe(false);
    expect(check.error).toBe("Internal error");
  });

  it("calculateUptime returns 100% for all healthy", () => {
    const checks = Array.from({ length: 10 }, () =>
      createHealthCheck("/api/health", 200, 100),
    );
    const report = calculateUptime("API", checks);
    expect(report.uptimePercent).toBe(100);
    expect(report.incidents).toBe(0);
  });

  it("calculateUptime calculates correct percentage", () => {
    const checks = [
      ...Array.from({ length: 9 }, () => createHealthCheck("/", 200, 100)),
      createHealthCheck("/", 500, 0, "error"),
    ];
    const report = calculateUptime("Web", checks);
    expect(report.uptimePercent).toBe(90);
    expect(report.incidents).toBe(1);
  });

  it("calculateUptime handles empty checks", () => {
    const report = calculateUptime("API", []);
    expect(report.uptimePercent).toBe(100);
    expect(report.totalChecks).toBe(0);
  });

  it("determineOverallStatus picks worst status", () => {
    expect(determineOverallStatus(["operational", "degraded"])).toBe("degraded");
    expect(determineOverallStatus(["operational", "major_outage"])).toBe("major_outage");
    expect(determineOverallStatus(["operational", "operational"])).toBe("operational");
  });

  it("formatUptimePercent shows appropriate decimals", () => {
    expect(formatUptimePercent(99.95)).toBe("99.95%");
    expect(formatUptimePercent(99.5)).toBe("99.5%");
    expect(formatUptimePercent(95)).toBe("95%");
  });

  it("barrel export includes uptimeMonitor", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("classifyStatus");
    expect(barrel).toContain("calculateUptime");
    expect(barrel).toContain("MONITOR_ENDPOINTS");
    expect(barrel).toContain("UptimeReport");
  });
});

// ── Q-140: Data Retention ───────────────────────────────────────────────
describe("Q-140: Data — dataRetention", () => {
  let RETENTION_POLICIES: typeof import("../lib/dataRetention").RETENTION_POLICIES;
  let findPurgeCandidates: typeof import("../lib/dataRetention").findPurgeCandidates;
  let isWithinRetention: typeof import("../lib/dataRetention").isWithinRetention;
  let generateRetentionReport: typeof import("../lib/dataRetention").generateRetentionReport;
  let getUserDeletableCategories: typeof import("../lib/dataRetention").getUserDeletableCategories;

  beforeAll(async () => {
    const mod = await import("../lib/dataRetention");
    RETENTION_POLICIES = mod.RETENTION_POLICIES;
    findPurgeCandidates = mod.findPurgeCandidates;
    isWithinRetention = mod.isWithinRetention;
    generateRetentionReport = mod.generateRetentionReport;
    getUserDeletableCategories = mod.getUserDeletableCategories;
  });

  it("RETENTION_POLICIES covers all categories", () => {
    expect(RETENTION_POLICIES).toHaveProperty("training_logs");
    expect(RETENTION_POLICIES).toHaveProperty("payment_records");
    expect(RETENTION_POLICIES).toHaveProperty("push_tokens");
    expect(RETENTION_POLICIES).toHaveProperty("analytics_events");
    expect(RETENTION_POLICIES).toHaveProperty("deleted_accounts");
  });

  it("training_logs has indefinite retention", () => {
    expect(RETENTION_POLICIES.training_logs.retentionDays).toBe(-1);
  });

  it("payment_records has ~7 year retention", () => {
    expect(RETENTION_POLICIES.payment_records.retentionDays).toBeGreaterThanOrEqual(2555);
    expect(RETENTION_POLICIES.payment_records.anonymize).toBe(true);
  });

  it("findPurgeCandidates returns empty for indefinite retention", () => {
    const records = [{ id: "1", date: "2020-01-01T00:00:00Z" }];
    const candidates = findPurgeCandidates("training_logs", records);
    expect(candidates.length).toBe(0);
  });

  it("findPurgeCandidates finds expired push tokens", () => {
    const old = new Date();
    old.setDate(old.getDate() - 120); // 120 days ago, threshold is 90
    const records = [{ id: "token-1", date: old.toISOString() }];
    const candidates = findPurgeCandidates("push_tokens", records);
    expect(candidates.length).toBe(1);
    expect(candidates[0].action).toBe("delete");
    expect(candidates[0].daysOverdue).toBeGreaterThan(0);
  });

  it("findPurgeCandidates sorts by overdue descending", () => {
    const now = new Date();
    const d1 = new Date(now);
    d1.setDate(d1.getDate() - 200);
    const d2 = new Date(now);
    d2.setDate(d2.getDate() - 150);
    const records = [
      { id: "1", date: d2.toISOString() },
      { id: "2", date: d1.toISOString() },
    ];
    const candidates = findPurgeCandidates("push_tokens", records, now);
    expect(candidates[0].id).toBe("2"); // more overdue
  });

  it("isWithinRetention returns true for recent data", () => {
    expect(isWithinRetention("push_tokens", new Date().toISOString())).toBe(true);
  });

  it("isWithinRetention returns true for indefinite categories", () => {
    expect(isWithinRetention("training_logs", "2020-01-01T00:00:00Z")).toBe(true);
  });

  it("generateRetentionReport calculates compliance", () => {
    const now = new Date();
    const fresh = now.toISOString();
    const old = new Date(now);
    old.setDate(old.getDate() - 400);
    const report = generateRetentionReport({
      training_logs: [{ id: "1", date: fresh }],
      profile: [{ id: "2", date: fresh }],
      payment_records: [{ id: "3", date: fresh }],
      push_tokens: [{ id: "4", date: old.toISOString() }],
      analytics_events: [{ id: "5", date: old.toISOString() }],
      session_data: [{ id: "6", date: old.toISOString() }],
      audit_logs: [{ id: "7", date: fresh }],
      deleted_accounts: [{ id: "8", date: old.toISOString() }],
    }, now);
    expect(report.totalRecords).toBe(8);
    expect(report.overdue).toBeGreaterThan(0);
    expect(report.compliancePercent).toBeLessThan(100);
  });

  it("getUserDeletableCategories includes training_logs", () => {
    const deletable = getUserDeletableCategories();
    expect(deletable).toContain("training_logs");
    expect(deletable).toContain("profile");
    expect(deletable).not.toContain("payment_records");
  });

  it("barrel export includes dataRetention", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("findPurgeCandidates");
    expect(barrel).toContain("RETENTION_POLICIES");
    expect(barrel).toContain("RetentionReport");
  });
});

// ── Q-141: Admin Search ─────────────────────────────────────────────────
describe("Q-141: Ops — adminSearch", () => {
  let maskEmail: typeof import("../lib/adminSearch").maskEmail;
  let maskEmailPartial: typeof import("../lib/adminSearch").maskEmailPartial;
  let buildUserSearchQuery: typeof import("../lib/adminSearch").buildUserSearchQuery;
  let paginateResults: typeof import("../lib/adminSearch").paginateResults;
  let supabaseRange: typeof import("../lib/adminSearch").supabaseRange;
  let formatAdminSummary: typeof import("../lib/adminSearch").formatAdminSummary;
  let MAX_PER_PAGE: typeof import("../lib/adminSearch").MAX_PER_PAGE;

  beforeAll(async () => {
    const mod = await import("../lib/adminSearch");
    maskEmail = mod.maskEmail;
    maskEmailPartial = mod.maskEmailPartial;
    buildUserSearchQuery = mod.buildUserSearchQuery;
    paginateResults = mod.paginateResults;
    supabaseRange = mod.supabaseRange;
    formatAdminSummary = mod.formatAdminSummary;
    MAX_PER_PAGE = mod.MAX_PER_PAGE;
  });

  it("maskEmail hides local part", () => {
    expect(maskEmail("toshiki@gmail.com")).toBe("to***@gmail.com");
  });

  it("maskEmail handles short emails", () => {
    expect(maskEmail("a@b.com")).toBe("a***@b.com");
  });

  it("maskEmailPartial shows more context", () => {
    const masked = maskEmailPartial("toshiki@gmail.com");
    expect(masked).toContain("@gmail.com");
    expect(masked).toContain("***");
    expect(masked.length).toBeLessThanOrEqual("toshiki@gmail.com".length);
  });

  it("buildUserSearchQuery creates conditions from text", () => {
    const query = buildUserSearchQuery("toshi");
    expect(query.conditions.length).toBeGreaterThan(0);
    expect(query.params[0]).toBe("toshi");
  });

  it("buildUserSearchQuery adds filter conditions", () => {
    const query = buildUserSearchQuery("", { belt: "purple", isPro: true });
    expect(query.conditions.length).toBe(2);
  });

  it("paginateResults returns correct page", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const result = paginateResults(items, { page: 2, perPage: 10 });
    expect(result.items.length).toBe(10);
    expect(result.items[0]).toBe(10);
    expect(result.totalPages).toBe(5);
    expect(result.hasMore).toBe(true);
  });

  it("paginateResults handles last page", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const result = paginateResults(items, { page: 3, perPage: 10 });
    expect(result.items.length).toBe(5);
    expect(result.hasMore).toBe(false);
  });

  it("paginateResults clamps perPage to MAX_PER_PAGE", () => {
    const items = Array.from({ length: 200 }, (_, i) => i);
    const result = paginateResults(items, { page: 1, perPage: 999 });
    expect(result.perPage).toBe(MAX_PER_PAGE);
  });

  it("supabaseRange returns correct from/to", () => {
    const [from, to] = supabaseRange(1, 25);
    expect(from).toBe(0);
    expect(to).toBe(24);
    const [from2, to2] = supabaseRange(3, 10);
    expect(from2).toBe(20);
    expect(to2).toBe(29);
  });

  it("formatAdminSummary includes all stats", () => {
    const summary = formatAdminSummary({
      totalUsers: 100,
      proUsers: 15,
      activeToday: 20,
      newSignups7d: 5,
    });
    expect(summary).toContain("100");
    expect(summary).toContain("15 Pro");
    expect(summary).toContain("15%");
    expect(summary).toContain("Active today: 20");
  });

  it("barrel export includes adminSearch", () => {
    const barrel = fs.readFileSync(path.join(LIB_DIR, "index.ts"), "utf-8");
    expect(barrel).toContain("maskEmail");
    expect(barrel).toContain("paginateResults");
    expect(barrel).toContain("buildUserSearchQuery");
    expect(barrel).toContain("PaginatedResult");
  });
});
