/**
 * lib/serverComponentAnalysis.ts — Server Component migration analysis utilities
 *
 * Q-142: Performance pillar — provides programmatic analysis of component
 * client/server classification to identify migration candidates and track
 * the ratio of Server vs Client components over time.
 *
 * @example
 *   import { classifyComponent, calculateMigrationROI, SC_BUDGET } from "@/lib/serverComponentAnalysis";
 *   const result = classifyComponent(sourceCode);
 *   const roi = calculateMigrationROI(candidates);
 */

// ── Types ────────────────────────────────────────────────────────────────

export type ComponentClassification = "server" | "client" | "candidate" | "review";

export interface ClientIndicator {
  /** Pattern name */
  name: string;
  /** Number of occurrences */
  count: number;
  /** Impact weight (1-10) */
  weight: number;
}

export interface ComponentAnalysis {
  /** Whether "use client" directive is present */
  hasUseClient: boolean;
  /** Classification */
  classification: ComponentClassification;
  /** Client-side API usage score (higher = more client-dependent) */
  clientScore: number;
  /** Server-side pattern score */
  serverScore: number;
  /** Migration feasibility score (0-100, higher = easier to migrate) */
  migrationScore: number;
  /** Detected client-side indicators */
  clientIndicators: ClientIndicator[];
  /** Detected server-side indicators */
  serverIndicators: ClientIndicator[];
}

export interface MigrationROI {
  /** Number of components that can be migrated */
  candidateCount: number;
  /** Total lines of code that would move to server */
  totalLines: number;
  /** Estimated JS bundle reduction in KB (rough) */
  estimatedBundleReductionKB: number;
  /** Priority order (easiest first) */
  priority: Array<{ path: string; lines: number; score: number }>;
}

