/**
 * Q-179: Navigation Flow Analyzer (UX 94→95)
 *
 * Analyzes user navigation patterns, detects dead-ends, validates breadcrumbs,
 * and measures navigation efficiency for SaaS-grade UX.
 */

// ── Constants ──────────────────────────────────────────────

export interface NavNode {
  path: string;
  label: string;
  parent?: string;
  requiresAuth: boolean;
  depth: number;
}

export interface NavEdge {
  from: string;
  to: string;
  type: "link" | "redirect" | "back" | "breadcrumb";
}

export interface NavFlowIssue {
  type: "dead_end" | "orphan" | "deep_nesting" | "missing_breadcrumb" | "circular" | "auth_leak";
  severity: "error" | "warning" | "info";
  path: string;
  message: string;
  suggestion: string;
}

export interface NavFlowReport {
  issues: NavFlowIssue[];
  totalPages: number;
  reachablePages: number;
  maxDepth: number;
  avgDepth: number;
  score: number;
  grade: string;
  summary: string;
}

export const MAX_RECOMMENDED_DEPTH = 4;
export const BREADCRUMB_REQUIRED_DEPTH = 2;

// ── Analysis Functions ─────────────────────────────────────

/**
 * Detect dead-end pages (no outgoing links except back)
 */
export function detectDeadEnds(
  nodes: NavNode[],
  edges: NavEdge[]
): NavFlowIssue[] {
  const issues: NavFlowIssue[] = [];
  for (const node of nodes) {
    const outgoing = edges.filter(
      (e) => e.from === node.path && e.type !== "back"
    );
    if (outgoing.length === 0) {
      issues.push({
        type: "dead_end",
        severity: "warning",
        path: node.path,
        message: `"${node.path}" has no outgoing navigation links`,
        suggestion: "Add related links, CTAs, or next-step navigation",
      });
    }
  }
  return issues;
}

/**
 * Detect orphan pages (no incoming links)
 */
export function detectOrphans(
  nodes: NavNode[],
  edges: NavEdge[]
): NavFlowIssue[] {
  const issues: NavFlowIssue[] = [];
  const root = nodes.find((n) => n.depth === 0);
  for (const node of nodes) {
    if (node === root) continue;
    const incoming = edges.filter((e) => e.to === node.path);
    if (incoming.length === 0) {
      issues.push({
        type: "orphan",
        severity: "error",
        path: node.path,
        message: `"${node.path}" is unreachable — no incoming links`,
        suggestion: "Add navigation link from parent or sibling page",
      });
    }
  }
  return issues;
}

/**
 * Detect deeply nested pages
 */
export function detectDeepNesting(nodes: NavNode[]): NavFlowIssue[] {
  const issues: NavFlowIssue[] = [];
  for (const node of nodes) {
    if (node.depth > MAX_RECOMMENDED_DEPTH) {
      issues.push({
        type: "deep_nesting",
        severity: "warning",
        path: node.path,
        message: `"${node.path}" is ${node.depth} levels deep (max recommended: ${MAX_RECOMMENDED_DEPTH})`,
        suggestion: "Consider flattening navigation or adding shortcuts",
      });
    }
  }
  return issues;
}

/**
 * Detect pages missing breadcrumbs that need them
 */
export function detectMissingBreadcrumbs(
  nodes: NavNode[],
  edges: NavEdge[]
): NavFlowIssue[] {
  const issues: NavFlowIssue[] = [];
  const breadcrumbTargets = new Set(
    edges.filter((e) => e.type === "breadcrumb").map((e) => e.from)
  );
  for (const node of nodes) {
    if (node.depth >= BREADCRUMB_REQUIRED_DEPTH && !breadcrumbTargets.has(node.path)) {
      issues.push({
        type: "missing_breadcrumb",
        severity: "info",
        path: node.path,
        message: `"${node.path}" (depth ${node.depth}) has no breadcrumb navigation`,
        suggestion: "Add BreadcrumbList for pages at depth ≥ 2",
      });
    }
  }
  return issues;
}

/**
 * Detect circular navigation loops
 */
