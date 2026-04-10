"use client";

/**
 * StreakMilestoneShare — 30/100/365日ストリーク達成時にワンタップShareバナーを表示
 *
 * - localStorage で「表示済み」を管理（同じ節目は1回のみ）
 * - Web Share API 対応デバイス → 直接シェア
 * - 非対応 → テキストをクリップボードにコピー
 * - trackEvent("milestone_share", { type: "streak", milestone: n })
 */

import { useEffect, useState } from "react";
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

const MILESTONE_CONFIG: Record<StreakMilestone, { emoji: string; label: string }> = {
  30:  { emoji: "🔥", label: "30-day streak" },
  100: { emoji: "💯", label: "100-day streak" },
  365: { emoji: "🏆", label: "365-day streak" },
};

interface Props {
  streak: number;
}

export default function StreakMilestoneShare({ streak }: Props) {
  const [prompt, setPrompt] = useState<StreakMilestone | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const hit = STREAK_MILESTONES.find((m) => m === streak);
    if (!hit) return;
    if (!loadSharedSet().has(hit)) setPrompt(hit);
  }, [streak]);

  if (!prompt) return null;

  const { emoji, label } = MILESTONE_CONFIG[prompt];

  const handleShare = async () => {
    const text = `${emoji} ${prompt}-day BJJ training streak! 🥋 Tracking every roll with BJJ App → https://bjj-app.net`;
    trackEvent("milestone_share", { type: "streak", milestone: prompt });
    markShared(prompt);
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text).catch(() => {/* clipboard not available */});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setPrompt(null);
  };

  const handleDismiss = () => { markShared(prompt); setPrompt(null); };

  return (
    <div className="mb-5 rounded-2xl bg-gradient-to-r from-yellow-500/15 to-amber-500/10 border border-yellow-400/30 px-4 py-3 flex items-center gap-3">
      <span className="text-2xl flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-yellow-200 leading-tight">{label} reached!</p>
        <p className="text-xs text-yellow-300/60">Share this with your training crew 🤙</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={handleShare}
          className="bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
        >
          {copied ? "Copied!" : "Share 🔗"}
        </button>
        <button
          onClick={handleDismiss}
          className="text-zinc-500 hover:text-zinc-300 text-xs px-2 transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