export interface SCRatioSnapshot {
  /** Total .tsx files */
  total: number;
  /** Files with "use client" */
  clientComponents: number;
  /** Files without "use client" (server components) */
  serverComponents: number;
  /** Server component percentage */
  serverPercent: number;
  /** Date of snapshot */
  timestamp: string;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Performance budget: target Server Component ratio */
export const SC_BUDGET = {
  /** Target: at least 40% server components */
  targetServerPercent: 40,
  /** Warning threshold */
  warningServerPercent: 25,
  /** Average bytes per line of TSX (rough estimate) */
  avgBytesPerLine: 45,
} as const;

/** Client-side API patterns and their weights */
export const CLIENT_PATTERNS: Array<{ pattern: RegExp; name: string; weight: number }> = [
  { pattern: /\buse(State|Effect|Ref|Callback|Memo|Reducer|Context|LayoutEffect)\b/, name: "React Hook", weight: 10 },
  { pattern: /\bon(Click|Change|Submit|KeyDown|KeyUp|Focus|Blur|Mouse|Touch|Scroll|Input)\b\s*[={]/, name: "Event Handler", weight: 8 },
  { pattern: /\b(window|document|navigator|localStorage|sessionStorage)\b/, name: "Browser API", weight: 7 },
  { pattern: /\buse(Router|Pathname|SearchParams)\b/, name: "Next.js Client Hook", weight: 10 },
  { pattern: /\b(createContext|useContext)\b/, name: "Context API", weight: 9 },
  { pattern: /\bfrom\s+['"](@?sentry|framer-motion|recharts|react-hot-toast)/, name: "Client Library", weight: 8 },
];

/** Server-side patterns */
export const SERVER_PATTERNS: Array<{ pattern: RegExp; name: string; weight: number }> = [
  { pattern: /\basync\s+function/, name: "Async Function", weight: 3 },
  { pattern: /\bawait\b/, name: "Await", weight: 2 },
  { pattern: /\bexport\s+(const\s+)?metadata\b/, name: "Metadata Export", weight: 5 },
];

// ── Analysis Functions ──────────────────────────────────────────────────

/**
 * Classify a component's source code as server, client, candidate, or review.
 */
export function classifyComponent(source: string): ComponentAnalysis {
  const hasUseClient = /^['"]use client['"];?\s*$/m.test(source);

  const clientIndicators: ClientIndicator[] = [];
  const serverIndicators: ClientIndicator[] = [];

  for (const { pattern, name, weight } of CLIENT_PATTERNS) {
    const matches = source.match(new RegExp(pattern, "g"));
    if (matches) {
      clientIndicators.push({ name, count: matches.length, weight });
    }
  }

  for (const { pattern, name, weight } of SERVER_PATTERNS) {
    const matches = source.match(new RegExp(pattern, "g"));
    if (matches) {
      serverIndicators.push({ name, count: matches.length, weight });
    }
  }

  const clientScore = clientIndicators.reduce((sum, i) => sum + i.weight * i.count, 0);
  const serverScore = serverIndicators.reduce((sum, i) => sum + i.weight * i.count, 0);

  const migrationScore = clientScore === 0
    ? 100
    : Math.max(0, Math.round((1 - clientScore / (clientScore + serverScore + 10)) * 100));

  let classification: ComponentClassification;
  if (!hasUseClient) {
    classification = "server";
  } else if (clientScore === 0) {
    classification = "candidate";
  } else if (clientScore <= 15) {
    classification = "review";
  } else {
    classification = "client";
  }

  return {
    hasUseClient,
    classification,
    clientScore,
    serverScore,
    migrationScore,
    clientIndicators,
    serverIndicators,
  };
}

/**
 * Calculate migration ROI for a set of candidates.
 */
export function calculateMigrationROI(
  candidates: Array<{ path: string; lines: number; migrationScore: number }>,
): MigrationROI {
  const totalLines = candidates.reduce((sum, c) => sum + c.lines, 0);
  const estimatedBundleReductionKB = Math.round((totalLines * SC_BUDGET.avgBytesPerLine) / 1024);

  const priority = [...candidates]
    .sort((a, b) => b.migrationScore - a.migrationScore || a.lines - b.lines)
    .map((c) => ({ path: c.path, lines: c.lines, score: c.migrationScore }));

  return {
    candidateCount: candidates.length,
    totalLines,
    estimatedBundleReductionKB,
    priority,
  };
}

/**
 * Create a Server/Client component ratio snapshot.
 */
export function createSCRatioSnapshot(
  totalFiles: number,
  clientFiles: number,
  now: Date = new Date(),
): SCRatioSnapshot {
  const serverComponents = totalFiles - clientFiles;
  return {
    total: totalFiles,
    clientComponents: clientFiles,
    serverComponents,
    serverPercent: totalFiles > 0 ? Math.round((serverComponents / totalFiles) * 100) : 0,
    timestamp: now.toISOString(),
  };
}

/**
 * Check if SC ratio meets the performance budget.
 */
export function isSCRatioHealthy(snapshot: SCRatioSnapshot): {
  healthy: boolean;
  warning: boolean;
  message: string;
} {
  if (snapshot.serverPercent >= SC_BUDGET.targetServerPercent) {
    return {
      healthy: true,
      warning: false,
      message: `Server Component ratio ${snapshot.serverPercent}% meets target (${SC_BUDGET.targetServerPercent}%)`,
    };
  }
  if (snapshot.serverPercent >= SC_BUDGET.warningServerPercent) {
    return {
      healthy: false,
      warning: true,
      message: `Server Component ratio ${snapshot.serverPercent}% below target ${SC_BUDGET.targetServerPercent}% (warning)`,
    };
  }
  return {
    healthy: false,
    warning: false,
    message: `Server Component ratio ${snapshot.serverPercent}% critically below target ${SC_BUDGET.targetServerPercent}%`,
  };
}

/**
 * Format a migration report summary.
 */
export function formatMigrationSummary(roi: MigrationROI, snapshot: SCRatioSnapshot): string {
  const health = isSCRatioHealthy(snapshot);
  const lines = [
    `SC Ratio: ${snapshot.serverPercent}% (${snapshot.serverComponents}/${snapshot.total}) — ${health.healthy ? "✅ Healthy" : health.warning ? "⚠️ Warning" : "🔴 Critical"}`,
    `Migration candidates: ${roi.candidateCount} components (${roi.totalLines} lines)`,
    `Estimated bundle reduction: ~${roi.estimatedBundleReductionKB} KB`,
  ];
  if (roi.priority.length > 0) {
    lines.push(`Top candidate: ${roi.priority[0].path} (${roi.priority[0].lines} lines)`);
  }
  return lines.join(" | ");
}
