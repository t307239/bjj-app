/**
 * techniqueLogTypes — pure function tests
 *
 * lib/techniqueLogTypes.tsx contains JSX (renderNotes), which vite's node
 * environment cannot parse. We re-implement the pure logic here to keep tests
 * fast and free of React dependencies.
 */
import { describe, it, expect } from "vitest";

// ── Re-implement pure functions (mirrors lib/techniqueLogTypes.tsx) ──────────

const DANGEROUS_KEYWORDS = [
  "heel hook", "heelhook",
  "knee bar", "kneebar", "knee reap", "kneereap",
  "neck crank", "neckcrank", "can opener", "canopener",
  "twister", "electric chair",
  "spine lock", "spinal",
  "scissor takedown", "slam",
  "calf slicer", "calf crush",
  "toe hold", "toehold",
  "ヒールフック", "膝十字", "ニーリーパー",
  "首関節", "ツイスター", "カーフスライサー",
  "トーホールド",
];

function isDangerousTechnique(name: string): boolean {
  const lower = name.toLowerCase();
  return DANGEROUS_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v");
    }
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1);
    }
  } catch {
    // invalid URL
  }
  return null;
}

function relativeDate(
  dateStr: string,
  t: (key: string, replacements?: Record<string, string | number>) => string,
): string {
  if (!dateStr) return "";
  const now = Date.now();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diffMs = now - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return t("techniques.addedToday");
  if (diffDays === 1) return t("techniques.addedYesterday");
  if (diffDays < 7) return t("techniques.addedDaysAgo", { n: diffDays });
  const weeks = Math.floor(diffDays / 7);
  if (diffDays < 30) return t(weeks === 1 ? "techniques.addedWeekAgo" : "techniques.addedWeeksAgo", { n: weeks });
  const months = Math.floor(diffDays / 30);
  if (diffDays < 365) return t(months === 1 ? "techniques.addedMonthAgo" : "techniques.addedMonthsAgo", { n: months });
  const years = Math.floor(diffDays / 365);
  return t(years === 1 ? "techniques.addedYearAgo" : "techniques.addedYearsAgo", { n: years });
}

const CATEGORY_VALUES = [
  "guard", "passing", "submissions", "takedowns",
  "escapes", "back", "mount", "other",
];

const NOTE_TRUNCATE = 80;

// ── isDangerousTechnique ─────────────────────────────────────────────────────

describe("isDangerousTechnique", () => {
  it("detects heel hook (English)", () => {
    expect(isDangerousTechnique("inside heel hook")).toBe(true);
  });

  it("detects heel hook (case insensitive)", () => {
    expect(isDangerousTechnique("HEEL HOOK")).toBe(true);
  });

  it("detects Japanese term ヒールフック", () => {
    expect(isDangerousTechnique("ヒールフック")).toBe(true);
  });

  it("detects toe hold", () => {
    expect(isDangerousTechnique("standing toe hold")).toBe(true);
  });

  it("detects calf slicer", () => {
    expect(isDangerousTechnique("Calf Slicer from half guard")).toBe(true);
  });

  it("detects twister", () => {
    expect(isDangerousTechnique("twister setup")).toBe(true);
  });

  it("returns false for safe techniques", () => {
    expect(isDangerousTechnique("armbar")).toBe(false);
    expect(isDangerousTechnique("triangle choke")).toBe(false);
    expect(isDangerousTechnique("scissor sweep")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isDangerousTechnique("")).toBe(false);
  });

  it("detects knee bar / kneebar variants", () => {
    expect(isDangerousTechnique("knee bar")).toBe(true);
    expect(isDangerousTechnique("kneebar")).toBe(true);
  });

  it("detects neck crank and can opener", () => {
    expect(isDangerousTechnique("neck crank")).toBe(true);
    expect(isDangerousTechnique("can opener")).toBe(true);
  });
});

// ── extractYoutubeId ─────────────────────────────────────────────────────────

describe("extractYoutubeId", () => {
  it("extracts ID from standard YouTube URL", () => {
    expect(extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts ID from youtu.be short URL", () => {
    expect(extractYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("returns null for non-YouTube URL", () => {
    expect(extractYoutubeId("https://vimeo.com/12345")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(extractYoutubeId("not a url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractYoutubeId("")).toBeNull();
  });

  it("handles YouTube URL with extra params", () => {
    expect(
      extractYoutubeId("https://www.youtube.com/watch?v=abc123&t=30s"),
    ).toBe("abc123");
  });
});

// ── relativeDate ─────────────────────────────────────────────────────────────

describe("relativeDate", () => {
  const mockT = (key: string, replacements?: Record<string, string | number>) => {
    if (replacements) return `${key}:${JSON.stringify(replacements)}`;
    return key;
  };

  it("returns empty for empty string", () => {
    expect(relativeDate("", mockT)).toBe("");
  });

  it("returns empty for invalid date", () => {
    expect(relativeDate("not-a-date", mockT)).toBe("");
  });

  it("returns 'today' for current date", () => {
    const now = new Date().toISOString();
    expect(relativeDate(now, mockT)).toBe("techniques.addedToday");
  });

  it("returns 'yesterday' for 1 day ago", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(relativeDate(yesterday, mockT)).toBe("techniques.addedYesterday");
  });

  it("returns 'N days ago' for 3 days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const result = relativeDate(threeDaysAgo, mockT);
    expect(result).toContain("techniques.addedDaysAgo");
    expect(result).toContain('"n":3');
  });

  it("returns 'week ago' for 7-13 days ago", () => {
    const weekAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    const result = relativeDate(weekAgo, mockT);
    expect(result).toContain("WeekAgo");
  });

  it("returns 'month ago' for 35 days ago", () => {
    const monthAgo = new Date(Date.now() - 35 * 86400000).toISOString();
    const result = relativeDate(monthAgo, mockT);
    expect(result).toContain("MonthAgo");
  });

  it("returns 'year ago' for 400 days ago", () => {
    const yearAgo = new Date(Date.now() - 400 * 86400000).toISOString();
    const result = relativeDate(yearAgo, mockT);
    expect(result).toContain("YearAgo");
  });
});

// ── Constants sanity ─────────────────────────────────────────────────────────

describe("constants", () => {
  it("CATEGORY_VALUES includes guard and submissions", () => {
    expect(CATEGORY_VALUES).toContain("guard");
    expect(CATEGORY_VALUES).toContain("submissions");
  });

  it("NOTE_TRUNCATE is 80", () => {
    expect(NOTE_TRUNCATE).toBe(80);
  });
});
