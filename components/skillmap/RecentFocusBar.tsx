"use client";

import type { Node } from "@xyflow/react";

type Props = {
  nodes: Node[];
  recentIds: string[];
  onFocus: (id: string) => void;
  t: (k: string) => string;
};

export default function RecentFocusBar({ nodes, recentIds, onFocus, t }: Props) {
  const visible = recentIds.filter((id) => nodes.some((n) => n.id === id));
  if (visible.length === 0) return null;

  return (
    <div
      className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-0.5"
      style={{ scrollbarWidth: "none" }}
    >
      <span className="flex-shrink-0 text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
        {t("skillmap.recentFocus")}
      </span>
      {visible.map((id) => {
        const node = nodes.find((n) => n.id === id);
        if (!node) return null;
        const label = String((node.data as { label?: unknown }).label ?? "");
        return (
          <button type="button"
            key={id}
            onClick={() => onFocus(id)}
            className="flex-shrink-0 text-xs bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 hover:text-white px-2.5 py-0.5 rounded-full transition-all active:scale-95 max-w-[140px] truncate"
            title={label}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
