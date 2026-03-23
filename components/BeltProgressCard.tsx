"use client";

import Link from "next/link";

/**
 * BeltProgressCard — 帯進捗ビジュアル（参考UI belt-progress.tsx ベース）
 *
 * ダッシュボードBento Grid内に配置。
 * 帯の色ブロック + ストライプインジケーター + 在帯月数を表示。
 */

const BELT_COLORS: Record<string, string> = {
  white: "bg-white/20 ring-1 ring-inset ring-gray-400/50", // #143: outline on dark bg instead of blinding white
  blue: "bg-blue-500",
  purple: "bg-purple-600",
  brown: "bg-amber-700",
  black: "bg-zinc-900 border border-white/20",
};

const BELT_LABELS: Record<string, string> = {
  white: "White Belt",
  blue: "Blue Belt",
  purple: "Purple Belt",
  brown: "Brown Belt",
  black: "Black Belt",
};

type Props = {
  belt: string;
  stripes: number;
  monthsAtBelt: number;
  className?: string;
};

export default function BeltProgressCard({
  belt,
  stripes,
  monthsAtBelt,
  className = "",
}: Props) {
  const beltKey = belt?.toLowerCase() || "white";
  const bgClass = BELT_COLORS[beltKey] || BELT_COLORS.white;
  const label = BELT_LABELS[beltKey] || "White Belt";

  return (
    <div
      className={`bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-white/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold text-zinc-500 tracking-widest">
          Belt Progress
        </span>
        <Link
          href="/profile"
          className="rounded-lg bg-white/5 hover:bg-white/10 p-2 transition-colors"
          title="Edit belt in Profile"
        >
          <svg
            className="w-4 h-4 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </Link>
      </div>

      {/* Belt visual (#86: authentic BJJ belt with promo bar) */}
      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-lg overflow-hidden h-10 w-32 shadow-sm">
          {/* Main belt body */}
          <div className={`flex-1 h-full relative ${bgClass}`}>
            {/* Stripe markers */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`absolute top-0 h-full w-1.5 ${i < stripes ? "bg-white/80" : "bg-white/15"}`}
                style={{ right: `${(i + 1) * 8}px` }}
              />
            ))}
          </div>
          {/* Black promotion bar at the end (authentic BJJ belt tip) */}
          <div className="w-5 h-full bg-black/80 flex-shrink-0" />
        </div>
        <div>
          <p className="text-lg font-bold text-white">{label}</p>
          <p className="text-xs text-zinc-500">
            {stripes} stripe{stripes !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Stripe progress bar (#70) */}
      <div className="mt-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] text-zinc-500">{stripes} / 4 stripes</span>
          <span className="text-[11px] text-zinc-500">{Math.round((stripes / 4) * 100)}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5">
          <div
            className="bg-white/60 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(stripes / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Time at belt */}
      {monthsAtBelt > 0 && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <span className="text-xs text-zinc-500">
            {monthsAtBelt} month{monthsAtBelt !== 1 ? "s" : ""} at {label.replace(" Belt", "")}
          </span>
        </div>
      )}
    </div>
  );
}
