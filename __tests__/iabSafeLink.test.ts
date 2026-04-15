/**
 * Q-32: Verify IABSafeLink component a11y attributes in source.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const filePath = path.resolve(__dirname, "../components/IABSafeLink.tsx");

describe("IABSafeLink a11y", () => {
  const source = fs.readFileSync(filePath, "utf-8");

  it("modal has role=dialog and aria-modal=true", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
  });

  it("modal has aria-label for screen readers", () => {
    expect(source).toContain("aria-label={t(");
  });

  it("modal supports Escape key to close", () => {
    expect(source).toContain('e.key === "Escape"');
  });

  it("copy button has autoFocus for keyboard users", () => {
    expect(source).toContain("autoFocus");
  });

  it("uses text-zinc-* instead of text-gray-* for consistency", () => {
    // Q-29: Migrated from text-gray-400/500 to text-zinc-400/500
    expect(source).not.toContain("text-gray-400");
    expect(source).not.toContain("text-gray-500");
  });
});
