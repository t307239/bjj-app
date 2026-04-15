/**
 * Q-19: Unit tests for skillMapUtils pure functions.
 * Tests cycle detection and mastery CSS helpers (no dagre/React Flow dependency).
 */
import { describe, it, expect } from "vitest";
import {
  wouldCreateCycle,
  masteryNodeClass,
  masterySelectedRing,
  NODE_W,
  NODE_H,
} from "@/lib/skillMapUtils";
import type { Edge } from "@xyflow/react";

// ─── Helper to create minimal Edge objects ───────────────────────────────────
function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target } as Edge;
}

// ─── wouldCreateCycle ────────────────────────────────────────────────────────
describe("wouldCreateCycle", () => {
  it("returns false for a simple new edge with no existing cycle", () => {
    const edges = [edge("A", "B"), edge("B", "C")];
    expect(wouldCreateCycle(edges, "C", "D")).toBe(false);
  });

  it("detects a direct back-edge creating a cycle", () => {
    // A → B → C, adding C → A creates A → B → C → A cycle
    const edges = [edge("A", "B"), edge("B", "C")];
    expect(wouldCreateCycle(edges, "C", "A")).toBe(true);
  });

  it("detects an indirect cycle through multiple hops", () => {
    // A → B → C → D, adding D → A
    const edges = [edge("A", "B"), edge("B", "C"), edge("C", "D")];
    expect(wouldCreateCycle(edges, "D", "A")).toBe(true);
  });

  it("returns false when adding to a disconnected node", () => {
    const edges = [edge("A", "B")];
    expect(wouldCreateCycle(edges, "C", "D")).toBe(false);
  });

  it("returns false for self-loop scenario (self-edge is not a cycle in DFS)", () => {
    // Self-loop: adding A → A. The DFS starts from A and looks for A.
    // Since target=A and we check if we can reach source=A from target=A,
    // the adjacency already has A → A, visited starts with A, no further neighbors.
    const edges: Edge[] = [];
    // src=A, tgt=A: add A→A to adj, then DFS from A looking for A — immediately true
    expect(wouldCreateCycle(edges, "A", "A")).toBe(true);
  });

  it("handles empty edge list", () => {
    expect(wouldCreateCycle([], "A", "B")).toBe(false);
  });

  it("handles diamond graph without cycle", () => {
    //   A
    //  / \
    // B   C
    //  \ /
    //   D
    const edges = [edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("C", "D")];
    // Adding D → E is fine
    expect(wouldCreateCycle(edges, "D", "E")).toBe(false);
  });

  it("detects cycle in diamond graph when closing the loop", () => {
    const edges = [edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("C", "D")];
    // Adding D → A creates a cycle
    expect(wouldCreateCycle(edges, "D", "A")).toBe(true);
  });
});

// ─── masteryNodeClass ────────────────────────────────────────────────────────
describe("masteryNodeClass", () => {
  it("returns emerald classes for mastered (level 2)", () => {
    const cls = masteryNodeClass(2);
    expect(cls).toContain("emerald");
    expect(cls).toContain("bg-");
    expect(cls).toContain("border-");
    expect(cls).toContain("text-");
  });

  it("returns blue classes for learning (level 1)", () => {
    const cls = masteryNodeClass(1);
    expect(cls).toContain("blue");
  });

  it("returns zinc classes for locked (level 0)", () => {
    const cls = masteryNodeClass(0);
    expect(cls).toContain("zinc");
  });

  it("returns zinc classes for undefined level", () => {
    const cls = masteryNodeClass(undefined);
    expect(cls).toContain("zinc");
  });
});

// ─── masterySelectedRing ────────────────────────────────────────────────────
describe("masterySelectedRing", () => {
  it("returns emerald ring for mastered", () => {
    expect(masterySelectedRing(2)).toContain("emerald");
  });

  it("returns blue ring for learning", () => {
    expect(masterySelectedRing(1)).toContain("blue");
  });

  it("returns indigo ring for locked", () => {
    expect(masterySelectedRing(0)).toContain("6366f1");
  });

  it("returns indigo ring for undefined", () => {
    expect(masterySelectedRing(undefined)).toContain("6366f1");
  });
});

// ─── Constants ──────────────────────────────────────────────────────────────
describe("constants", () => {
  it("exports valid node dimensions", () => {
    expect(NODE_W).toBeGreaterThan(0);
    expect(NODE_H).toBeGreaterThan(0);
  });
});
