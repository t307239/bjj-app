/**
 * z168: open redirect 防止のテスト。
 *
 * `?next=` param 経由で攻撃者が認証直後にユーザーを外部サイトへ飛ばせない
 * ことを保証する。`safeNextPath` は `app/auth/callback/route.ts` に
 * inlined されているため、ここでは同等のロジックを再現してテストする
 * (実装変更時は両方を更新すること)。
 */
import { describe, it, expect } from "vitest";

const ORIGIN = "https://bjj-app.net";
const FALLBACK = "/records?welcome=1";  // z183: 新規ユーザーは form ある records へ

// ─── ロジックは route.ts と同じ実装を再現 ───
function safeNextPath(next: string | null, origin: string): string {
  if (!next) return FALLBACK;
  if (!next.startsWith("/")) return FALLBACK;
  if (next.startsWith("//") || next.startsWith("/\\")) return FALLBACK;
  if (/^\/+\s*[a-z][a-z0-9+.-]*:/i.test(next)) return FALLBACK;
  try {
    const target = new URL(next, origin);
    if (target.origin !== origin) return FALLBACK;
    return target.pathname + target.search + target.hash;
  } catch {
    return FALLBACK;
  }
}

describe("safeNextPath (z168)", () => {
  describe("safe inputs (allowed)", () => {
    it.each([
      ["/dashboard", "/dashboard"],
      ["/profile?welcome=1", "/profile?welcome=1"],
      ["/wiki/en/closed-guard", "/wiki/en/closed-guard"],
      ["/records#stats", "/records#stats"],
      ["/auth/callback?code=abc", "/auth/callback?code=abc"],
    ])("%s → %s", (input, expected) => {
      expect(safeNextPath(input, ORIGIN)).toBe(expected);
    });
  });

  describe("malicious inputs (rejected → fallback)", () => {
    it.each([
      // Protocol-relative open redirect
      "//evil.com",
      "//evil.com/path",
      // Backslash trick
      "/\\evil.com",
      // Embedded scheme
      "/javascript:alert(1)",
      "/  javascript:alert(1)", // leading spaces
      "/data:text/html,<script>alert(1)</script>",
      // Absolute URL
      "https://evil.com",
      "http://evil.com",
      "ftp://evil.com",
      // Missing leading slash
      "evil.com",
      "dashboard",
      // Schemeless host abuse
      "//attacker@evil.com/",
    ])("%s → fallback", (input) => {
      expect(safeNextPath(input, ORIGIN)).toBe(FALLBACK);
    });
  });

  describe("edge cases", () => {
    it("null → fallback", () => {
      expect(safeNextPath(null, ORIGIN)).toBe(FALLBACK);
    });
    it("empty string → fallback", () => {
      expect(safeNextPath("", ORIGIN)).toBe(FALLBACK);
    });
    it("plain '/' → '/'", () => {
      expect(safeNextPath("/", ORIGIN)).toBe("/");
    });
    it("preserves query + hash", () => {
      expect(safeNextPath("/profile?tab=body#weight", ORIGIN)).toBe(
        "/profile?tab=body#weight",
      );
    });
  });
});
