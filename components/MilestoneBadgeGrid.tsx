"use client";

import { useLocale } from "@/lib/i18n";
import { useEffect, useState, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import MilestoneShareCard from "./MilestoneShareCard";

const MILESTONES = [1, 7, 10, 30, 50, 100, 200, 365, 500, 1000] as const;
type Milestone = (typeof MILESTONES)[number];

const LS_KEY = "bjj_milestone_shared";

function loadSharedSet(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch { return new Set(); }
}
function markShared(n: number): void {
  const set = loadSharedSet();
  set.add(n);
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

interface Props {
  totalCount: number;
}

function BadgeCell({ milestone, earned }: { milestone: Milestone; earned: boolean }) {
  const { t } = useLocale();
  const emoji = t(`achievement.milestone.${milestone}.emoji`);
  const text = t(`achievement.milestone.${milestone}.text`);

  return (
    <div
      className={`relative flex flex-col items-center gap-1 rounded-xl p-2.5 border transition-all ${
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
        <>
          <span className="text-[9px] text-violet-400/70 leading-tight text-center line-clamp-1 w-full text-center">
            {text.replace(/!$/, "")}
          </span>
          <div className="absolute top-0.5 right-0.5">
            <MilestoneShareCard
              type="sessions"
              value={String(milestone)}
              label={text.replace(/!$/, "")}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function MilestoneBadgeGrid({ totalCount }: Props) {
  const { t } = useLocale();
  const [sharePrompt, setSharePrompt] = useState<Milestone | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // Check if we just hit a milestone (totalCount exactly equals one)
  useEffect(() => {
    const justEarned = MILESTONES.find((m) => m === totalCount);
    if (!justEarned) return;
    const shared = loadSharedSet();
    if (!shared.has(justEarned)) {
      setSharePrompt(justEarned);
    }
  }, [totalCount]);

  const handleShare = async () => {
    if (!sharePrompt) return;
    const emoji = t(`achievement.milestone.${sharePrompt}.emoji`);
    const text = `${emoji} Just hit ${sharePrompt} BJJ training sessions! 🥋 Tracking every roll with BJJ App → https://bjj-app.net`;
    trackEvent("milestone_share", { milestone: sharePrompt });
    markShared(sharePrompt);
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // User cancelled — still mark as seen
      }
    } else {
      await navigator.clipboard.writeText(text).catch(() => {/* clipboard not available */});
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
    setSharePrompt(null);
  };

  const handleDismiss = () => {
    if (sharePrompt) markShared(sharePrompt);
    setSharePrompt(null);
  };

  const nextMilestone = MILESTONES.find((m) => m > totalCount) ?? null;
  const earnedCount = MILESTONES.filter((m) => m <= totalCount).length;

  return (
    <div className="rounded-2xl ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 bg-zinc-900 p-5 mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">🏅</span>
        <h3 className="text-sm font-semibold text-white">{t("milestones.title")}</h3>
        <span className="ml-auto text-xs text-zinc-400 font-mono">
          {earnedCount} / {MILESTONES.length}
        </span>
      </div>

      {/* Just-earned share banner */}
      {sharePrompt !== null && (
        <div className="mb-4 rounded-xl bg-violet-600/20 border border-violet-500/40 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🎉</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-200 leading-tight">
              {sharePrompt} sessions reached!
            </p>
            <p className="text-xs text-violet-300/70">{t("milestone.shareText")}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button"
              onClick={handleShare}
              className="bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            >
              {copied ? t("common.copied") : t("common.shareLink")}
            </button>
            <button type="button"
              onClick={handleDismiss}
              className="text-zinc-500 hover:text-zinc-300 text-xs px-2 transition-colors"
              aria-label={t("common.dismiss")}
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
