/**
 * skillMapUtils.ts — Pure utility functions for SkillMapV2.
 * No React, no Supabase. Safe to use in tests.
 */

import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { DbTechniqueNode as DbNode, DbTechniqueEdge } from "@/lib/database.types";

// ─── Type alias ───────────────────────────────────────────────────────────────
export type DbEdge = Pick<DbTechniqueEdge, "id" | "source_id" | "target_id" | "label">;

// ─── Constants ────────────────────────────────────────────────────────────────
export const NODE_W = 160;
export const NODE_H = 60;

// ─── dagre typings (no @types/dagre available) ───────────────────────────────
interface DagreGraph {
  setDefaultEdgeLabel: (fn: () => object) => void;
  setGraph: (opts: { rankdir: string; nodesep: number; ranksep: number }) => void;
  setNode: (id: string, dims: { width: number; height: number }) => void;
  setEdge: (src: string, tgt: string) => void;
  node: (id: string) => { x: number; y: number };
}
interface Dagre {
  graphlib: { Graph: new () => DagreGraph };
  layout: (g: DagreGraph) => void;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dagre = require("dagre") as Dagre;

// ─── DAG cycle detection ──────────────────────────────────────────────────────
export function wouldCreateCycle(edges: Edge[], srcId: string, tgtId: string): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  if (!adj.has(srcId)) adj.set(srcId, []);
  adj.get(srcId)!.push(tgtId);
  const visited = new Set<string>();
  const stack = [tgtId];
  while (stack.length) {
    const n = stack.pop()!;
    if (n === srcId) return true;
    if (visited.has(n)) continue;
    visited.add(n);
    for (const nb of adj.get(n) ?? []) stack.push(nb);
  }
  return false;
}

// ─── Dagre auto-layout (Top → Bottom) ────────────────────────────────────────
export function getLayoutedNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 50 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => {
    try { g.setEdge(e.source, e.target); } catch { /* skip bad edges */ }
  });
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    if (!pos) return n;
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

// ─── Mastery level → CSS classes ─────────────────────────────────────────────
export function masteryNodeClass(level: number | undefined): string {
  if (level === 2) return "bg-emerald-900/20 border-emerald-500/50 text-emerald-300";
  if (level === 1) return "bg-blue-900/20 border-blue-500/50 text-blue-300";
  return "bg-zinc-800/50 border-zinc-700 text-zinc-400";
}

export function masterySelectedRing(level: number | undefined): string {
  if (level === 2) return "ring-2 ring-emerald-400/40";
  if (level === 1) return "ring-2 ring-blue-400/40";
  return "ring-2 ring-[#6366f1]/40";
}

// ─── DB → React Flow converters ───────────────────────────────────────────────
export function dbNodeToRF(n: DbNode): Node {
  return {
    id: n.id,
    type: "technique",
    position: { x: n.pos_x, y: n.pos_y },
    data: { label: n.name, mastery_level: n.mastery_level ?? 0 },
  };
}

export function dbEdgeToRF(e: DbEdge): Edge {
  return {
    id: e.id,
    source: e.source_id,
    target: e.target_id,
    label: e.label ?? undefined,
    type: "smoothstep",
    animated: false,
    style: { stroke: "#6366f1", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
  };
}
