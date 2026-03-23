import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Technique = {
  id: string;
  name: string;
  category: string;
  mastery_level: number;
  notes: string;
  created_at: string;
};

export type TechniqueFormState = {
  name: string;
  category: string;
  mastery_level: number;
  notes: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

export const CATEGORY_VALUES = [
  "guard", "passing", "submissions", "takedowns",
  "escapes", "back", "mount", "other",
];

export const MASTERY_COLORS = [
  "", "text-gray-400", "text-blue-400", "text-yellow-400",
  "text-orange-400", "text-green-400",
];

export const NOTE_TRUNCATE = 80;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** 相対日付ヘルパー */
export function relativeDate(
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
  if (diffDays < 30) return t("techniques.addedWeeksAgo", { n: Math.floor(diffDays / 7) });
  if (diffDays < 365) return t("techniques.addedMonthsAgo", { n: Math.floor(diffDays / 30) });
  return t("techniques.addedYearsAgo", { n: Math.floor(diffDays / 365) });
}

/** YouTube URLからvideoIdを抽出 */
export function extractYoutubeId(url: string): string | null {
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

/** URLを検出してリンク化（YouTube は🎬サムネイル表示） */
export function renderNotes(notes: string, expanded: boolean): React.ReactNode {
  const display =
    !expanded && notes.length > NOTE_TRUNCATE
      ? notes.slice(0, NOTE_TRUNCATE) + "…"
      : notes;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = display.split(urlRegex);

  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      const isYoutube =
        part.includes("youtube.com") || part.includes("youtu.be");
      if (isYoutube) {
        const videoId = extractYoutubeId(part);
        return (
          <span key={i} className="inline-block mt-1 w-full">
            <a
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border border-white/10 hover:border-white/10 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {videoId ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                    alt="YouTube thumbnail"
                    className="w-full h-auto rounded-lg"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/60 rounded-full w-10 h-10 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white ml-0.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : null}
            </a>
          </span>
        );
      }
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
