/**
 * dataLineageTracker.ts — Data lineage tracking for field-level origin and dependency analysis
 *
 * Pure-function utility for building data lineage graphs, tracing data origins,
 * finding downstream dependencies, detecting PII flow to unprotected sinks,
 * and auditing overall data lineage health.
 *
 * @module Q-199
 * @since Q-199
 */

/* ---------- Types ---------- */

export type DataSource = "user_input" | "api" | "database" | "computed" | "imported";

export interface LineageNode {
  readonly id: string;
  readonly name: string;
  readonly source: DataSource;
  readonly fields: readonly string[];
  readonly isProtected: boolean;
  readonly description?: string;
}

export interface LineageEdge {
  readonly from: string;
  readonly to: string;
  readonly transformation?: string;
  readonly fields: readonly string[];
}

export interface DataLineageGraph {
  readonly nodes: readonly LineageNode[];
  readonly edges: readonly LineageEdge[];
  readonly nodeMap: Record<string, LineageNode>;
}

export interface PIIFlowViolation {
  readonly field: string;
  readonly sourceName: string;
  readonly sinkName: string;
  readonly path: readonly string[];
  readonly severity: "critical" | "high" | "medium";
}

export interface LineageIssue {
  readonly type: "orphaned_node" | "circular_dependency" | "unprotected_pii" | "missing_node_ref" | "dead_end";
  readonly nodeId: string;
  readonly message: string;
  readonly severity: "critical" | "high" | "medium" | "low";
}

export interface LineageAudit {
  readonly score: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly orphanedNodes: number;
  readonly circularDeps: number;
  readonly piiViolations: readonly PIIFlowViolation[];
  readonly issues: readonly LineageIssue[];
  readonly recommendations: readonly string[];
}

/* ---------- Constants ---------- */

export const SENSITIVE_FIELDS = [
  "email",
  "phone",
  "ip_address",
  "password",
  "password_hash",
  "credit_card",
  "ssn",
  "date_of_birth",
  "address",
  "full_name",
  "bank_account",
  "passport_number",
] as const;

export const PII_CATEGORIES: Record<string, string> = {
  email: "contact",
  phone: "contact",
  ip_address: "identifier",
  password: "credential",
  password_hash: "credential",
  credit_card: "financial",
  ssn: "government_id",
  date_of_birth: "personal",
  address: "contact",
  full_name: "personal",
  bank_account: "financial",
  passport_number: "government_id",
} as const;

/* ---------- Functions ---------- */

/**
 * Build a lineage graph from nodes and edges with validation.
 */
export function buildLineageGraph(
  nodes: readonly LineageNode[],
  edges: readonly LineageEdge[]
): DataLineageGraph {
  const nodeMap: Record<string, LineageNode> = {};
  for (const node of nodes) {
    nodeMap[node.id] = node;
  }
  return { nodes, edges, nodeMap };
}

/**
 * Trace the origin of a field by walking backwards through the graph.
 * Returns all source nodes that contribute to the given field.
 */
export function traceDataOrigin(
  graph: DataLineageGraph,
  fieldName: string
): readonly LineageNode[] {
  const sources: LineageNode[] = [];
  const visited = new Set<string>();

  function walkBack(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const incomingEdges = graph.edges.filter(
      (e) => e.to === nodeId && (e.fields.includes(fieldName) || e.fields.length === 0)
    );

    if (incomingEdges.length === 0) {
      // This is a source node for this field
      const node = graph.nodeMap[nodeId];
      if (node && node.fields.includes(fieldName)) {
        sources.push(node);
      }
      return;
    }

    for (const edge of incomingEdges) {
      walkBack(edge.from);
    }
  }

  // Find all nodes that contain this field and trace back
  for (const node of graph.nodes) {
    if (node.fields.includes(fieldName)) {
      walkBack(node.id);
    }
  }

  return sources;
}

/**
 * Find all downstream dependencies of a given node (walk forwards).
 */
export function findDownstreamDependencies(
  graph: DataLineageGraph,
  nodeId: string
): readonly LineageNode[] {
  const deps: LineageNode[] = [];
  const visited = new Set<string>();

  function walkForward(currentId: string): void {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const outgoingEdges = graph.edges.filter((e) => e.from === currentId);
    for (const edge of outgoingEdges) {
      const node = graph.nodeMap[edge.to];
      if (node && !visited.has(edge.to)) {
        deps.push(node);
        walkForward(edge.to);
      }
    }
  }

  walkForward(nodeId);
  return deps;
}

/**
 * Detect PII data flowing to non-protected sinks.
 */
export function detectPIIFlow(graph: DataLineageGraph): readonly PIIFlowViolation[] {
  const violations: PIIFlowViolation[] = [];

  for (const field of SENSITIVE_FIELDS) {
    // Find all nodes containing this PII field
    for (const node of graph.nodes) {
      if (!node.fields.includes(field)) continue;

      // Walk forward to find unprotected sinks
      const visited = new Set<string>();
      const pathStack: string[] = [node.id];

      function walkForwardPII(currentId: string, path: readonly string[]): void {
        if (visited.has(currentId)) return;
        visited.add(currentId);

        const outgoing = graph.edges.filter(
          (e) => e.from === currentId && (e.fields.includes(field) || e.fields.length === 0)
        );

        for (const edge of outgoing) {
          const target = graph.nodeMap[edge.to];
          if (!target) continue;
          const newPath = [...path, edge.to];

          if (!target.isProtected) {
            violations.push({
              field,
              sourceName: node.name,
              sinkName: target.name,
              path: newPath,
              severity: PII_CATEGORIES[field] === "credential" || PII_CATEGORIES[field] === "financial"
                ? "critical"
                : PII_CATEGORIES[field] === "government_id"
                  ? "high"
                  : "medium",
            });
          }

          walkForwardPII(edge.to, newPath);
        }
      }

      walkForwardPII(node.id, pathStack);
    }
  }

  return violations;
}

