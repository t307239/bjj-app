/**
 * userJourneyTracker.ts — User journey tracking & session analysis
 *
 * Tracks user navigation patterns, identifies drop-off points,
 * measures time-on-page, and detects friction in user flows.
 *
 * Pure functions — no browser APIs. Operates on event arrays.
 *
 * @module Q-194 UX 95→97
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type JourneyEventType =
  | "page_view"
  | "click"
  | "form_submit"
  | "form_abandon"
  | "error"
  | "scroll_depth"
  | "feature_use"
  | "exit";

export interface JourneyEvent {
  readonly type: JourneyEventType;
  readonly page: string;
  readonly timestamp: number;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface PageDwell {
  readonly page: string;
  readonly enterTime: number;
  readonly exitTime: number;
  readonly dwellMs: number;
  readonly scrollDepthPercent: number;
  readonly interactions: number;
}

export interface JourneySession {
  readonly sessionId: string;
  readonly events: readonly JourneyEvent[];
  readonly startTime: number;
  readonly endTime: number;
  readonly durationMs: number;
  readonly pageCount: number;
  readonly uniquePages: number;
  readonly pageDwells: readonly PageDwell[];
  readonly hasError: boolean;
  readonly completedGoal: boolean;
}

export interface FlowStep {
  readonly page: string;
  readonly entryCount: number;
  readonly exitCount: number;
  readonly dropOffRate: number;
  readonly avgDwellMs: number;
  readonly errorRate: number;
}

export interface FrictionPoint {
  readonly page: string;
  readonly type: "high_exit" | "rage_click" | "form_abandon" | "error_spike" | "low_engagement";
  readonly severity: "low" | "medium" | "high";
  readonly metric: number;
  readonly description: string;
}

export interface JourneyAnalysis {
  readonly totalSessions: number;
  readonly avgSessionDuration: number;
  readonly avgPagesPerSession: number;
  readonly bounceRate: number;
  readonly flowSteps: readonly FlowStep[];
  readonly frictionPoints: readonly FrictionPoint[];
  readonly topPaths: readonly { path: readonly string[]; count: number }[];
  readonly score: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Bounce = single page view session */
export const BOUNCE_MAX_PAGES = 1;

/** Minimum dwell time to count as engagement (ms) */
export const MIN_ENGAGEMENT_MS = 5000;

/** Thresholds for friction detection */
export const FRICTION_THRESHOLDS = {
  highExitRate: 0.6,
  lowEngagementMs: 3000,
  errorSpikeRate: 0.1,
  formAbandonRate: 0.5,
} as const;

/** Goal pages that indicate successful journeys */
export const GOAL_PAGES: readonly string[] = [
  "/dashboard",
  "/records",
  "/techniques",
  "/profile",
];

// ── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Build a session from raw events.
 */
export function buildSession(
  sessionId: string,
  events: readonly JourneyEvent[],
  goalPages: readonly string[] = GOAL_PAGES
): JourneySession {
  if (events.length === 0) {
    return {
      sessionId,
      events: [],
      startTime: 0,
      endTime: 0,
      durationMs: 0,
      pageCount: 0,
      uniquePages: 0,
      pageDwells: [],
      hasError: false,
      completedGoal: false,
    };
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const startTime = sorted[0].timestamp;
  const endTime = sorted[sorted.length - 1].timestamp;

  // Build page dwells
  const pageDwells: PageDwell[] = [];
  let currentPage: string | null = null;
  let enterTime = 0;
  let interactions = 0;
  let maxScroll = 0;

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];

    if (event.type === "page_view") {
      if (currentPage) {
        pageDwells.push({
          page: currentPage,
          enterTime,
          exitTime: event.timestamp,
          dwellMs: event.timestamp - enterTime,
          scrollDepthPercent: maxScroll,
          interactions,
        });
      }
      currentPage = event.page;
      enterTime = event.timestamp;
      interactions = 0;
      maxScroll = 0;
    } else {
      interactions++;
      if (event.type === "scroll_depth" && typeof event.metadata?.["depth"] === "number") {
        maxScroll = Math.max(maxScroll, event.metadata["depth"] as number);
      }
    }
  }

  // Close last page
  if (currentPage) {
    pageDwells.push({
      page: currentPage,
      enterTime,
      exitTime: endTime,
      dwellMs: endTime - enterTime,
      scrollDepthPercent: maxScroll,
      interactions,
    });
  }

  const pageViews = sorted.filter((e) => e.type === "page_view");
  const uniquePages = new Set(pageViews.map((e) => e.page)).size;
  const hasError = sorted.some((e) => e.type === "error");
  const completedGoal = sorted.some(
    (e) => e.type === "page_view" && goalPages.includes(e.page)
  );

  return {
    sessionId,
    events: sorted,
    startTime,
    endTime,
    durationMs: endTime - startTime,
    pageCount: pageViews.length,
    uniquePages,
    pageDwells,
    hasError,
    completedGoal,
  };
}

