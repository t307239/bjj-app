/**
 * Tests for Q-187 through Q-195 — 95→97 quality push (9 modules)
 *
 * webVitalsAnalyzer, ariaLiveAnnouncer, sessionManager,
 * rumCollector, deprecationTracker, supportTicketRouter,
 * animationOrchestrator, userJourneyTracker, notificationOptimizer
 */
import { describe, it, expect } from "vitest";
import fs from "fs";

// ── Q-187: webVitalsAnalyzer ────────────────────────────────────────────────

describe("webVitalsAnalyzer", () => {
  const mod = () => import("@/lib/webVitalsAnalyzer");

  it("rates good LCP", async () => {
    const { rateMetric } = await mod();
    expect(rateMetric("LCP", 2000)).toBe("good");
  });

  it("rates poor LCP", async () => {
    const { rateMetric } = await mod();
    expect(rateMetric("LCP", 5000)).toBe("poor");
  });

  it("rates needs-improvement CLS", async () => {
    const { rateMetric } = await mod();
    expect(rateMetric("CLS", 0.15)).toBe("needs-improvement");
  });

  it("calculates percentile", async () => {
    const { percentile } = await mod();
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(percentile([], 50)).toBe(0);
  });

  it("builds metric distribution", async () => {
    const { buildMetricDistribution } = await mod();
    const entries = [
      { name: "LCP" as const, value: 1000, rating: "good" as const, url: "https://a.com/", timestamp: 1 },
      { name: "LCP" as const, value: 2000, rating: "good" as const, url: "https://a.com/", timestamp: 2 },
      { name: "LCP" as const, value: 3000, rating: "needs-improvement" as const, url: "https://a.com/", timestamp: 3 },
    ];
    const dist = buildMetricDistribution("LCP", entries);
    expect(dist.count).toBe(3);
    expect(dist.mean).toBeCloseTo(2000, 0);
    expect(dist.goodPercent).toBeGreaterThan(0);
  });

  it("detects regressions", async () => {
    const { detectRegressions } = await mod();
    const before = Array.from({ length: 10 }, (_, i) => ({
      name: "LCP" as const, value: 1000, rating: "good" as const,
      url: "https://a.com/", timestamp: i,
    }));
    const after = Array.from({ length: 10 }, (_, i) => ({
      name: "LCP" as const, value: 2000, rating: "good" as const,
      url: "https://a.com/", timestamp: i + 100,
    }));
    const regressions = detectRegressions(before, after);
    expect(regressions.length).toBeGreaterThan(0);
    expect(regressions[0].metric).toBe("LCP");
  });

  it("builds RUM report", async () => {
    const { buildRUMReport } = await mod();
    const entries = [
      { name: "LCP" as const, value: 1500, rating: "good" as const, url: "https://a.com/", timestamp: 1 },
      { name: "CLS" as const, value: 0.05, rating: "good" as const, url: "https://a.com/", timestamp: 2 },
      { name: "INP" as const, value: 100, rating: "good" as const, url: "https://a.com/", timestamp: 3 },
    ];
    const report = buildRUMReport(entries);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.grade).toBeDefined();
    expect(report.totalEntries).toBe(3);
  });

  it("groups by page", async () => {
    const { groupByPage } = await mod();
    const entries = [
      { name: "LCP" as const, value: 1000, rating: "good" as const, url: "https://a.com/dashboard", timestamp: 1 },
      { name: "LCP" as const, value: 2000, rating: "good" as const, url: "https://a.com/records", timestamp: 2 },
    ];
    const groups = groupByPage(entries);
    expect(Object.keys(groups)).toContain("/dashboard");
    expect(Object.keys(groups)).toContain("/records");
  });
});

// ── Q-188: ariaLiveAnnouncer ────────────────────────────────────────────────

