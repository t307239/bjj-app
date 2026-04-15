/**
 * Q-32: Verify Wiki OG image i18n for "Free forever" text.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const filePath = path.resolve(__dirname, "../app/wiki/[lang]/[slug]/opengraph-image.tsx");

describe("Wiki OG image i18n", () => {
  const source = fs.readFileSync(filePath, "utf-8");

  it("renders localized text for Japanese", () => {
    expect(source).toContain('lang === "ja"');
    expect(source).toContain("ずっと無料");
  });

  it("renders localized text for Portuguese", () => {
    expect(source).toContain('lang === "pt"');
    expect(source).toContain("Grátis para sempre");
  });

  it("falls back to English", () => {
    expect(source).toContain("Free forever");
  });
});