/**
 * Analyze user flow through pages.
 */
export function analyzeFlow(
  sessions: readonly JourneySession[]
): FlowStep[] {
  const pageStats: Record<string, {
    entries: number;
    exits: number;
    totalDwell: number;
    dwellCount: number;
    errors: number;
  }> = {};

  for (const session of sessions) {
    for (let i = 0; i < session.pageDwells.length; i++) {
      const dwell = session.pageDwells[i];
      if (!pageStats[dwell.page]) {
        pageStats[dwell.page] = { entries: 0, exits: 0, totalDwell: 0, dwellCount: 0, errors: 0 };
      }
      pageStats[dwell.page].entries++;
      pageStats[dwell.page].totalDwell += dwell.dwellMs;
      pageStats[dwell.page].dwellCount++;

      // Last page in session = exit
      if (i === session.pageDwells.length - 1) {
        pageStats[dwell.page].exits++;
      }
    }

    // Count errors per page
    for (const event of session.events) {
      if (event.type === "error" && pageStats[event.page]) {
        pageStats[event.page].errors++;
      }
    }
  }

  return Object.entries(pageStats).map(([page, stats]) => ({
    page,
    entryCount: stats.entries,
    exitCount: stats.exits,
    dropOffRate: stats.entries > 0 ? Math.round((stats.exits / stats.entries) * 100) / 100 : 0,
    avgDwellMs: stats.dwellCount > 0 ? Math.round(stats.totalDwell / stats.dwellCount) : 0,
    errorRate: stats.entries > 0 ? Math.round((stats.errors / stats.entries) * 100) / 100 : 0,
  }));
}

/**
 * Detect friction points in user journeys.
 */