describe("ariaLiveAnnouncer", () => {
  const mod = () => import("@/lib/ariaLiveAnnouncer");

  it("creates announcer state", async () => {
    const { createAnnouncerState } = await mod();
    const state = createAnnouncerState();
    expect(state.queue).toHaveLength(0);
    expect(state.config.maxQueueSize).toBe(10);
  });

  it("adds announcement to queue", async () => {
    const { createAnnouncerState, announce } = await mod();
    const state = createAnnouncerState();
    const updated = announce(state, "Test message", { timestamp: 1000 });
    expect(updated.queue).toHaveLength(1);
    expect(updated.queue[0].message).toBe("Test message");
  });

  it("deduplicates within window", async () => {
    const { createAnnouncerState, announce } = await mod();
    let state = createAnnouncerState();
    state = announce(state, "Same message", { timestamp: 1000 });
    state = announce(state, "Same message", { timestamp: 1500 });
    expect(state.queue).toHaveLength(1);
  });

  it("clears expired announcements", async () => {
    const { createAnnouncerState, announce, clearExpired } = await mod();
    let state = createAnnouncerState();
    state = announce(state, "Test", { timestamp: 1000, clearAfterMs: 2000 });
    const cleared = clearExpired(state, 4000);
    expect(cleared.queue).toHaveLength(0);
  });

  it("gets current announcement with assertive priority", async () => {
    const { createAnnouncerState, announce, getCurrentAnnouncement } = await mod();
    let state = createAnnouncerState();
    state = announce(state, "Polite msg", { timestamp: 1000 });
    state = announce(state, "Urgent!", { timestamp: 2000, politeness: "assertive" });
    const current = getCurrentAnnouncement(state);
    expect(current?.message).toBe("Urgent!");
  });

  it("builds live region props", async () => {
    const { buildLiveRegionProps } = await mod();
    const props = buildLiveRegionProps("assertive");
    expect(props.role).toBe("alert");
    expect(props["aria-live"]).toBe("assertive");
  });

  it("checks keyboard trap", async () => {
    const { checkKeyboardTrap } = await mod();
    const result = checkKeyboardTrap("modal-1", 3, true, true);
    expect(result.severity).toBe("pass");
    const trap = checkKeyboardTrap("modal-2", 3, false, true);
    expect(trap.severity).toBe("fail");
  });

  it("gets motion config", async () => {
    const { getMotionConfig } = await mod();
    const reduced = getMotionConfig(true);
    expect(reduced.useAnimations).toBe(false);
    const full = getMotionConfig(false);
    expect(full.useAnimations).toBe(true);
  });

  it("validates role attributes", async () => {
    const { validateRoleAttributes } = await mod();
    const issues = validateRoleAttributes("dialog", []);
    expect(issues.length).toBeGreaterThan(0);
    const ok = validateRoleAttributes("dialog", ["aria-label", "aria-modal"]);
    expect(ok).toHaveLength(0);
  });

  it("runs a11y audit", async () => {
    const { runA11yAudit } = await mod();
    const result = runA11yAudit([
      { tag: "button", attributes: [], textContent: "" },
      { tag: "img", attributes: [] },
    ]);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });
});

// ── Q-189: sessionManager ───────────────────────────────────────────────────

