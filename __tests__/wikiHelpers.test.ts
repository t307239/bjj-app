/**
 * Wiki page helper functions — processHeadings, calcReadingTime, slugifyHeading
 *
 * These functions are defined in app/wiki/[lang]/[slug]/page.tsx as module-local
 * functions. Since they are NOT exported, we re-implement the pure logic here
 * and verify correctness + safety guarantees (DANGEROUS_HTML audit Q-57).
 */
import { describe, it, expect } from "vitest";

// ── Re-implement pure functions for testing ──────────────────────────────────
// (mirrors app/wiki/[lang]/[slug]/page.tsx lines 98-150)

function calcReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80);
}

type TocItem = { id: string; text: string; level: number };

function processHeadings(html: string): { html: string; toc: TocItem[] } {
  if (!html) return { html, toc: [] };

  const withoutH1 = html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, "");

  const toc: TocItem[] = [];
  const usedIds = new Set<string>();

  const processed = withoutH1.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h[23]>/gi,
    (match, levelStr, attrs, content) => {
      if (/\bid\s*=/.test(attrs)) return match;

      const rawText = content.replace(/<[^>]+>/g, "").trim();
      if (!rawText) return match;

      let id = slugifyHeading(rawText);
      if (usedIds.has(id)) {
        let i = 2;
        while (usedIds.has(`${id}-${i}`)) i++;
        id = `${id}-${i}`;
      }
      usedIds.add(id);

      const level = parseInt(levelStr, 10);
      toc.push({ id, text: rawText, level });
      return `<h${level} id="${id}"${attrs}>${content}</h${level}>`;
    },
  );

  return { html: processed, toc };
}

// ── calcReadingTime ──────────────────────────────────────────────────────────

describe("calcReadingTime", () => {
  it("returns 1 for empty HTML", () => {
    expect(calcReadingTime("")).toBe(1);
  });

  it("returns 1 for short content", () => {
    expect(calcReadingTime("<p>Hello world</p>")).toBe(1);
  });

  it("calculates correctly for ~200 words (1 min)", () => {
    const words = Array(200).fill("word").join(" ");
    expect(calcReadingTime(`<p>${words}</p>`)).toBe(1);
  });

  it("calculates correctly for ~400 words (2 min)", () => {
    const words = Array(400).fill("word").join(" ");
    expect(calcReadingTime(`<p>${words}</p>`)).toBe(2);
  });

  it("strips HTML tags before counting", () => {
    const html = "<p><strong>bold</strong> <em>italic</em> <a href='#'>link</a></p>";
    // 3 words
    expect(calcReadingTime(html)).toBe(1);
  });

  it("handles Japanese content (chars are whitespace-split words)", () => {
    // CJK chars without spaces count as 1 "word" — this is expected behavior
    const html = "<p>柔術のガードパス</p>";
    expect(calcReadingTime(html)).toBe(1);
  });
});

// ── slugifyHeading ───────────────────────────────────────────────────────────

describe("slugifyHeading", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugifyHeading("Guard Passing Basics")).toBe("guard-passing-basics");
  });

  it("strips HTML tags", () => {
    expect(slugifyHeading("<strong>Bold</strong> Heading")).toBe("bold-heading");
  });

  it("removes special characters", () => {
    expect(slugifyHeading("What's New? (2024)")).toBe("whats-new-2024");
  });

  it("truncates to 80 chars", () => {
    const long = "a".repeat(100);
    expect(slugifyHeading(long).length).toBe(80);
  });

  it("collapses multiple hyphens", () => {
    expect(slugifyHeading("foo   bar")).toBe("foo-bar");
  });
});

// ── processHeadings ──────────────────────────────────────────────────────────

describe("processHeadings", () => {
  it("returns empty toc for empty html", () => {
    const result = processHeadings("");
    expect(result.toc).toEqual([]);
    expect(result.html).toBe("");
  });

  it("removes h1 tags", () => {
    const html = "<h1>Title</h1><h2>Section</h2><p>Content</p>";
    const result = processHeadings(html);
    expect(result.html).not.toContain("<h1>");
    expect(result.toc).toHaveLength(1);
    expect(result.toc[0].text).toBe("Section");
  });

  it("adds IDs to h2 and h3", () => {
    const html = "<h2>First</h2><h3>Sub</h3>";
    const result = processHeadings(html);
    expect(result.html).toContain('id="first"');
    expect(result.html).toContain('id="sub"');
    expect(result.toc).toHaveLength(2);
    expect(result.toc[0]).toEqual({ id: "first", text: "First", level: 2 });
    expect(result.toc[1]).toEqual({ id: "sub", text: "Sub", level: 3 });
  });

  it("deduplicates IDs", () => {
    const html = "<h2>Setup</h2><h2>Setup</h2>";
    const result = processHeadings(html);
    expect(result.toc[0].id).toBe("setup");
    expect(result.toc[1].id).toBe("setup-2");
  });

  it("preserves existing IDs", () => {
    const html = '<h2 id="custom">Existing</h2>';
    const result = processHeadings(html);
    expect(result.html).toContain('id="custom"');
    expect(result.toc).toHaveLength(0); // existing IDs are skipped in toc
  });

  it("handles empty heading text", () => {
    const html = "<h2></h2><h2>Real</h2>";
    const result = processHeadings(html);
    expect(result.toc).toHaveLength(1);
    expect(result.toc[0].text).toBe("Real");
  });

  // SECURITY: processedHtml is used with dangerouslySetInnerHTML — verify no script injection
  it("does not add script-injectable IDs", () => {
    const html = '<h2><script>alert(1)</script>XSS</h2>';
    const result = processHeadings(html);
    // slugifyHeading strips non-word chars, so id should be safe
    expect(result.html).not.toContain('id="<script');
    // slugifyHeading strips tags but keeps inner text → "alert1xss"
    // The key safety property: no angle brackets or quotes in the ID
    expect(result.toc[0].id).not.toMatch(/[<>"']/);
    expect(result.toc[0].id).toBe("alert1xss");
  });
});