export function detectCircularNav(edges: NavEdge[]): NavFlowIssue[] {
  const issues: NavFlowIssue[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    if (edge.type === "back") continue;
    const key = `${edge.from}->${edge.to}`;
    const reverse = `${edge.to}->${edge.from}`;
    if (seen.has(reverse)) {
      issues.push({
        type: "circular",
        severity: "info",
        path: edge.from,
        message: `Circular navigation between "${edge.from}" and "${edge.to}"`,
        suggestion: "Ensure one direction is primary, mark other as secondary/related",
      });
    }
    seen.add(key);
  }
  return issues;
}

/**
 * Detect auth-protected pages reachable from public nav
 */
export function detectAuthLeaks(
  nodes: NavNode[],
  edges: NavEdge[]
): NavFlowIssue[] {
  const issues: NavFlowIssue[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.path, n]));
  for (const edge of edges) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (from && to && !from.requiresAuth && to.requiresAuth) {
      issues.push({
        type: "auth_leak",
        severity: "warning",
        path: edge.to,
        message: `Auth-required "${edge.to}" linked from public "${edge.from}"`,
        suggestion: "Add auth check or redirect, or mark link as requiring login",
      });
    }
  }
  return issues;
}

/**
 * Calculate navigation depth statistics
 */
export function calculateDepthStats(nodes: NavNode[]): {
  maxDepth: number;
  avgDepth: number;
} {
  if (nodes.length === 0) return { maxDepth: 0, avgDepth: 0 };
  const depths = nodes.map((n) => n.depth);
  const maxDepth = Math.max(...depths);
  const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
  return { maxDepth, avgDepth: Math.round(avgDepth * 100) / 100 };
}

/**
 * Count reachable pages from root via BFS
 */
export function countReachable(
  nodes: NavNode[],
  edges: NavEdge[]
): number {
  const root = nodes.find((n) => n.depth === 0);
  if (!root) return 0;
  const visited = new Set<string>();
  const queue = [root.path];
  visited.add(root.path);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.from === current && !visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return visited.size;
}

/**
 * Run full navigation flow analysis
 */
export function analyzeNavFlow(
  nodes: NavNode[],
  edges: NavEdge[]
): NavFlowReport {
  const allIssues = [
    ...detectDeadEnds(nodes, edges),
    ...detectOrphans(nodes, edges),
    ...detectDeepNesting(nodes),
    ...detectMissingBreadcrumbs(nodes, edges),
    ...detectCircularNav(edges),
    ...detectAuthLeaks(nodes, edges),
  ];

  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const infoCount = allIssues.filter((i) => i.severity === "info").length;

  const rawScore = 100 - errorCount * 15 - warningCount * 5 - infoCount * 1;
  const score = Math.max(0, Math.min(100, rawScore));
  const grade =
    score >= 95 ? "A+" : score >= 90 ? "A" : score >= 80 ? "B" :
    score >= 70 ? "C" : score >= 60 ? "D" : "F";

  const { maxDepth, avgDepth } = calculateDepthStats(nodes);
  const reachablePages = countReachable(nodes, edges);

  return {
    issues: allIssues,
    totalPages: nodes.length,
    reachablePages,
    maxDepth,
    avgDepth,
    score,
    grade,
    summary: `Nav flow: ${score}/100 (${grade}) — ${nodes.length} pages, ${reachablePages} reachable, ${errorCount} errors, ${warningCount} warnings`,
  };
}

/**
 * Format navigation flow report as string
 */
export function formatNavFlowReport(report: NavFlowReport): string {
  const lines = [
    `# Navigation Flow Report`,
    `Score: ${report.score}/100 (${report.grade})`,
    `Pages: ${report.totalPages} total, ${report.reachablePages} reachable`,
    `Depth: max ${report.maxDepth}, avg ${report.avgDepth}`,
    ``,
    `## Issues (${report.issues.length})`,
  ];
  for (const issue of report.issues) {
    lines.push(`- [${issue.severity.toUpperCase()}] ${issue.message}`);
    lines.push(`  → ${issue.suggestion}`);
  }
  return lines.join("\n");
}