describe("sessionManager", () => {
  const mod = () => import("@/lib/sessionManager");

  it("generates deterministic fingerprint", async () => {
    const { generateFingerprint } = await mod();
    const fp1 = generateFingerprint({ userAgent: "Chrome", language: "ja", timezone: "Asia/Tokyo", screenResolution: "1920x1080", platform: "MacIntel" });
    const fp2 = generateFingerprint({ userAgent: "Chrome", language: "ja", timezone: "Asia/Tokyo", screenResolution: "1920x1080", platform: "MacIntel" });
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^fp_/);
  });

  it("validates active session", async () => {
    const { validateSession, DEFAULT_SESSION_POLICY } = await mod();
    const now = Date.now();
    const session = {
      id: "s1", userId: "u1", createdAt: now - 60000, lastActivityAt: now - 10000,
      expiresAt: now + 3600000, fingerprint: "fp_abc", ipAddress: "1.2.3.4",
      userAgent: "Chrome", isActive: true,
    };
    const result = validateSession(session, DEFAULT_SESSION_POLICY, now);
    expect(result.isValid).toBe(true);
  });

  it("detects idle timeout", async () => {
    const { validateSession, DEFAULT_SESSION_POLICY } = await mod();
    const now = Date.now();
    const session = {
      id: "s1", userId: "u1", createdAt: now - 7200000, lastActivityAt: now - 3600000,
      expiresAt: now + 3600000, fingerprint: "fp_abc", ipAddress: "1.2.3.4",
      userAgent: "Chrome", isActive: true,
    };
    const result = validateSession(session, DEFAULT_SESSION_POLICY, now);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("Idle timeout");
  });

  it("detects fingerprint mismatch", async () => {
    const { validateSession, DEFAULT_SESSION_POLICY } = await mod();
    const now = Date.now();
    const session = {
      id: "s1", userId: "u1", createdAt: now - 60000, lastActivityAt: now - 10000,
      expiresAt: now + 3600000, fingerprint: "fp_abc", ipAddress: "1.2.3.4",
      userAgent: "Chrome", isActive: true,
    };
    const result = validateSession(session, DEFAULT_SESSION_POLICY, now, "fp_different");
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("fingerprint");
  });

  it("checks concurrent sessions", async () => {
    const { checkConcurrentSessions, DEFAULT_SESSION_POLICY } = await mod();
    const now = Date.now();
    const sessions = Array.from({ length: 7 }, (_, i) => ({
      id: `s${i}`, userId: "u1", createdAt: now - 1000, lastActivityAt: now - 100,
      expiresAt: now + 3600000, fingerprint: "fp", ipAddress: "1.2.3.4",
      userAgent: "Chrome", isActive: true,
    }));
    const result = checkConcurrentSessions(sessions, DEFAULT_SESSION_POLICY, now);
    expect(result.exceedsLimit).toBe(true);
    expect(result.sessionsToTerminate.length).toBe(2);
  });

  it("checks account lock", async () => {
    const { checkAccountLock, DEFAULT_SESSION_POLICY } = await mod();
    const now = Date.now();
    const attempts = Array.from({ length: 6 }, (_, i) => ({
      timestamp: now - (i + 1) * 60000, success: false,
      ipAddress: "1.2.3.4", userAgent: "Chrome",
    }));
    const result = checkAccountLock(attempts, DEFAULT_SESSION_POLICY, now);
    expect(result.isLocked).toBe(true);
  });
});

// ── Q-190: rumCollector ─────────────────────────────────────────────────────

describe("rumCollector", () => {
  const mod = () => import("@/lib/rumCollector");

  it("classifies device types", async () => {
    const { classifyDevice } = await mod();
    expect(classifyDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)")).toBe("mobile");
    expect(classifyDevice("Mozilla/5.0 (iPad; CPU OS 16_0)")).toBe("tablet");
    expect(classifyDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)")).toBe("desktop");
  });

  it("extracts URL path", async () => {
    const { extractPath } = await mod();
    expect(extractPath("https://bjj-app.net/dashboard?q=1")).toBe("/dashboard");
    expect(extractPath("invalid")).toBe("invalid");
  });

  it("builds page metrics", async () => {
    const { buildPageMetrics } = await mod();
    const entries = [
      { url: "https://a.com/dash", metric: "LCP", value: 1000, timestamp: 1, deviceType: "desktop" as const, connectionType: "4g" as const },
      { url: "https://a.com/dash", metric: "LCP", value: 2000, timestamp: 2, deviceType: "mobile" as const, connectionType: "4g" as const },
    ];
    const metrics = buildPageMetrics("/dash", entries);
    expect(metrics.sampleCount).toBe(2);
    expect(metrics.metrics["LCP"].count).toBe(2);
  });

  it("checks budget violations", async () => {
    const { buildPageMetrics, checkBudgetViolations } = await mod();
    const entries = Array.from({ length: 10 }, (_, i) => ({
      url: "https://a.com/dashboard", metric: "LCP", value: 5000,
      timestamp: i, deviceType: "desktop" as const, connectionType: "4g" as const,
    }));
    const pm = buildPageMetrics("/dashboard", entries);
    const violations = checkBudgetViolations(pm, [{ path: "/dashboard", metric: "LCP", maxP75: 2500 }]);
    expect(violations.length).toBe(1);
    expect(violations[0].overagePercent).toBeGreaterThan(0);
  });

  it("builds RUM dashboard", async () => {
    const { buildRUMDashboard } = await mod();
    const dashboard = buildRUMDashboard([]);
    expect(dashboard.overallHealth).toBe("healthy");
    expect(dashboard.totalEntries).toBe(0);
  });
});

