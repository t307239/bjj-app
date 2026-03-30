"use client";

import { useLocale } from "@/lib/i18n";

const MILESTONES = [1, 7, 10, 30, 50, 100, 200, 365, 500, 1000] as const;
type Milestone = (typeof MILESTONES)[number];

interface Props {
  totalCount: number;
}

function BadgeCell({ milestone, earned }: { milestone: Milestone; earned: boolean }) {
  const { t } = useLocale();
  const emoji = t(`achievement.milestone.${milestone}.emoji`);
  const text = t(`achievement.milestone.${milestone}.text`);

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl p-2.5 border transition-all ${
        earned
          ? "bg-gradient-to-b from-violet-600/20 to-purple-800/20 border-violet-500/30"
          : "bg-zinc-800/40 border-white/5 opacity-50"
      }`}
    >
      <div className={`text-2xl leading-none ${earned ? "" : "grayscale"}`}>
        {earned ? emoji : "🔒"}
      </div>
      <span
        className={`text-xs font-bold tabular-nums ${
          earned ? "text-violet-300" : "text-zinc-500"
        }`}
      >
        {milestone >= 1000 ? "1K" : milestone}
      </span>
      {earned && (
        <span className="text-[9px] text-violet-400/70 leading-tight text-center line-clamp-1 w-full text-center">
          {text.replace(/!$/, "")}
        </span>
      )}
    </div>
  );
}

export default function MilestoneBadgeGrid({ totalCount }: Props) {
  const { t } = useLocale();

  const nextMilestone = MILESTONES.find((m) => m > totalCount) ?? null;
  const earnedCount = MILESTONES.filter((m) => m <= totalCount).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5 mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">🏅</span>
        <h3 className="text-sm font-semibold text-white">{t("milestones.title")}</h3>
        <span className="ml-auto text-xs text-zinc-400 font-mono">
          {earnedCount} / {MILESTONES.length}
        </span>
      </div>

      {/* Grid: 5 columns × 2 rows */}
      <div className="grid grid-cols-5 gap-2">
        {MILESTONES.map((m) => (
          <BadgeCell key={m} milestone={m} earned={totalCount >= m} />
        ))}
      </div>

      {/* Next milestone hint */}
      {nextMilestone !== null && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <span>{t("milestones.nextBadge", { n: nextMilestone })}</span>
            <span className="font-mono text-zinc-300">
              {totalCount} / {nextMilestone}
            </span>
          </div>
          <div className="bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-violet-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((totalCount / nextMilestone) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {nextMilestone === null && (
        <p className="mt-3 text-xs text-center text-violet-400 font-semibold">
          👑 {t("milestones.allEarned")}
        </p>
      )}
    </div>
  );
}
