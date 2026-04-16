/**
 * wikiSubmitVideo — validation logic tests
 *
 * Tests for input validation rules used in app/api/wiki/submit-video/route.ts.
 * Pure validation logic is re-implemented since route handlers need Next.js runtime.
 */
import { describe, it, expect } from "vitest";

// ── Re-implement validation rules (mirrors submit-video/route.ts) ──────────

const VALID_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const VALID_LANGS = ["en", "ja", "pt"];

function validateSlug(slug: unknown): boolean {
  return typeof slug === "string" && slug.length > 0 && slug.length <= 200;
}

function validateLang(lang: unknown): boolean {
  return typeof lang === "string" && VALID_LANGS.includes(lang);
}

function validateYoutubeUrl(url: unknown): boolean {
  return typeof url === "string" && url.length > 0 && url.length <= 300;
}

function validateVideoId(id: unknown): boolean {
  return typeof id === "string" && VALID_VIDEO_ID.test(id);
}

// ── VALID_VIDEO_ID regex ────────────────────────────────────────────────────

describe("VALID_VIDEO_ID", () => {
  it("accepts standard 11-char YouTube ID", () => {
    expect(VALID_VIDEO_ID.test("dQw4w9WgXcQ")).toBe(true);
  });

  it("accepts ID with underscores", () => {
    expect(VALID_VIDEO_ID.test("abc_def_123")).toBe(true);
  });

  it("accepts ID with hyphens", () => {
    expect(VALID_VIDEO_ID.test("abc-def-123")).toBe(true);
  });

  it("rejects too short (10 chars)", () => {
    expect(VALID_VIDEO_ID.test("dQw4w9WgXc")).toBe(false);
  });

  it("rejects too long (12 chars)", () => {
    expect(VALID_VIDEO_ID.test("dQw4w9WgXcQQ")).toBe(false);
  });

  it("rejects special characters", () => {
    expect(VALID_VIDEO_ID.test("dQw4w9!gXcQ")).toBe(false);
  });

  it("rejects spaces", () => {
    expect(VALID_VIDEO_ID.test("dQw4w9 gXcQ")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(VALID_VIDEO_ID.test("")).toBe(false);
  });
});

// ── validateSlug ────────────────────────────────────────────────────────────

describe("validateSlug", () => {
  it("accepts valid slug", () => {
    expect(validateSlug("closed-guard-basics")).toBe(true);
  });

  it("accepts Japanese slug", () => {
    expect(validateSlug("クローズドガード")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateSlug("")).toBe(false);
  });

  it("rejects string over 200 chars", () => {
    expect(validateSlug("a".repeat(201))).toBe(false);
  });

  it("rejects non-string", () => {
    expect(validateSlug(null)).toBe(false);
    expect(validateSlug(123)).toBe(false);
    expect(validateSlug(undefined)).toBe(false);
  });
});

// ── validateLang ────────────────────────────────────────────────────────────

describe("validateLang", () => {
  it("accepts 'en'", () => {
    expect(validateLang("en")).toBe(true);
  });

  it("accepts 'ja'", () => {
    expect(validateLang("ja")).toBe(true);
  });

  it("accepts 'pt'", () => {
    expect(validateLang("pt")).toBe(true);
  });

  it("rejects unsupported language", () => {
    expect(validateLang("fr")).toBe(false);
    expect(validateLang("es")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateLang("")).toBe(false);
  });

  it("rejects non-string", () => {
    expect(validateLang(null)).toBe(false);
    expect(validateLang(42)).toBe(false);
  });
});

// ── validateYoutubeUrl ──────────────────────────────────────────────────────

describe("validateYoutubeUrl", () => {
  it("accepts valid YouTube URL", () => {
    expect(validateYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  it("accepts short YouTube URL", () => {
    expect(validateYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateYoutubeUrl("")).toBe(false);
  });

  it("rejects string over 300 chars", () => {
    expect(validateYoutubeUrl("https://youtube.com/" + "a".repeat(300))).toBe(false);
  });

  it("rejects non-string", () => {
    expect(validateYoutubeUrl(null)).toBe(false);
  });
});

// ── validateVideoId ─────────────────────────────────────────────────────────

describe("validateVideoId", () => {
  it("accepts valid 11-char ID", () => {
    expect(validateVideoId("dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects null", () => {
    expect(validateVideoId(null)).toBe(false);
  });

  it("rejects number", () => {
    expect(validateVideoId(12345678901)).toBe(false);
  });

  it("rejects XSS attempt", () => {
    expect(validateVideoId("<script>xss")).toBe(false);
  });
});