// ── Q-191: deprecationTracker ───────────────────────────────────────────────

describe("deprecationTracker", () => {
  const mod = () => import("@/lib/deprecationTracker");

  it("compares semver", async () => {
    const { compareSemver } = await mod();
    expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
    expect(compareSemver("2.0.0", "1.0.0")).toBe(1);
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
  });

  it("classifies severity", async () => {
    const { classifySeverity } = await mod();
    expect(classifySeverity("1.0.0", "3.0.0")).toBe("info");
    expect(classifySeverity("2.5.0", "3.0.0")).toBe("info"); // same major but minor diff > 1
    expect(classifySeverity("3.0.0", "2.0.0")).toBe("urgent");
  });

  it("estimates effort", async () => {
    const { estimateEffort } = await mod();
    expect(estimateEffort({ usageCount: 1 } as any)).toBe("trivial");
    expect(estimateEffort({ usageCount: 3 } as any)).toBe("small");
    expect(estimateEffort({ usageCount: 20 } as any)).toBe("large");
  });

  it("builds deprecation report", async () => {
    const { buildDeprecationReport } = await mod();
    const items = [
      { name: "oldFn", type: "function" as const, location: "lib/old.ts", deprecatedSince: "1.0.0", removalTarget: "2.0.0", replacement: "newFn", usageCount: 3, severity: "info" as const },
    ];
    const report = buildDeprecationReport(items, "1.5.0");
    expect(report.items).toHaveLength(1);
    expect(report.healthScore).toBeLessThanOrEqual(100);
  });

  it("builds sunset timeline", async () => {
    const { buildSunsetTimeline } = await mod();
    const items = [
      { name: "fn1", type: "function" as const, location: "a.ts", deprecatedSince: "1.0.0", removalTarget: "2.0.0", usageCount: 1, severity: "info" as const },
      { name: "fn2", type: "function" as const, location: "b.ts", deprecatedSince: "1.0.0", removalTarget: "3.0.0", usageCount: 1, severity: "info" as const },
    ];
    const timeline = buildSunsetTimeline(items, "1.5.0");
    expect(timeline).toHaveLength(2);
  });
});

// ── Q-192: supportTicketRouter ──────────────────────────────────────────────

