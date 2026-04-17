/**
 * Tests for Q-173: screenReaderAudit (a11y 94→95)
 */
import { describe, it, expect } from "vitest";

describe("Q-173: screenReaderAudit", () => {
  it("REQUIRED_LANDMARKS and RECOMMENDED_LANDMARKS", async () => {
    const m = await import("@/lib/screenReaderAudit");
    expect(m.REQUIRED_LANDMARKS).toContain("banner");
    expect(m.REQUIRED_LANDMARKS).toContain("main");
    expect(m.REQUIRED_LANDMARKS).toContain("contentinfo");
    expect(m.RECOMMENDED_LANDMARKS).toContain("navigation");
  });

  it("ROLE_REQUIRED_ATTRS", async () => {
    const m = await import("@/lib/screenReaderAudit");
    expect(m.ROLE_REQUIRED_ATTRS.checkbox).toContain("aria-checked");
    expect(m.ROLE_REQUIRED_ATTRS.dialog).toContain("aria-label");
    expect(m.ROLE_REQUIRED_ATTRS.slider.length).toBe(3);
  });

  it("auditLandmarks: all present", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const landmarks = [
      { role: "banner", hasLabel: true },
      { role: "main", hasLabel: true },
      { role: "contentinfo", hasLabel: true },
      { role: "navigation", label: "Main nav", hasLabel: true },
    ];
    const issues = m.auditLandmarks(landmarks);
    expect(issues.filter((i) => i.severity === "error").length).toBe(0);
  });

  it("auditLandmarks: missing required", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const landmarks = [{ role: "navigation", hasLabel: true }];
    const issues = m.auditLandmarks(landmarks);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBe(3); // missing banner, main, contentinfo
  });

  it("auditLandmarks: duplicate main", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const landmarks = [
      { role: "banner", hasLabel: true },
      { role: "main", hasLabel: true },
      { role: "main", hasLabel: true },
      { role: "contentinfo", hasLabel: true },
    ];
    const issues = m.auditLandmarks(landmarks);
    expect(issues.some((i) => i.message.includes("Multiple main"))).toBe(true);
  });

  it("calculateLandmarkCoverage", async () => {
    const m = await import("@/lib/screenReaderAudit");
    expect(m.calculateLandmarkCoverage([{ role: "main", hasLabel: true }])).toBe(33);
    expect(m.calculateLandmarkCoverage([
      { role: "banner", hasLabel: true },
      { role: "main", hasLabel: true },
      { role: "contentinfo", hasLabel: true },
    ])).toBe(100);
  });

  it("auditHeadingHierarchy: valid", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const headings = [
      { level: 1, text: "Page Title" },
      { level: 2, text: "Section A" },
      { level: 3, text: "Subsection" },
      { level: 2, text: "Section B" },
    ];
    const issues = m.auditHeadingHierarchy(headings);
    expect(issues.filter((i) => i.severity === "error").length).toBe(0);
  });

  it("auditHeadingHierarchy: skipped levels", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const headings = [
      { level: 1, text: "Title" },
      { level: 4, text: "Deep" }, // skips h2, h3
    ];
    const issues = m.auditHeadingHierarchy(headings);
    expect(issues.some((i) => i.message.includes("skipped"))).toBe(true);
  });

  it("auditHeadingHierarchy: no h1 first", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const headings = [{ level: 2, text: "Subtitle" }];
    const issues = m.auditHeadingHierarchy(headings);
    expect(issues.some((i) => i.message.includes("expected h1"))).toBe(true);
  });

  it("isHeadingStructureValid", async () => {
    const m = await import("@/lib/screenReaderAudit");
    expect(m.isHeadingStructureValid([{ level: 1, text: "Title" }, { level: 2, text: "Sub" }])).toBe(true);
    expect(m.isHeadingStructureValid([{ level: 3, text: "Wrong start" }])).toBe(false);
  });

  it("auditImageAlt: missing alt", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const images = [
      { src: "logo.png" }, // no alt
      { src: "hero.jpg", alt: "Hero image" },
      { src: "decorative.svg", ariaHidden: true }, // decorative, should skip
    ];
    const issues = m.auditImageAlt(images);
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain("logo.png");
  });

  it("auditImageAlt: non-descriptive alt", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const images = [{ src: "photo.jpg", alt: "image of" }];
    const issues = m.auditImageAlt(images);
    expect(issues.some((i) => i.message.includes("Non-descriptive"))).toBe(true);
  });

  it("calculateImageAltCoverage", async () => {
    const m = await import("@/lib/screenReaderAudit");
    expect(m.calculateImageAltCoverage([
      { src: "a.png", alt: "A" },
      { src: "b.png" },
    ])).toBe(50);
    expect(m.calculateImageAltCoverage([])).toBe(100);
    // Decorative images don't count
    expect(m.calculateImageAltCoverage([{ src: "d.svg", ariaHidden: true }])).toBe(100);
  });

  it("auditRoleAttributes: missing required", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const elements = [
      { role: "checkbox", attributes: {} }, // missing aria-checked
      { role: "dialog", attributes: { "aria-label": "My dialog" } }, // ok
    ];
    const issues = m.auditRoleAttributes(elements);
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain("checkbox");
  });

  it("auditLiveRegions: too many assertive", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const regions = [
      { politeness: "assertive" as const, atomic: false, relevant: "additions" },
      { politeness: "assertive" as const, atomic: false, relevant: "additions" },
      { politeness: "assertive" as const, atomic: false, relevant: "additions" },
    ];
    const issues = m.auditLiveRegions(regions);
    expect(issues.some((i) => i.message.includes("assertive live regions"))).toBe(true);
  });

  it("runScreenReaderAudit: full audit", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const result = m.runScreenReaderAudit({
      landmarks: [
        { role: "banner", hasLabel: true },
        { role: "main", hasLabel: true },
        { role: "contentinfo", hasLabel: true },
      ],
      headings: [
        { level: 1, text: "Title" },
        { level: 2, text: "Section" },
      ],
      images: [
        { src: "logo.png", alt: "Logo" },
      ],
      liveRegions: [
        { politeness: "polite", atomic: false, relevant: "additions" },
      ],
    });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.landmarkCoverage).toBe(100);
    expect(result.headingStructureValid).toBe(true);
    expect(result.imageAltCoverage).toBe(100);
  });

  it("formatScreenReaderAudit", async () => {
    const m = await import("@/lib/screenReaderAudit");
    const result = m.runScreenReaderAudit({
      landmarks: [],
      headings: [],
      images: [],
      liveRegions: [],
    });
    const formatted = m.formatScreenReaderAudit(result);
    expect(formatted).toContain("Screen Reader Audit");
    expect(formatted).toContain("Score:");
    expect(formatted).toContain("Landmark Coverage:");
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("runScreenReaderAudit");
    expect(idx).toContain("auditLandmarks");
    expect(idx).toContain("REQUIRED_LANDMARKS");
  });
});
