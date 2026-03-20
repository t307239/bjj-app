/**
 * Unit tests for lib/affiliateMap.ts
 * Tests: getAffiliateInfo(), getAffiliateLink(), AFF_CODE constant
 * Covers: exact match, partial match (includes), contained match, edge cases
 */

import { describe, it, expect } from "vitest";
import {
  getAffiliateInfo,
  getAffiliateLink,
  AFF_CODE,
  type AffiliateInfo,
} from "@/lib/affiliateMap";

const BASE = "https://bjjfanatics.com/products";

// ── AFF_CODE ──────────────────────────────────────────────────────────────────
describe("AFF_CODE", () => {
  it("is defined and non-empty", () => {
    expect(AFF_CODE).toBeTruthy();
    expect(typeof AFF_CODE).toBe("string");
  });

  it("affiliate code appears in generated URLs", () => {
    const info = getAffiliateInfo("triangle choke");
    expect(info?.url).toContain(`aff=${AFF_CODE}`);
  });
});

// ── getAffiliateInfo — exact match ────────────────────────────────────────────
describe("getAffiliateInfo — exact match", () => {
  it("matches 'triangle choke' exactly", () => {
    const info = getAffiliateInfo("triangle choke");
    expect(info).not.toBeNull();
    expect(info?.instructor).toBe("John Danaher");
    expect(info?.url).toContain("triangle");
  });

  it("matches 'armbar' exactly (lowercase)", () => {
    const info = getAffiliateInfo("armbar");
    expect(info).not.toBeNull();
    expect(info?.title).toContain("Armbar");
  });

  it("matches 'kimura' exactly", () => {
    const info = getAffiliateInfo("kimura");
    expect(info?.instructor).toBe("John Danaher");
  });

  it("matches 'heel hook' exactly", () => {
    const info = getAffiliateInfo("heel hook");
    expect(info).not.toBeNull();
    expect(info?.title).toContain("Leg Lock");
  });

  it("matches 'closed guard' exactly", () => {
    const info = getAffiliateInfo("closed guard");
    expect(info).not.toBeNull();
    expect(info?.url).toContain("closed-guard");
  });

  it("matches 'half guard' exactly", () => {
    const info = getAffiliateInfo("half guard");
    expect(info?.instructor).toBe("Bernardo Faria");
  });

  it("matches case-insensitively — 'Triangle Choke' → same as 'triangle choke'", () => {
    const lower = getAffiliateInfo("triangle choke");
    const upper = getAffiliateInfo("Triangle Choke");
    expect(upper).toEqual(lower);
  });

  it("matches with extra whitespace trimmed — '  kimura  '", () => {
    const info = getAffiliateInfo("  kimura  ");
    expect(info).not.toBeNull();
    expect(info?.title).toContain("Kimura");
  });
});

// ── getAffiliateInfo — partial match (name includes key) ─────────────────────
describe("getAffiliateInfo — partial match (input includes key)", () => {
  it("'advanced triangle choke from guard' matches 'triangle choke'", () => {
    const info = getAffiliateInfo("advanced triangle choke from guard");
    expect(info).not.toBeNull();
    expect(info?.instructor).toBe("John Danaher");
  });

  it("'standing heel hook entry' matches 'heel hook'", () => {
    const info = getAffiliateInfo("standing heel hook entry");
    expect(info).not.toBeNull();
    expect(info?.title).toContain("Leg Lock");
  });

  it("'butterfly guard sweep' matches 'butterfly guard'", () => {
    const info = getAffiliateInfo("butterfly guard sweep");
    expect(info?.instructor).toBe("Marcelo Garcia");
  });

  it("'double leg takedown' matches 'double leg'", () => {
    const info = getAffiliateInfo("double leg takedown");
    expect(info?.instructor).toBe("Gordon Ryan");
  });
});

// ── getAffiliateInfo — contained match (key includes input) ──────────────────
describe("getAffiliateInfo — contained match (key includes input)", () => {
  it("'guillotine' (short) matches longer 'guillotine' key", () => {
    // 'guillotine' is itself an exact key — but tests path-3 logic via short aliases
    const info = getAffiliateInfo("guillotine");
    expect(info).not.toBeNull();
  });

  it("short input longer than 3 chars triggers contained check", () => {
    // 'rnc' → exact match
    const info = getAffiliateInfo("rnc");
    expect(info).not.toBeNull();
  });

  it("input shorter than or equal to 3 chars does NOT trigger contained check", () => {
    // 'dlr' is an exact key — but ensure sub-3-char input like 'gi' returns null if no key
    const info = getAffiliateInfo("gi");
    // 'gi' is not in map; also length <= 3 so contained check skipped
    expect(info).toBeNull();
  });
});

