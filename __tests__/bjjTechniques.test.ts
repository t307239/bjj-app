/**
 * bjjTechniques — static technique suggestion list validation
 *
 * Ensures the autocomplete suggestion list is well-formed:
 * no duplicates, reasonable length, non-empty entries.
 */
import { describe, it, expect } from "vitest";
import { BJJ_TECHNIQUE_SUGGESTIONS } from "@/lib/bjjTechniques";

describe("BJJ_TECHNIQUE_SUGGESTIONS", () => {
  it("contains at least 50 techniques", () => {
    expect(BJJ_TECHNIQUE_SUGGESTIONS.length).toBeGreaterThanOrEqual(50);
  });

  it("has no empty strings", () => {
    const empties = BJJ_TECHNIQUE_SUGGESTIONS.filter((t) => !t.trim());
    expect(empties).toEqual([]);
  });

  it("has no duplicates (case-insensitive)", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const t of BJJ_TECHNIQUE_SUGGESTIONS) {
      const key = t.toLowerCase();
      if (seen.has(key)) dupes.push(t);
      seen.add(key);
    }
    expect(dupes).toEqual([]);
  });

  it("includes core submission techniques", () => {
    const names = BJJ_TECHNIQUE_SUGGESTIONS.map((t) => t.toLowerCase());
    expect(names).toContain("armbar");
    expect(names).toContain("triangle choke");
    expect(names).toContain("rear naked choke");
    expect(names).toContain("kimura");
  });

  it("includes guard sweeps", () => {
    const names = BJJ_TECHNIQUE_SUGGESTIONS.map((t) => t.toLowerCase());
    expect(names).toContain("scissor sweep");
    expect(names).toContain("butterfly sweep");
  });

  it("includes guard passes", () => {
    const names = BJJ_TECHNIQUE_SUGGESTIONS.map((t) => t.toLowerCase());
    expect(names).toContain("knee slice pass");
    expect(names).toContain("torreando pass");
  });

  it("includes takedowns", () => {
    const names = BJJ_TECHNIQUE_SUGGESTIONS.map((t) => t.toLowerCase());
    expect(names).toContain("single leg takedown");
    expect(names).toContain("double leg takedown");
  });

  it("includes positions", () => {
    const names = BJJ_TECHNIQUE_SUGGESTIONS.map((t) => t.toLowerCase());
    expect(names).toContain("closed guard");
    expect(names).toContain("mount");
    expect(names).toContain("back control");
  });

  it("all entries are reasonable length (3-50 chars)", () => {
    const bad = BJJ_TECHNIQUE_SUGGESTIONS.filter(
      (t) => t.length < 3 || t.length > 50,
    );
    expect(bad).toEqual([]);
  });
});