export function detectFriction(
  flowSteps: readonly FlowStep[],
  sessions: readonly JourneySession[]
): FrictionPoint[] {
  const frictionPoints: FrictionPoint[] = [];

  for (const step of flowSteps) {
    // High exit rate
    if (step.dropOffRate > FRICTION_THRESHOLDS.highExitRate && step.entryCount >= 5) {
      frictionPoints.push({
        page: step.page,
        type: "high_exit",
        severity: step.dropOffRate > 0.8 ? "high" : "medium",
        metric: step.dropOffRate,
        description: `${Math.round(step.dropOffRate * 100)}% of users exit from this page`,
      });
    }

    // Low engagement
    if (step.avgDwellMs < FRICTION_THRESHOLDS.lowEngagementMs && step.entryCount >= 5) {
      frictionPoints.push({
        page: step.page,
        type: "low_engagement",
        severity: step.avgDwellMs < 1000 ? "high" : "low",
        metric: step.avgDwellMs,
        description: `Average dwell time is only ${Math.round(step.avgDwellMs / 1000)}s`,
      });
    }

    // Error spike
    if (step.errorRate > FRICTION_THRESHOLDS.errorSpikeRate) {
      frictionPoints.push({
        page: step.page,
        type: "error_spike",
        severity: step.errorRate > 0.2 ? "high" : "medium",
        metric: step.errorRate,
        description: `${Math.round(step.errorRate * 100)}% of sessions on this page have errors`,
      });
    }
  }

  // Form abandonment from sessions
  const formPages: Record<string, { starts: number; abandons: number }> = {};
  for (const session of sessions) {
    for (const event of session.events) {
      if (event.type === "form_submit") {
        if (!formPages[event.page]) formPages[event.page] = { starts: 0, abandons: 0 };
        formPages[event.page].starts++;
      }
      if (event.type === "form_abandon") {
        if (!formPages[event.page]) formPages[event.page] = { starts: 0, abandons: 0 };
        formPages[event.page].abandons++;
      }
    }
  }

  for (const [page, stats] of Object.entries(formPages)) {
    const total = stats.starts + stats.abandons;
    if (total >= 3) {
      const abandonRate = stats.abandons / total;
      if (abandonRate > FRICTION_THRESHOLDS.formAbandonRate) {
        frictionPoints.push({
          page,
          type: "form_abandon",
          severity: abandonRate > 0.7 ? "high" : "medium",
          metric: abandonRate,
          description: `${Math.round(abandonRate * 100)}% form abandonment rate`,
        });
      }
    }
  }

  return frictionPoints.sort((a, b) => {
    const sevOrder = { high: 0, medium: 1, low: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}

/**
 * Find most common navigation paths.
 */
export function findTopPaths(
  sessions: readonly JourneySession[],
  maxPaths: number = 5
): { path: string[]; count: number }[] {
  const pathCounts: Record<string, number> = {};

  for (const session of sessions) {
    const pages = session.pageDwells.map((d) => d.page);
    // Take first 5 pages as the "path"
    const pathKey = pages.slice(0, 5).join(" → ");
    pathCounts[pathKey] = (pathCounts[pathKey] || 0) + 1;
  }

  return Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPaths)
    .map(([pathStr, count]) => ({
      path: pathStr.split(" → "),
      count,
    }));
}

/**
 * Build comprehensive journey analysis.
 */
export function analyzeJourneys(
  sessions: readonly JourneySession[]
): JourneyAnalysis {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      avgSessionDuration: 0,
      avgPagesPerSession: 0,
      bounceRate: 0,
      flowSteps: [],
      frictionPoints: [],
      topPaths: [],
      score: 100,
    };
  }

  const totalDuration = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const totalPages = sessions.reduce((sum, s) => sum + s.pageCount, 0);
  const bounces = sessions.filter((s) => s.pageCount <= BOUNCE_MAX_PAGES).length;

  const flowSteps = analyzeFlow(sessions);
  const frictionPoints = detectFriction(flowSteps, sessions);
  const topPaths = findTopPaths(sessions);

  const bounceRate = Math.round((bounces / sessions.length) * 100) / 100;
  const avgDuration = Math.round(totalDuration / sessions.length);
  const avgPages = Math.round((totalPages / sessions.length) * 10) / 10;

  // Score: penalize for friction, bounces, errors
  let score = 100;
  score -= frictionPoints.filter((f) => f.severity === "high").length * 10;
  score -= frictionPoints.filter((f) => f.severity === "medium").length * 5;
  score -= Math.round(bounceRate * 20);
  score = Math.max(0, Math.min(100, score));

  return {
    totalSessions: sessions.length,
    avgSessionDuration: avgDuration,
    avgPagesPerSession: avgPages,
    bounceRate,
    flowSteps,
    frictionPoints,
    topPaths,
    score,
  };
}

/**
 * Format journey analysis as string.
 */
export function formatJourneyAnalysis(analysis: JourneyAnalysis): string {
  const lines = [
    `=== User Journey Analysis ===`,
    `Score: ${analysis.score}/100`,
    `Sessions: ${analysis.totalSessions}`,
    `Avg duration: ${Math.round(analysis.avgSessionDuration / 1000)}s`,
    `Avg pages/session: ${analysis.avgPagesPerSession}`,
    `Bounce rate: ${Math.round(analysis.bounceRate * 100)}%`,
  ];

  if (analysis.frictionPoints.length > 0) {
    lines.push("", "--- Friction Points ---");
    for (const fp of analysis.frictionPoints) {
      const icon = fp.severity === "high" ? "🔴" : fp.severity === "medium" ? "🟡" : "🟢";
      lines.push(`${icon} ${fp.page}: ${fp.description}`);
    }
  }

  if (analysis.topPaths.length > 0) {
    lines.push("", "--- Top Paths ---");
    for (const tp of analysis.topPaths) {
      lines.push(`  ${tp.path.join(" → ")} (${tp.count}x)`);
    }
  }

  return lines.join("\n");
}
