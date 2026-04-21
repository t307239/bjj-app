"use client";
import { useState, useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

/** Referral milestones: invite N friends → unlock badge */
const REFERRAL_MILESTONES = [
  { count: 1, emoji: "🤝", key: "ref1" },
  { count: 3, emoji: "🌟", key: "ref3" },
  { count: 5, emoji: "🏆", key: "ref5" },
  { count: 10, emoji: "👑", key: "ref10" },
] as const;

export default function ReferralSection({
  referralCode,
  referralCount,
}: {
  referralCode: string;
  referralCount: number;
}) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const referralLink = `${APP_URL}/login?ref=${referralCode}`;

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      trackEvent("referral_shared", { method: "copy" });
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = referralLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const shareText = `${t("profile.referralShare")} ${referralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url: referralLink });
        trackEvent("referral_shared", { method: "native_share" });
      } catch {
        // User cancelled share
      }
    } else {
      await handleCopy();
    }
  };

  // Find next milestone
  const nextMilestone = REFERRAL_MILESTONES.find((m) => referralCount < m.count);
  const progressPercent = nextMilestone
    ? Math.min(100, Math.round((referralCount / nextMilestone.count) * 100))
    : 100;

  return (
    <div className="bg-zinc-900/60 border border-violet-500/20 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl mt-0.5">🤝</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            {t("profile.referralTitle")}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
            {t("profile.referralDesc")}
          </p>
        </div>
      </div>

      {/* ── Referral Milestone Badges ── */}
      <div className="mb-4">
        <p className="text-xs text-zinc-400 font-medium mb-2">
          {t("profile.referralMilestones")}
        </p>
        <div className="flex items-center gap-2">
          {REFERRAL_MILESTONES.map((m) => {
            const unlocked = referralCount >= m.count;
            return (
              <div
                key={m.key}
                className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-lg border transition-all ${
                  unlocked
                    ? "bg-violet-600/20 border-violet-500/40"
                    : "bg-zinc-800/50 border-zinc-700/30 opacity-50"
                }`}
              >
                <span className={`text-xl ${unlocked ? "" : "grayscale"}`}>
                  {m.emoji}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium tabular-nums">
                  {m.count} {t("profile.referralFriends")}
                </span>
                {unlocked && (
                  <span className="text-[10px] text-emerald-400 font-bold">
                    {t("profile.referralUnlocked")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* Progress bar toward next milestone */}
        {nextMilestone && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
              <span>{t("profile.referralProgress", { n: referralCount, goal: nextMilestone.count })}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        {!nextMilestone && referralCount > 0 && (
          <p className="text-xs text-emerald-400 font-semibold mt-2 text-center">
            {t("profile.referralAllUnlocked")}
          </p>
        )}
      </div>

      {/* Referral link + copy */}
      <div className="mb-3">
        <label className="text-xs text-zinc-400 font-medium block mb-1.5">
          {t("profile.referralLink")}
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono truncate select-all">
            {referralLink}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
            }`}
          >
            {copied ? t("profile.referralCopied") : t("profile.referralCopy")}
          </button>
        </div>
      </div>

      {/* Referral count */}
      <p className="text-xs text-zinc-400 mb-3">
        {referralCount > 0
          ? t("profile.referralCount", { n: referralCount })
          : t("profile.referralCountZero")}
      </p>

      {/* Share button */}
      <button
        type="button"
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors active:scale-95"
      >
        <svg
aria-hidden="true"           className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        {t("profile.referralShareBtn")}
      </button>
    </div>
  );
}
