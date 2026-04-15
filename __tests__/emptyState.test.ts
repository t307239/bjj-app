/**
 * Q-28: Verify EmptyState component file exports and structure.
 * Cannot DOM-render TSX without @testing-library/react + jsdom,
 * so we verify the module contract at the source level.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const filePath = path.resolve(__dirname, "../components/EmptyState.tsx");

describe("EmptyState module", () => {
  const source = fs.readFileSync(filePath, "utf-8");

  it("file exists", () => {
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("has 'use client' directive", () => {
    expect(source.startsWith('"use client"')).toBe(true);
  });

  it("has role=status for a11y", () => {
    expect(source).toContain('role="status"');
  });

  it("exports a default function component", () => {
    expect(source).toContain("export default function EmptyState");
  });

  it("supports emoji, title, description, hints, action, linkAction, compact props", () => {
    expect(source).toContain("emoji:");
    expect(source).toContain("title:");
    expect(source).toContain("description?:");
    expect(source).toContain("hints?:");
    expect(source).toContain("action?:");
    expect(source).toContain("linkAction?:");
    expect(source).toContain("compact?:");
  });
});