// ── getAffiliateInfo — null / invalid input ───────────────────────────────────
describe("getAffiliateInfo — null / invalid input", () => {
  it("returns null for empty string", () => {
    expect(getAffiliateInfo("")).toBeNull();
  });

  it("returns null for unknown technique", () => {
    expect(getAffiliateInfo("this technique does not exist xyz123")).toBeNull();
  });

  it("returns null for non-string (null cast)", () => {
    // @ts-expect-error testing runtime edge case
    expect(getAffiliateInfo(null)).toBeNull();
  });

  it("returns null for non-string (number cast)", () => {
    // @ts-expect-error testing runtime edge case
    expect(getAffiliateInfo(42)).toBeNull();
  });
});

// ── getAffiliateInfo — return shape ──────────────────────────────────────────
describe("getAffiliateInfo — return shape", () => {
  it("returned object has url, title, instructor fields", () => {
    const info = getAffiliateInfo("armbar") as AffiliateInfo;
    expect(info).toHaveProperty("url");
    expect(info).toHaveProperty("title");
    expect(info).toHaveProperty("instructor");
  });

  it("url starts with bjjfanatics.com/products", () => {
    const info = getAffiliateInfo("kimura") as AffiliateInfo;
    expect(info.url.startsWith(BASE)).toBe(true);
  });

  it("url contains aff= parameter", () => {
    const info = getAffiliateInfo("omoplata") as AffiliateInfo;
    expect(info.url).toContain("aff=");
  });

  it("instructor is a non-empty string", () => {
    const info = getAffiliateInfo("guard pass") as AffiliateInfo;
    expect(typeof info.instructor).toBe("string");
    expect(info.instructor.length).toBeGreaterThan(0);
  });
});

// ── getAffiliateLink — backward compat ───────────────────────────────────────
describe("getAffiliateLink — backward compatibility", () => {
  it("returns a URL string for known technique", () => {
    const url = getAffiliateLink("triangle choke");
    expect(typeof url).toBe("string");
    expect(url).toContain("bjjfanatics.com");
  });

  it("returns the same URL as getAffiliateInfo().url", () => {
    const info = getAffiliateInfo("armbar");
    const url = getAffiliateLink("armbar");
    expect(url).toBe(info?.url);
  });

  it("returns null for empty string", () => {
    expect(getAffiliateLink("")).toBeNull();
  });

  it("returns null for unknown technique", () => {
    expect(getAffiliateLink("completely unknown xyz999")).toBeNull();
  });

  it("returns null for non-string input", () => {
    // @ts-expect-error testing runtime edge case
    expect(getAffiliateLink(null)).toBeNull();
  });
});

// ── Specific instructor coverage ──────────────────────────────────────────────
describe("instructor coverage", () => {
  const cases: [string, string][] = [
    ["guard pass", "Bernardo Faria"],
    ["leg lock", "John Danaher"],
    ["back control", "John Danaher"],
    ["wrestling", "Gordon Ryan"],
    ["marcelo garcia", "Marcelo Garcia"],
    ["gordon ryan", "Gordon Ryan"],
    ["tom deblass", "Tom DeBlass"],
    ["lachlan giles", "Lachlan Giles"],
    ["craig jones", "Craig Jones"],
    ["bernardo faria", "Bernardo Faria"],
  ];

  it.each(cases)("'%s' → instructor '%s'", (input, expectedInstructor) => {
    const info = getAffiliateInfo(input);
    expect(info?.instructor).toBe(expectedInstructor);
  });
});

// ── Alias keys ────────────────────────────────────────────────────────────────
describe("alias / alternate key forms", () => {
  it("'dela riva' and 'de la riva' resolve to same product", () => {
    const a = getAffiliateInfo("dela riva");
    const b = getAffiliateInfo("de la riva");
    expect(a?.url).toBe(b?.url);
  });

  it("'arm bar' (with space) and 'armbar' resolve to same product", () => {
    const a = getAffiliateInfo("arm bar");
    const b = getAffiliateInfo("armbar");
    expect(a?.url).toBe(b?.url);
  });

  it("'dlr' alias works", () => {
    const dlr = getAffiliateInfo("dlr");
    const full = getAffiliateInfo("de la riva");
    expect(dlr?.url).toBe(full?.url);
  });

  it("'rnc' alias maps to rear naked choke product", () => {
    const rnc = getAffiliateInfo("rnc");
    const full = getAffiliateInfo("rear naked choke");
    expect(rnc?.url).toBe(full?.url);
  });

  it("'heel hooks' (plural) maps to same as 'heel hook'", () => {
    const a = getAffiliateInfo("heel hooks");
    const b = getAffiliateInfo("heel hook");
    expect(a?.url).toBe(b?.url);
  });
});
