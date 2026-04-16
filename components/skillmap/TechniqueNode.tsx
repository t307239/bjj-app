"use client";

import { useState } from "react";
import { Handle, Position, type Node, type NodeTypes } from "@xyflow/react";
import { masteryNodeClass, masterySelectedRing, NODE_W, NODE_H } from "@/lib/skillMapUtils";

// ─── Stable action refs (avoids stale-closure in custom node data) ────────────
export const deleteNodeRef = { current: (_id: string) => {} };
export const toggleCollapseRef = { current: (_id: string) => {} };

// BFS: returns all descendant node IDs of a given node via edges
export function getDescendantIds(
  nodeId: string,
  edges: { source: string; target: string }[]
): Set<string> {
  const descendants = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.source === current && !descendants.has(edge.target)) {
        descendants.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return descendants;
}

// ─── Custom Technique Node ────────────────────────────────────────────────────

function TechniqueNodeComp({
  id,
  data,
  selected,
}: {
  id: string;
  data: {
    label: string;
    isPro?: boolean;
    t?: (k: string) => string;
    mastery_level?: number;
    childCount?: number;
    isCollapsed?: boolean;
    dimmed?: boolean;
  };
  selected: boolean;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const mastery = data.mastery_level ?? 0;
  const hasChildren = (data.childCount ?? 0) > 0;

  return (
    <div
      className={`relative border rounded-xl px-3 py-2.5 shadow-lg transition-all select-none backdrop-blur-sm ${masteryNodeClass(mastery)} ${
        selected ? masterySelectedRing(mastery) : "hover:brightness-110"
      } ${data.dimmed ? "opacity-20 pointer-events-none" : ""}`}
      style={{ width: NODE_W, minHeight: NODE_H }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ width: 12, height: 12, background: "#3f3f46", border: "2px solid #6366f1", borderRadius: "50%", top: -6 }}
      />
      <span className="block text-xs font-medium break-words whitespace-pre-wrap leading-snug pr-4">
        {data.label}
      </span>
      {data.isPro && !confirmDel && (
        <button
          className="absolute top-1.5 right-1.5 text-zinc-500 hover:text-red-400 text-xs leading-none transition-colors"
          onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
          aria-label={data.t?.("skillmap.deleteNode") ?? "Remove"}
        >
          ✕
        </button>
      )}
      {data.isPro && confirmDel && (
        <div className="flex items-center gap-1 mt-1.5">
          <button
            className="text-xs bg-red-600 hover:bg-red-500 text-white px-1.5 py-0.5 rounded transition-colors"
            onClick={(e) => { e.stopPropagation(); deleteNodeRef.current(id); }}
          >
            {data.t?.("common.delete") ?? "Del"}
          </button>
          <button
            className="text-xs text-zinc-400 hover:text-gray-200 transition-colors"
            onClick={(e) => { e.stopPropagation(); setConfirmDel(false); }}
          >
            {data.t?.("common.cancel") ?? "✕"}
          </button>
        </div>
      )}
      {/* Collapse/expand toggle — shown only for Pro users with children */}
      {hasChildren && data.isPro && !confirmDel && (
        <button
          className="flex items-center justify-center gap-0.5 mt-1.5 w-full text-[10px] text-zinc-500 hover:text-zinc-200 transition-colors leading-none"
          onClick={(e) => { e.stopPropagation(); toggleCollapseRef.current(id); }}
          aria-label={
            data.isCollapsed
              ? (data.t?.("skillmap.expand") ?? "Expand")
              : (data.t?.("skillmap.collapse") ?? "Collapse")
          }
        >
          {data.isCollapsed ? `▶ ${data.childCount}` : "▼"}
        </button>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ width: 12, height: 12, background: "#3f3f46", border: "2px solid #6366f1", borderRadius: "50%", bottom: -6 }}
      />
    </div>
  );
}

export const nodeTypes: NodeTypes = { technique: TechniqueNodeComp };
export default TechniqueNodeComp;
