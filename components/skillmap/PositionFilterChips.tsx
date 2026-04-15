"use client";

import { PRESET_POSITIONS } from "./constants";

type Props = {
  usedTags: Set<string>;
  customTags: string[];
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  tagsExpanded: boolean;
  setTagsExpanded: (fn: (v: boolean) => boolean) => void;
  visibleTagCount: number;
  t: (k: string) => string;
};

export default function PositionFilterChips({
  usedTags,
  customTags,
  selectedTag,
  setSelectedTag,
  tagsExpanded,
  setTagsExpanded,
  visibleTagCount,
  t,
}: Props) {
  const allTags = [...PRESET_POSITIONS.filter((tag) => usedTags.has(tag)), ...customTags];
  const hasMore = allTags.length > visibleTagCount;
  const visibleTags = hasMore && !tagsExpanded ? allTags.slice(0, visibleTagCount) : allTags;
  const hiddenCount = allTags.length - visibleTagCount;
  const selectedInHidden = hasMore && !tagsExpanded && selectedTag !== null && !visibleTags.includes(selectedTag);

  return (
    <div
      className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-0.5"
      style={{ scrollbarWidth: "none" }}
    >
      <button
        onClick={() => setSelectedTag(null)}
        className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
          !selectedTag
            ? "bg-indigo-600 border-indigo-500 text-white font-semibold"
            : "bg-zinc-800 border-white/10 text-zinc-400 hover:border-white/30"
        }`}
      >
        {t("skillmap.filterAll")}
      </button>
      {visibleTags.map((tag) => (
        <button
          key={tag}
          onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
          className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
            selectedTag === tag
              ? "bg-indigo-600 border-indigo-500 text-white font-semibold"
              : usedTags.has(tag)
                ? "bg-zinc-800 border-white/20 text-zinc-300 hover:border-white/40"
                : "bg-zinc-900 border-white/8 text-zinc-600"
          }`}
        >
          {tag}
        </button>
      ))}
      {hasMore && (
        <button
          onClick={() => setTagsExpanded((v) => !v)}
          className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
            selectedInHidden
              ? "bg-indigo-900/60 border-indigo-500/60 text-indigo-300 hover:border-indigo-400"
              : "bg-zinc-800 border-white/10 text-zinc-400 hover:border-white/30"
          }`}
        >
          {tagsExpanded ? "▲" : `▼ +${hiddenCount}`}
        </button>
      )}
    </div>
  );
}
