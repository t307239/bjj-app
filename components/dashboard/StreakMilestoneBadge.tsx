"use client";

/**
 * StreakMilestoneBadge — 30/100/365日ストリーク達成時にBentoStatsGrid内で祝福+シェアを表示
 * localStorage で表示済み管理（同じ節目は1回のみ）
 */

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

const STREAK_MILESTONES = [30, 100, 365] as const;
type StreakMilestone = (typeof STREAK_MILESTONES)[number];

const LS_KEY = "bjj_streak_shared";

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
  streak: number;
}

export default function StreakMilestoneBadge({ streak }: Props) {
  const { t } = useLocale();
  const [milestone, setMilestone] = useState<StreakMilestone | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const hit = STREAK_MILESTONES.find((m) => m === streak);
    if (!hit) return;
    if (!loadSharedSet().has(hit)) setMilestone(hit);
  }, [streak]);

  if (!milestone) return null;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = t("dashboard.streakMilestoneShareText", { n: milestone });
    trackEvent("milestone_share", { type: "streak", milestone });
    markShared(milestone);

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch { /* cancelled */ }
      setMilestone(null);
    } else {
      await navigator.clipboard.writeText(text).catch(() => {/* clipboard not available */});
      setCopied(true);
      setTimeout(() => { setCopied(false); setMilestone(null); }, 2000);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    markShared(milestone);
    setMilestone(null);
  };

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-1 text-xs font-bold text-yellow-300 hover:text-yellow-200 bg-yellow-400/10 rounded-full px-2 py-0.5 transition-colors"
      >
        🎉 {copied ? t("monthlyShare.copied") : t("monthlyShare.shareButton")}
      </button>
      <button
        onClick={handleDismiss}
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
