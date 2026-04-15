/**
 * Q-28: Verify Toast component a11y attributes in source.
 * Cannot DOM-render TSX without @testing-library, so we verify
 * the source code contract.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const filePath = path.resolve(__dirname, "../components/Toast.tsx");

describe("Toast a11y", () => {
  const source = fs.readFileSync(filePath, "utf-8");

  it("has dynamic role (alert for error, status for success)", () => {
    expect(source).toContain('role={type === "error" ? "alert" : "status"}');
  });

  it("has dynamic aria-live (assertive for error, polite for success)", () => {
    expect(source).toContain('aria-live={type === "error" ? "assertive" : "polite"}');
  });

  it("has use client directive", () => {
    expect(source.startsWith('"use client"')).toBe(true);
  });

  it("supports success and error types", () => {
    expect(source).toContain('"success" | "error"');
  });

  it("supports onUndo callback", () => {
    expect(source).toContain("onUndo?:");
  });
});
