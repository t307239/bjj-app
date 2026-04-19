"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n";

/**
 * BeltProgressCard — 帯進捗ビジュアル
 *
 * v2: Hypeモード削除。柔術歴+帯在籍期間の2軸表示。帯履歴タイムライン追加。
 *     animate-pulse/グロー演出なし。事実ベースの静かなUI。
 */

// Per-belt gradient (fabric depth illusion)
const BELT_STYLES: Record<string, { bar: string }> = {
  white: {
    bar: "linear-gradient(180deg,#f4f4f5 0%,#d4d4d8 35%,#fafafa 55%,#e4e4e7 100%)",
  },
  blue: {
    bar: "linear-gradient(180deg,#60a5fa 0%,#1d4ed8 38%,#3b82f6 55%,#1e3a8a 100%)",
  },
  purple: {
    bar: "linear-gradient(180deg,#c084fc 0%,#6b21a8 38%,#9333ea 55%,#4a044e 100%)",
  },
  brown: {
    bar: "linear-gradient(180deg,#d97706 0%,#451a03 38%,#92400e 55%,#292524 100%)",
  },
  black: {
    bar: "linear-gradient(180deg,#52525b 0%,#09090b 38%,#27272a 55%,#000000 100%)",
  },
};

// Progress bar gradient per belt
const PROGRESS_STYLE: Record<string, string> = {
  white: "linear-gradient(90deg,#d4d4d8,#ffffff)",
  blue: "linear-gradient(90deg,#3b82f6,#38bdf8)",
  purple: "linear-gradient(90deg,#9333ea,#c084fc)",
  brown: "linear-gradient(90deg,#92400e,#d97706)",
  black: "linear-gradient(90deg,#52525b,#d4d4d8)",
};

// Belt order for timeline
const BELT_ORDER = ["white", "blue", "purple", "brown", "black"] as const;

type BeltHistoryEntry = {
  belt: string;
  promoted_at: string;
  notes?: string | null;
};

type Props = {
  belt: string;
  stripes: number;
  monthsAtBelt: number;
  bjjStartDate: string | null;
  beltHistory: BeltHistoryEntry[];
  className?: string;
};

/** Format duration from a date string to now as "Xy Zm" */
function formatDuration(dateStr: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const start = new Date(dateStr);
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // JST
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  if (months < 0) months = 0;

  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  if (yrs === 0) return t("profile.bjjHistoryMonths", { n: mos || 1 });
  if (mos === 0) return t("profile.bjjHistoryYears", { n: yrs });
  return t("profile.bjjHistoryYearsMonths", { y: yrs, m: mos });
}

export default function BeltProgressCard({
  belt,
  stripes,
  monthsAtBelt,
  bjjStartDate,
  beltHistory,
  className = "",
}: Props) {
  const { t } = useLocale();

  const BELT_LABELS: Record<string, string> = {
    white: t("dashboard.beltWhite"),
    blue: t("dashboard.beltBlue"),
    purple: t("dashboard.beltPurple"),
    brown: t("dashboard.beltBrown"),
    black: t("dashboard.beltBlack"),
  };

  const beltKey = belt?.toLowerCase() || "white";
  const bStyle = BELT_STYLES[beltKey] ?? BELT_STYLES.white;
  const pStyle = PROGRESS_STYLE[beltKey] ?? PROGRESS_STYLE.white;
  const label = BELT_LABELS[beltKey] || t("dashboard.beltWhite");
  const pct = Math.round((stripes / 4) * 100);

  // Sort belt history by BELT_ORDER for display
  const sortedHistory = [...beltHistory].sort(
    (a, b) => BELT_ORDER.indexOf(a.belt as typeof BELT_ORDER[number]) - BELT_ORDER.indexOf(b.belt as typeof BELT_ORDER[number])
  );

  return (
    <div
      className={`bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-zinc-500 tracking-widest">
          {t("beltProgress.title")}
        </span>
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

      {/* Belt visual + info */}
      <div className="flex items-center gap-4">
        {/* Belt body — 3-part: belt color → black bar → belt color */}
        <div
          className="flex items-stretch rounded-md overflow-hidden flex-shrink-0"
          style={{
            height: 40,
            width: 164,
            boxShadow: "0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex-1 relative overflow-hidden" style={{ background: bStyle.bar }}>
            <div className="absolute top-1 left-0 right-0 h-px bg-white/15" />
            <div className="absolute bottom-1 left-0 right-0 h-px bg-black/25" />
          </div>
          <div
            className="flex-shrink-0 h-full relative"
            style={{
              width: 48,
              background: "linear-gradient(180deg,#3f3f46 0%,#18181b 50%,#000000 100%)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              borderRight: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => {
              const isEarned = i < stripes;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full"
                  style={{
                    width: 6,
                    left: 6 + i * 10,
                    backgroundColor: isEarned ? "#ffffff" : "#27272a",
                    boxShadow: isEarned ? "0 0 6px rgba(255,255,255,0.5)" : "none",
                  }}
                />
              );
            })}
          </div>
          <div className="relative overflow-hidden" style={{ width: 24, background: bStyle.bar }}>
            <div className="absolute top-1 left-0 right-0 h-px bg-white/15" />
            <div className="absolute bottom-1 left-0 right-0 h-px bg-black/25" />
          </div>
        </div>

        <div>
          <p className="text-lg font-bold text-white">{label}</p>
          <p className="text-xs text-zinc-500">
            {t("beltProgress.stripesOf4", { n: stripes })}
          </p>
        </div>
      </div>

      {/* Stripe progress bar */}
      <div className="w-full h-2.5 bg-zinc-800 rounded-full mt-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: pStyle }}
        />
      </div>
      <div className="flex justify-between items-center mt-2 text-xs text-zinc-500">
        <span>{t("beltProgress.stripesOf4", { n: stripes })}</span>
        <span>{pct}%</span>
      </div>

      {/* Duration section: BJJ history + time at current belt */}
      <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
        {bjjStartDate && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">{t("beltProgress.bjjHistory")}</span>
            <span className="text-zinc-300 font-medium tabular-nums">
              {formatDuration(bjjStartDate, t)}
            </span>
          </div>
        )}
        {monthsAtBelt > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              {t("beltProgress.timeAtBelt", { belt: label.replace(t("beltProgress.beltSuffix"), "").trim() })}
            </span>
            <span className="text-zinc-300 font-medium tabular-nums">
              {(() => {
                const yrs = Math.floor(monthsAtBelt / 12);
                const mos = monthsAtBelt % 12;
                if (yrs === 0) return t("profile.bjjHistoryMonths", { n: mos || 1 });
                if (mos === 0) return t("profile.bjjHistoryYears", { n: yrs });
                return t("profile.bjjHistoryYearsMonths", { y: yrs, m: mos });
              })()}
            </span>
          </div>
        )}
      </div>

      {/* Belt history timeline */}
      {sortedHistory.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs font-semibold text-zinc-500 tracking-widest mb-2">
            {t("beltProgress.historyTitle")}
          </p>
          <div className="space-y-1">
            {sortedHistory.map((entry) => {
              const entryLabel = BELT_LABELS[entry.belt] || entry.belt;
              const date = new Date(entry.promoted_at);
              const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
              return (
                <div key={entry.belt} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                    style={{ background: BELT_STYLES[entry.belt]?.bar ?? BELT_STYLES.white.bar }}
                  />
                  <span className="text-zinc-300">{entryLabel}</span>
                  <span className="text-zinc-600 ml-auto tabular-nums">{dateStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
