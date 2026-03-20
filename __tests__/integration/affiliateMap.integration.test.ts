/**
 * Integration tests: lib/affiliateMap.ts (内結テスト)
 *
 * Tests cross-function consistency and system-wide invariants:
 *   - AFF_CODE appears in ALL URLs returned by getAffiliateInfo
 *   - getAffiliateLink always equals getAffiliateInfo().url
 *   - All aliases for the same product resolve to the same URL
 *   - URL format invariants across the entire map
 *   - Instructor name consistency
 *
 * Run:  npx vitest run __tests__/integration/affiliateMap.integration.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  getAffiliateInfo,
  getAffiliateLink,
  AFF_CODE,
  type AffiliateInfo,
} from "@/lib/affiliateMap";

const BASE = "https://bjjfanatics.com/products";

// Representative sample of all keys to test URL invariants
// (not every single key — unit tests cover per-key matching)
const SAMPLE_TECHNIQUES = [
  "closed guard",
  "half guard",
  "spider guard",
  "de la riva",
  "butterfly guard",
  "x guard",
  "triangle choke",
  "rear naked choke",
  "armbar",
  "kimura",
  "omoplata",
  "heel hook",
  "leg lock",
  "guard pass",
  "back control",
  "mount",
  "double leg",
  "wrestling",
  "sweep",
  "escape",
  "conditioning",
  "gordon ryan",
  "marcelo garcia",
  "john danaher",
  "craig jones",
  "lachlan giles",
  "bernardo faria",
  "tom deblass",
  "guillotine",
  "collar choke",
];

// ── AFF_CODE appears in every URL ────────────────────────────────────────────
describe("AFF_CODE global URL invariant", () => {
  it("every technique in sample set returns a URL containing AFF_CODE", () => {
    for (const technique of SAMPLE_TECHNIQUES) {
      const info = getAffiliateInfo(technique);
      expect(info, `no result for "${technique}"`).not.toBeNull();
      expect(
        info!.url,
        `AFF_CODE missing from URL for "${technique}": ${info!.url}`
      ).toContain(`aff=${AFF_CODE}`);
    }
  });

  it("every technique in sample set returns a URL starting with BASE", () => {
    for (const technique of SAMPLE_TECHNIQUES) {
      const info = getAffiliateInfo(technique);
      expect(info!.url.startsWith(BASE), `Bad URL for "${technique}": ${info!.url}`).toBe(true);
    }
  });

  it("AFF_CODE constant is exactly 'bjjapp'", () => {
    expect(AFF_CODE).toBe("bjjapp");
  });
});

// ── getAffiliateLink always equals getAffiliateInfo().url ────────────────────
describe("getAffiliateLink = getAffiliateInfo().url (backward compat)", () => {
  it("both functions return identical URLs for all sample techniques", () => {
    for (const technique of SAMPLE_TECHNIQUES) {
      const info = getAffiliateInfo(technique);
      const link = getAffiliateLink(technique);
      expect(link, `getAffiliateLink differs from getAffiliateInfo for "${technique}"`)
        .toBe(info?.url ?? null);
    }
  });

  it("both return null for the same unknown input", () => {
    const unknowns = ["completely unknown xyz", "", "a", "ab"];
    for (const u of unknowns) {
      expect(getAffiliateInfo(u)).toBeNull();
      expect(getAffiliateLink(u)).toBeNull();
    }
  });

  it("both return null for the same non-string inputs", () => {
    // @ts-expect-error testing runtime edge case
    expect(getAffiliateInfo(null)).toBeNull();
    // @ts-expect-error testing runtime edge case
    expect(getAffiliateLink(null)).toBeNull();
    // @ts-expect-error testing runtime edge case
    expect(getAffiliateInfo(42)).toBeNull();
    // @ts-expect-error testing runtime edge case
    expect(getAffiliateLink(42)).toBeNull();
  });
});

// ── Alias consistency: all aliases for same product resolve to same URL ────
describe("alias groups resolve to identical URLs", () => {
  const aliasGroups: [string, string[]][] = [
    [
      "De La Riva guard aliases",
      ["de la riva", "dela riva", "dlr"],
    ],
    [
      "Armbar aliases",
      ["armbar", "arm bar"],
    ],
    [
      "Heel hook / leg lock aliases",
      ["heel hook", "heel hooks", "leg lock", "ankle lock", "foot lock", "kneebar", "toe hold", "saddle"],
    ],
    [
      "Rear naked choke aliases",
      ["rear naked choke", "rnc"],
    ],
    [
      "Triangle aliases",
      ["triangle", "triangle choke"],
    ],
    [
      "Gogoplata aliases",
      ["gogoplata", "gogo plata"],
    ],
    [
      "Back control aliases",
      ["back control", "back attack", "body triangle", "seat belt"],
    ],
    [
      "Mount aliases",
      ["mount", "s-mount", "high mount"],
    ],
    [
      "Takedown aliases",
      ["double leg", "single leg", "wrestling", "takedown"],
    ],
    [
      "Guard pass aliases",
      ["guard pass", "guard passing", "torreando", "smash pass", "stack pass", "pressure passing"],
    ],
    [
      "D'Arce / Anaconda aliases",
      ["darce", "d'arce", "darce choke"],
    ],
    [
      "Anaconda aliases",
      ["anaconda", "anaconda choke"],
    ],
    [
      "Escape aliases",
      ["escape", "mount escape", "side control escape"],
    ],
    [
      "Sweep aliases",
      ["sweep", "hip bump", "scissor sweep", "flower sweep"],
    ],
    [
      "Conditioning aliases",
      ["conditioning", "strength training"],
    ],
  ];

  it.each(aliasGroups)("%s all resolve to same URL", (_name, aliases) => {
    const urls = aliases.map((a) => {
      const info = getAffiliateInfo(a);
      expect(info, `"${a}" returned null`).not.toBeNull();
      return info!.url;
    });
    const uniqueUrls = new Set(urls);
    expect(
      uniqueUrls.size,
      `Alias group [${aliases.join(", ")}] resolved to multiple URLs:\n${[...uniqueUrls].join("\n")}`
    ).toBe(1);
  });
});

// ── Instructor name consistency across alias groups ───────────────────────
describe("instructor consistency within product families", () => {
  const instructorGroups: [string, string[], string][] = [
    ["Danaher leg locks",  ["heel hook", "leg lock", "kneebar", "ankle lock", "ashi garami", "saddle"],           "John Danaher"],
    ["Danaher back",       ["back control", "back attack"],                                                       "John Danaher"],
    ["Danaher armbar",     ["armbar", "arm bar"],                                                                 "John Danaher"],
    ["Danaher kimura",     ["kimura"],                                                                            "John Danaher"],
    ["Danaher triangle",   ["triangle", "triangle choke"],                                                       "John Danaher"],
    ["Gordon Ryan",        ["double leg", "single leg", "wrestling"],                                            "Gordon Ryan"],
    ["Bernardo Faria pass",["guard pass", "guard passing"],                                                      "Bernardo Faria"],
    ["Marcelo Garcia",     ["marcelo garcia"],                                                                    "Marcelo Garcia"],
    ["Craig Jones",        ["craig jones"],                                                                       "Craig Jones"],
    ["Lachlan Giles",      ["lachlan giles"],                                                                     "Lachlan Giles"],
    ["Tom DeBlass",        ["tom deblass"],                                                                       "Tom DeBlass"],
  ];

  it.each(instructorGroups)("%s instructor is '%s'", (_name, techniques, expectedInstructor) => {
    for (const t of techniques) {
      const info = getAffiliateInfo(t);
      expect(info?.instructor, `"${t}" has wrong instructor`).toBe(expectedInstructor);
    }
  });
});

// ── URL format structural invariants ────────────────────────────────────────
describe("URL structural invariants", () => {
  it("all URLs contain exactly one '?' (query separator)", () => {
    for (const technique of SAMPLE_TECHNIQUES) {
      const info = getAffiliateInfo(technique) as AffiliateInfo;
      const questionMarks = (info.url.match(/\?/g) || []).length;
      expect(questionMarks, `URL for "${technique}" has ${questionMarks} '?' chars`).toBe(1);
    }
  });

  it("all URLs end with 'aff=bjjapp' query param", () => {
    for (const technique of SAMPLE_TECHNIQUES) {
      const info = getAffiliateInfo(technique) as AffiliateInfo;
      expect(info.url, `URL for "${technique}" doesn't end with affiliate param`)
        .toContain(`aff=${AFF_CODE}`);
    }
  });

  it("all URLs are HTTPS", () => {
    for (const technique of SAMPLE_TECHNIQUES) {
      const info = getAffiliateInfo(technique) as AffiliateInfo;
      expect(info.url.startsWith("https://"), `URL for "${technique}" is not HTTPS`).toBe(true);
    }
  });

  it("no URL contains whitespace", () => {
    for (const technique of SAMPLE_TECHNIQUES) {
      const info = getAffiliateInfo(technique) as AffiliateInfo;
      expect(/\s/.test(info.url), `URL for "${technique}" contains whitespace: "${info.url}"`).toBe(false);
    }
  });

  it("all returned AffiliateInfo objects have non-empty title and instructor", () => {
    for (const technique of SAMPLE_TECHNIQUES) {
      const info = getAffiliateInfo(technique) as AffiliateInfo;
      expect(info.title.length, `"${technique}" has empty title`).toBeGreaterThan(0);
      expect(info.instructor.length, `"${technique}" has empty instructor`).toBeGreaterThan(0);
    }
  });
});

// ── Case / whitespace normalization pipeline ──────────────────────────────
describe("normalization pipeline (case + whitespace)", () => {
  const variants = [
    ["heel hook",   "HEEL HOOK",    "Heel Hook",   "  heel hook  "],
    ["armbar",      "ARMBAR",       "ArmBar",      "  armbar  "],
    ["kimura",      "KIMURA",       "Kimura",      "  kimura  "],
    ["triangle",    "TRIANGLE",     "Triangle",    "  triangle  "],
    ["guard pass",  "GUARD PASS",   "Guard Pass",  "  guard pass  "],
  ];

  for (const group of variants) {
    const base = group[0];
    it(`all casing/spacing variants of "${base}" resolve to the same URL`, () => {
      const baseUrl = getAffiliateInfo(base)?.url;
      for (const variant of group.slice(1)) {
        expect(getAffiliateInfo(variant)?.url, `Variant "${variant}" differs from "${base}"`).toBe(baseUrl);
      }
    });
  }
});
