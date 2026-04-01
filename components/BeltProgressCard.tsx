"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n";

/**
 * BeltProgressCard — 帯進捗ビジュアル
 *
 * Item 4:  スキューモーフィック帯デザイン（布テクスチャ風グラデーション + 縫い目ライン）
 * Item 24: ストライプ≥3（75%）で Hypeモード — バーがグロー＆パルスして道場に行きたくなる
 */

// Per-belt gradient (fabric depth illusion) + hype glow color
const BELT_STYLES: Record<string, { bar: string; glow: string }> = {
  white: {
    bar: "linear-gradient(180deg,#f4f4f5 0%,#d4d4d8 35%,#fafafa 55%,#e4e4e7 100%)",
    glow: "rgba(255,255,255,0.45)",
  },
  blue: {
    bar: "linear-gradient(180deg,#60a5fa 0%,#1d4ed8 38%,#3b82f6 55%,#1e3a8a 100%)",
    glow: "rgba(59,130,246,0.55)",
  },
  purple: {
    bar: "linear-gradient(180deg,#c084fc 0%,#6b21a8 38%,#9333ea 55%,#4a044e 100%)",
    glow: "rgba(147,51,234,0.55)",
  },
  brown: {
    bar: "linear-gradient(180deg,#d97706 0%,#451a03 38%,#92400e 55%,#292524 100%)",
    glow: "rgba(146,64,14,0.55)",
  },
  black: {
    bar: "linear-gradient(180deg,#52525b 0%,#09090b 38%,#27272a 55%,#000000 100%)",
    glow: "rgba(255,255,255,0.18)",
  },
};

// Progress bar gradient per belt
const PROGRESS_STYLE: Record<string, string> = {
  white: "linear-gradient(90deg,#d4d4d8,#ffffff)",
  blue:  "linear-gradient(90deg,#3b82f6,#38bdf8)",
  purple:"linear-gradient(90deg,#9333ea,#c084fc)",
  brown: "linear-gradient(90deg,#92400e,#d97706)",
  black: "linear-gradient(90deg,#52525b,#d4d4d8)",
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
  const { t } = useLocale();

  const BELT_LABELS: Record<string, string> = {
    white:  t("dashboard.beltWhite"),
    blue:   t("dashboard.beltBlue"),
    purple: t("dashboard.beltPurple"),
    brown:  t("dashboard.beltBrown"),
    black:  t("dashboard.beltBlack"),
  };

  const beltKey   = belt?.toLowerCase() || "white";
  const bStyle    = BELT_STYLES[beltKey] ?? BELT_STYLES.white;
  const pStyle    = PROGRESS_STYLE[beltKey] ?? PROGRESS_STYLE.white;
  const label     = BELT_LABELS[beltKey] || t("dashboard.beltWhite");
  const pct       = Math.round((stripes / 4) * 100);

  // Item 24: Hype mode at ≥75% (3 stripes). Black belt already maxed.
  const isHype = stripes >= 3 && beltKey !== "black";

  return (
    <div
      className={`bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-5 border transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 ${
        isHype ? "border-yellow-400/40" : "border-white/10 hover:border-white/20"
      } ${className}`}
      style={isHype ? { boxShadow: `0 0 28px ${bStyle.glow}` } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 tracking-widest">
            {t("beltProgress.title")}
          </span>
          {isHype && (
            <span className="text-xs font-bold text-yellow-400 animate-pulse">
              🔥 Almost there!
            </span>
          )}
        </div>
        <Link
          href="/profile"
          className="rounded-xl bg-white/5 hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          title={t("beltProgress.editTitle")}
          aria-label={t("beltProgress.editTitle")}
        >
          <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </Link>
      </div>

      {/* ── Item 4: Skeuomorphic belt ── */}
      <div className="flex items-center gap-4">
        {/* Belt body */}
        <div
          className="flex items-stretch rounded-md overflow-hidden flex-shrink-0"
          style={{
            height: 40,
            width: 136,
            boxShadow: "0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          {/* Main belt — gradient fakes woven fabric depth */}
          <div className="flex-1 relative overflow-hidden" style={{ background: bStyle.bar }}>
            {/* Stitching lines (top + bottom seams) */}
            <div className="absolute top-1 left-0 right-0 h-px bg-white/15" />
            <div className="absolute bottom-1 left-0 right-0 h-px bg-black/25" />
            {/* White-tape stripe markers */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full"
                style={{
                  width: 7,
                  right: (i + 1) * 11,
                  background: i < stripes
                    ? "linear-gradient(180deg,rgba(255,255,255,0.95) 0%,rgba(255,255,255,0.65) 50%,rgba(255,255,255,0.90) 100%)"
                    : "rgba(255,255,255,0.08)",
                  boxShadow: i < stripes ? "0 0 4px rgba(255,255,255,0.4)" : "none",
                }}
              />
            ))}
          </div>
          {/* Black promotion tip */}
          <div
            className="flex-shrink-0 h-full"
            style={{
              width: 22,
              background: "linear-gradient(180deg,#3f3f46 0%,#000000 100%)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
            }}
          />
        </div>

        <div>
          <p className="text-lg font-bold text-white">{label}</p>
          <p className="text-xs text-zinc-500">
            {t("beltProgress.stripesOf4", { n: stripes })}
          </p>
        </div>
      </div>

      {/* ── Stripe progress bar (Item 24: hype glow + pulse at ≥75%) ── */}
      <div className="w-full h-2.5 bg-zinc-800 rounded-full mt-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isHype ? "animate-pulse" : ""}`}
          style={{
            width: `${pct}%`,
            background: pStyle,
            boxShadow: isHype ? `0 0 12px ${bStyle.glow}, 0 0 24px ${bStyle.glow}` : "none",
          }}
        />
      </div>
      <div className="flex justify-between items-center mt-2 text-xs text-zinc-500">
        <span>{t("beltProgress.stripesOf4", { n: stripes })}</span>
        <span className={isHype ? "text-yellow-400 font-bold animate-pulse" : ""}>
          {pct}%{isHype ? " 🔥" : ""}
        </span>
      </div>

      {/* Time at belt — years+months format */}
      {monthsAtBelt > 0 && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <span className="text-xs text-zinc-500">
            {(() => {
              const yrs = Math.floor(monthsAtBelt / 12);
              const mos = monthsAtBelt % 12;
              let dur = "";
              if (yrs === 0) dur = t("profile.bjjHistoryMonths", { n: mos });
              else if (mos === 0) dur = t("profile.bjjHistoryYears", { n: yrs });
              else dur = t("profile.bjjHistoryYearsMonths", { y: yrs, m: mos });
              return dur;
            })()} {t("beltProgress.monthsAt", { belt: label.replace(t("beltProgress.beltSuffix"), "") })}
          </span>
        </div>
      )}
    </div>
  );
}