/**
 * Detect circular dependencies in the lineage graph.
 */
function detectCircularDeps(graph: DataLineageGraph): readonly string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoing = graph.edges.filter((e) => e.from === nodeId);
    for (const edge of outgoing) {
      if (recursionStack.has(edge.to)) {
        const cycleStart = path.indexOf(edge.to);
        if (cycleStart >= 0) {
          cycles.push([...path.slice(cycleStart), edge.to]);
        }
      } else if (!visited.has(edge.to)) {
        dfs(edge.to, [...path, edge.to]);
      }
    }

    recursionStack.delete(nodeId);
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, [node.id]);
    }
  }

  return cycles;
}

/**
 * Comprehensive audit of data lineage graph health.
 */
export function auditDataLineage(graph: DataLineageGraph): LineageAudit {
  let score = 100;
  const issues: LineageIssue[] = [];
  const recommendations: string[] = [];

  // Find orphaned nodes (no incoming or outgoing edges)
  const connectedNodes = new Set<string>();
  for (const edge of graph.edges) {
    connectedNodes.add(edge.from);
    connectedNodes.add(edge.to);
  }
  const orphaned = graph.nodes.filter((n) => !connectedNodes.has(n.id));
  for (const node of orphaned) {
    issues.push({
      type: "orphaned_node",
      nodeId: node.id,
      message: `Node "${node.name}" has no connections`,
      severity: "medium",
    });
  }

  // Find dead-end nodes (have incoming but no outgoing — may be intentional sinks)
  const nodesWithOutgoing = new Set(graph.edges.map((e) => e.from));
  const nodesWithIncoming = new Set(graph.edges.map((e) => e.to));
  for (const node of graph.nodes) {
    if (nodesWithIncoming.has(node.id) && !nodesWithOutgoing.has(node.id) && node.source === "computed") {
      issues.push({
        type: "dead_end",
        nodeId: node.id,
        message: `Computed node "${node.name}" has no downstream consumers`,
        severity: "low",
      });
    }
  }

  // Check for edges referencing missing nodes
  for (const edge of graph.edges) {
    if (!graph.nodeMap[edge.from]) {
      issues.push({
        type: "missing_node_ref",
        nodeId: edge.from,
        message: `Edge references non-existent source node "${edge.from}"`,
        severity: "high",
      });
    }
    if (!graph.nodeMap[edge.to]) {
      issues.push({
        type: "missing_node_ref",
        nodeId: edge.to,
        message: `Edge references non-existent target node "${edge.to}"`,
        severity: "high",
      });
    }
  }

  // Circular dependencies
  const cycles = detectCircularDeps(graph);
  for (const cycle of cycles) {
    issues.push({
      type: "circular_dependency",
      nodeId: cycle[0],
      message: `Circular dependency: ${cycle.join(" → ")}`,
      severity: "high",
    });
  }

  // PII violations
  const piiViolations = detectPIIFlow(graph);
  for (const v of piiViolations) {
    issues.push({
      type: "unprotected_pii",
      nodeId: v.sinkName,
      message: `PII field "${v.field}" flows from "${v.sourceName}" to unprotected sink "${v.sinkName}"`,
      severity: v.severity === "critical" ? "critical" : "high",
    });
  }

  // Score deductions
  score -= orphaned.length * 3;
  score -= cycles.length * 10;
  score -= piiViolations.filter((v) => v.severity === "critical").length * 15;
  score -= piiViolations.filter((v) => v.severity === "high").length * 10;
  score -= piiViolations.filter((v) => v.severity === "medium").length * 5;
  score -= issues.filter((i) => i.type === "missing_node_ref").length * 8;

  // Recommendations
  if (orphaned.length > 0) {
    recommendations.push(`Remove or connect ${orphaned.length} orphaned node(s)`);
  }
  if (cycles.length > 0) {
    recommendations.push(`Resolve ${cycles.length} circular dependency(ies)`);
  }
  if (piiViolations.length > 0) {
    recommendations.push(`Protect ${piiViolations.length} PII flow violation(s) — add encryption or access controls`);
  }
  if (graph.nodes.length > 0 && graph.edges.length === 0) {
    recommendations.push("No edges defined — add data flow relationships between nodes");
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    grade: finalScore >= 90 ? "A" : finalScore >= 80 ? "B" : finalScore >= 70 ? "C" : finalScore >= 60 ? "D" : "F",
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    orphanedNodes: orphaned.length,
    circularDeps: cycles.length,
    piiViolations,
    issues,
    recommendations,
  };
}

/**
 * Format a lineage audit as a human-readable string report.
 */
export function formatLineageAudit(audit: LineageAudit): string {
  const lines: string[] = [
    "=== Data Lineage Audit ===",
    `Score: ${audit.score}/100 (${audit.grade})`,
    "",
    `Nodes: ${audit.totalNodes} | Edges: ${audit.totalEdges}`,
    `Orphaned: ${audit.orphanedNodes} | Circular Deps: ${audit.circularDeps}`,
    `PII Violations: ${audit.piiViolations.length}`,
  ];

  if (audit.piiViolations.length > 0) {
    lines.push("", "PII Flow Violations:");
    for (const v of audit.piiViolations) {
      lines.push(`  [${v.severity.toUpperCase()}] "${v.field}": ${v.sourceName} → ${v.sinkName}`);
    }
  }

  if (audit.issues.length > 0) {
    lines.push("", `Issues (${audit.issues.length}):`);
    for (const issue of audit.issues) {
      lines.push(`  [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}`);
    }
  }

  if (audit.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const rec of audit.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }

  return lines.join("\n");
}