describe("supportTicketRouter", () => {
  const mod = () => import("@/lib/supportTicketRouter");

  it("classifies billing ticket", async () => {
    const { classifyCategory } = await mod();
    const result = classifyCategory("返金してほしい", "先月の請求がおかしい");
    expect(result.category).toBe("billing");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("classifies bug ticket", async () => {
    const { classifyCategory } = await mod();
    const result = classifyCategory("Bug report", "The page shows an error");
    expect(result.category).toBe("bug");
  });

  it("classifies privacy ticket", async () => {
    const { classifyCategory } = await mod();
    const result = classifyCategory("GDPR data protection", "I want my personal data deleted under privacy rights");
    expect(result.category).toBe("privacy");
  });

  it("determines priority for Pro users", async () => {
    const { determinePriority } = await mod();
    expect(determinePriority("billing", true)).toBe("p1_critical");
    expect(determinePriority("billing", false)).toBe("p2_high");
    expect(determinePriority("privacy", false)).toBe("p1_critical");
  });

  it("finds response template", async () => {
    const { findResponseTemplate } = await mod();
    const template = findResponseTemplate("billing", "解約したい", "ja");
    expect(template).not.toBeNull();
    expect(template?.id).toBe("billing_cancel");
  });

  it("classifies full ticket", async () => {
    const { classifyTicket } = await mod();
    const ticket = {
      id: "t1", subject: "パスワードを忘れた", body: "ログインできません",
      userEmail: "test@example.com", isPro: false, createdAt: Date.now(), language: "ja",
    };
    const classified = classifyTicket(ticket);
    expect(classified.category).toBe("account");
    expect(classified.suggestedResponse).toBeTruthy();
    expect(classified.autoResolvable).toBe(true);
  });

  it("builds ticket metrics", async () => {
    const { classifyTicket, buildTicketMetrics } = await mod();
    const tickets = [
      { id: "1", subject: "返金", body: "refund please", userEmail: "a@a.com", isPro: false, createdAt: 1, language: "ja" },
      { id: "2", subject: "Bug", body: "error on page", userEmail: "b@b.com", isPro: true, createdAt: 2, language: "en" },
    ].map(classifyTicket);
    const metrics = buildTicketMetrics(tickets);
    expect(metrics.totalTickets).toBe(2);
    expect(metrics.avgConfidence).toBeGreaterThan(0);
  });
});

// ── Q-193: animationOrchestrator ────────────────────────────────────────────

describe("animationOrchestrator", () => {
  const mod = () => import("@/lib/animationOrchestrator");

  it("applies reduced motion", async () => {
    const { applyReducedMotion, PRESETS } = await mod();
    const reduced = applyReducedMotion(PRESETS.fadeIn);
    expect(reduced.duration).toBe(1);
    expect(reduced.delay).toBe(0);
  });

  it("calculates stagger delays", async () => {
    const { calculateStaggerDelays } = await mod();
    const delays = calculateStaggerDelays(5, { baseDelay: 0, staggerDelay: 50, maxDelay: 300, easing: "ease", direction: "forward" });
    expect(delays).toHaveLength(5);
    expect(delays[0]).toBe(0);
    expect(delays[4]).toBe(200);
  });

  it("calculates center stagger", async () => {
    const { calculateStaggerDelays } = await mod();
    const delays = calculateStaggerDelays(5, { baseDelay: 0, staggerDelay: 100, maxDelay: 500, easing: "ease", direction: "center" });
    expect(delays[2]).toBeLessThan(delays[0]); // center has less delay
  });

  it("builds sequential sequence", async () => {
    const { buildSequence, PRESETS } = await mod();
    const seq = buildSequence([
      { target: ".a", animation: PRESETS.fadeIn },
      { target: ".b", animation: PRESETS.slideUp },
    ]);
    expect(seq.steps).toHaveLength(2);
    expect(seq.totalDuration).toBeGreaterThan(0);
    expect(seq.steps[1].startAt).toBeGreaterThan(0);
  });

  it("builds parallel sequence", async () => {
    const { buildParallel, PRESETS } = await mod();
    const seq = buildParallel([
      { target: ".a", animation: PRESETS.fadeIn },
      { target: ".b", animation: PRESETS.slideUp },
    ]);
    expect(seq.steps.every((s) => s.startAt === 0)).toBe(true);
  });

  it("audits animations against budget", async () => {
    const { buildSequence, PRESETS, auditAnimations, DEFAULT_BUDGET } = await mod();
    const seq = buildSequence([
      { target: ".a", animation: PRESETS.fadeIn },
    ], true);
    const audit = auditAnimations([seq], DEFAULT_BUDGET);
    expect(audit.score).toBeGreaterThanOrEqual(0);
    expect(audit.reducedMotionReady).toBe(true);
  });

  it("generates CSS string", async () => {
    const { toCSS, PRESETS } = await mod();
    const css = toCSS(PRESETS.fadeIn);
    expect(css).toContain("fadeIn");
    expect(css).toContain("300ms");
  });
});

// ── Q-194: userJourneyTracker ───────────────────────────────────────────────

describe("userJourneyTracker", () => {
  const mod = () => import("@/lib/userJourneyTracker");

  it("builds session from events", async () => {
    const { buildSession } = await mod();
    const events = [
      { type: "page_view" as const, page: "/login", timestamp: 1000 },
      { type: "click" as const, page: "/login", timestamp: 2000 },
      { type: "page_view" as const, page: "/dashboard", timestamp: 3000 },
    ];
    const session = buildSession("s1", events);
    expect(session.pageCount).toBe(2);
    expect(session.uniquePages).toBe(2);
    expect(session.pageDwells).toHaveLength(2);
    expect(session.completedGoal).toBe(true);
  });

  it("detects bounce session", async () => {
    const { buildSession, BOUNCE_MAX_PAGES } = await mod();
    const session = buildSession("s1", [
      { type: "page_view" as const, page: "/login", timestamp: 1000 },
    ]);
    expect(session.pageCount).toBeLessThanOrEqual(BOUNCE_MAX_PAGES);
  });

  it("analyzes flow", async () => {
    const { buildSession, analyzeFlow } = await mod();
    const sessions = [
      buildSession("s1", [
        { type: "page_view" as const, page: "/login", timestamp: 1000 },
        { type: "page_view" as const, page: "/dashboard", timestamp: 5000 },
      ]),
      buildSession("s2", [
        { type: "page_view" as const, page: "/login", timestamp: 1000 },
        { type: "page_view" as const, page: "/dashboard", timestamp: 5000 },
        { type: "page_view" as const, page: "/records", timestamp: 10000 },
      ]),
    ];
    const flow = analyzeFlow(sessions);
    expect(flow.length).toBeGreaterThan(0);
    const loginStep = flow.find((f) => f.page === "/login");
    expect(loginStep?.entryCount).toBe(2);
  });

  it("detects friction points", async () => {
    const { analyzeFlow, detectFriction, buildSession } = await mod();
    // Create sessions where /checkout has high exit rate
    const sessions = Array.from({ length: 10 }, (_, i) =>
      buildSession(`s${i}`, [
        { type: "page_view" as const, page: "/checkout", timestamp: 1000 },
        ...(i < 8 ? [] : [{ type: "page_view" as const, page: "/success", timestamp: 5000 }]),
      ])
    );
    const flow = analyzeFlow(sessions);
    const friction = detectFriction(flow, sessions);
    expect(friction.some((f) => f.page === "/checkout" && f.type === "high_exit")).toBe(true);
  });

  it("finds top paths", async () => {
    const { buildSession, findTopPaths } = await mod();
    const sessions = [
      buildSession("s1", [
        { type: "page_view" as const, page: "/a", timestamp: 1 },
        { type: "page_view" as const, page: "/b", timestamp: 2 },
      ]),
      buildSession("s2", [
        { type: "page_view" as const, page: "/a", timestamp: 1 },
        { type: "page_view" as const, page: "/b", timestamp: 2 },
      ]),
    ];
    const paths = findTopPaths(sessions);
    expect(paths[0].count).toBe(2);
  });

  it("analyzes journeys", async () => {
    const { buildSession, analyzeJourneys } = await mod();
    const sessions = [
      buildSession("s1", [
        { type: "page_view" as const, page: "/login", timestamp: 1000 },
        { type: "page_view" as const, page: "/dashboard", timestamp: 5000 },
      ]),
    ];
    const analysis = analyzeJourneys(sessions);
    expect(analysis.totalSessions).toBe(1);
    expect(analysis.score).toBeGreaterThan(0);
  });
});

// ── Q-195: notificationOptimizer ────────────────────────────────────────────

describe("notificationOptimizer", () => {
  const mod = () => import("@/lib/notificationOptimizer");

  it("detects silent hours", async () => {
    const { isSilentHour } = await mod();
    expect(isSilentHour(23)).toBe(true);
    expect(isSilentHour(3)).toBe(true);
    expect(isSilentHour(12)).toBe(false);
    expect(isSilentHour(19)).toBe(false);
  });

  it("finds optimal send time", async () => {
    const { findOptimalSendTime } = await mod();
    const pattern = {
      userId: "u1",
      hourlyActivity: Array.from({ length: 24 }, (_, h) => h === 19 ? 50 : h === 20 ? 30 : 0),
      dailyActivity: [10, 20, 15, 25, 20, 30, 5],
      lastActiveAt: Date.now(),
      timezone: "Asia/Tokyo",
    };
    const times = findOptimalSendTime(pattern);
    expect(times.length).toBeGreaterThan(0);
    expect(times[0].hour).toBe(19);
  });

  it("checks fatigue", async () => {
    const { checkFatigue } = await mod();
    const now = Date.now();
    const events = Array.from({ length: 10 }, (_, i) => ({
      sentAt: now - i * 86400000, channel: "push" as const, opened: false,
      clicked: false, dismissed: true, category: "reengagement",
    }));
    const fatigue = checkFatigue(events, now);
    expect(fatigue.isFatigued).toBe(true);
    expect(fatigue.cooldownUntil).not.toBeNull();
  });

  it("checks daily limit", async () => {
    const { checkDailyLimit } = await mod();
    const now = Date.now();
    const events = Array.from({ length: 5 }, (_, i) => ({
      sentAt: now - i * 3600000, channel: "push" as const, opened: true,
      clicked: false, dismissed: false, category: "test",
    }));
    const result = checkDailyLimit(events, now);
    expect(result.withinLimit).toBe(false);
  });

  it("calculates effectiveness", async () => {
    const { calculateEffectiveness } = await mod();
    const events = [
      { sentAt: 1, channel: "push" as const, opened: true, clicked: true, dismissed: false, category: "reengagement" },
      { sentAt: 2, channel: "push" as const, opened: true, clicked: false, dismissed: false, category: "reengagement" },
      { sentAt: 3, channel: "email" as const, opened: false, clicked: false, dismissed: true, category: "weekly" },
    ];
    const eff = calculateEffectiveness(events);
    expect(eff.length).toBe(2);
    const pushEff = eff.find((e) => e.channel === "push");
    expect(pushEff?.openRate).toBe(1);
    expect(pushEff?.clickRate).toBe(0.5);
  });

  it("decides whether to send notification", async () => {
    const { shouldSendNotification } = await mod();
    const pattern = {
      userId: "u1", hourlyActivity: new Array(24).fill(0),
      dailyActivity: new Array(7).fill(0), lastActiveAt: Date.now(), timezone: "UTC",
    };
    // Silent hour
    const result = shouldSendNotification([], pattern, 23, Date.now());
    expect(result.send).toBe(false);
    // Normal hour
    const result2 = shouldSendNotification([], pattern, 12, Date.now());
    expect(result2.send).toBe(true);
  });
});

// ── Barrel export verification ──────────────────────────────────────────────

describe("barrel exports (Q-187~Q-195)", () => {
  const barrelPath = new URL("../lib/index.ts", import.meta.url);
  const barrelContent = fs.readFileSync(barrelPath, "utf-8");

  const modules = [
    "webVitalsAnalyzer",
    "ariaLiveAnnouncer",
    "sessionManager",
    "rumCollector",
    "deprecationTracker",
    "supportTicketRouter",
    "animationOrchestrator",
    "userJourneyTracker",
    "notificationOptimizer",
  ];

  for (const m of modules) {
    it(`exports from ${m}`, () => {
      expect(barrelContent).toContain(`from "./${m}"`);
    });
  }
});
