"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

/**
 * AchievementBadge — z222 enhanced:
 *   - 旧 (z154): session count (totalCount) milestone のみ、text share のみ
 *   - 新 (z222): + streak milestone (30/100/365日) 検出
 *               + /api/og?mode=achievement で beautiful share card 画像
 *               + X/Threads/Bluesky button (Facebook 削除、BJJ audience なし)
 *               + URL に ?ref=achievement_share で attribution
 *
 * 設計:
 *   - 1 user の share = 数十-数百 reach の viral loop 起動
 *   - share image は OG card そのまま (Twitter etc. が auto preview)
 *   - localStorage で重複表示防止 (sessions / streak 別 key)
 */

type AchievementType = "sessions" | "streak";

interface AchievementBadgeProps {
  userId: string;
  totalCount: number;
  /** z222: 現在の連続日数 (dashboard で計算済を渡す) */
  streak?: number;
  /** z222: ユーザーの帯 (share image の color に使用) */
  belt?: string;
}

const SESSION_MILESTONES = [
  1, 7, 10, 30, 50, 100, 200, 365, 500, 1000,
] as const;

// z222: streak 連続日数の milestone (虚栄心が刺激される丸数字)
const STREAK_MILESTONES = [
  7, 14, 30, 60, 100, 180, 365,
] as const;

export default function AchievementBadge({
  userId: _userId,
  totalCount,
  streak = 0,
  belt = "white",
}: AchievementBadgeProps) {
  const { t } = useLocale();
  const [showBadge, setShowBadge] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);
  // z222: どの type の achievement か判別 (image/share text 切替に使用)
  const [aType, setAType] = useState<AchievementType>("sessions");

  useEffect(() => {
    // ── Sessions milestone (旧) ──
    if (totalCount > 0) {
      const matched = SESSION_MILESTONES.find((m) => m === totalCount);
      if (matched) {
        const shown = localStorage.getItem("bjj_shown_milestones");
        const list = shown ? JSON.parse(shown) : [];
        if (!list.includes(matched)) {
          list.push(matched);
          localStorage.setItem("bjj_shown_milestones", JSON.stringify(list));
          setAType("sessions");
          setMilestone(matched);
          setShowBadge(true);
          return;
        }
      }
    }
    // ── z222: Streak milestone (新) ──
    if (streak > 0) {
      const matched = STREAK_MILESTONES.find((m) => m === streak);
      if (matched) {
        const shown = localStorage.getItem("bjj_shown_streak_milestones");
        const list = shown ? JSON.parse(shown) : [];
        if (!list.includes(matched)) {
          list.push(matched);
          localStorage.setItem("bjj_shown_streak_milestones", JSON.stringify(list));
          setAType("streak");
          setMilestone(matched);
          setShowBadge(true);
        }
      }
    }
  }, [totalCount, streak]);

  if (!showBadge || !milestone) return null;

  // ── z222: share text + image URL を type 別に組立 ──
  const shareUrl = `https://bjj-app.net/?ref=achievement_share&kind=${aType}${milestone}`;
  // share text: streak は emoji 強め、sessions は milestone.text の i18n key を使用
  const shareText = aType === "streak"
    ? t("achievement.streakShareText", { n: milestone })
    : t("achievement.shareText", {
        n: milestone,
        text: t(`achievement.milestone.${milestone}.text`),
      });
  // /api/og?mode=achievement&type=streak&value=30&belt=blue&lang=en
  // Twitter/X 等は OG meta から auto preview するため shareUrl 経由で OG image が取得される
  // ただし shareUrl は LP なので OG が違う → 直接 image URL を渡す path も用意
  // 現状 fallback: text share + LP URL (LP の OG が表示される)
  // 完璧版は後で別 share landing page で対応 (achievement-specific OG)

  // 表示用 (modal 内に preview する画像)
  const previewImageUrl = `/api/og?mode=achievement&type=${aType}&value=${milestone}&belt=${belt}&lang=${t("__locale_code") || "en"}`;

  const milestoneText = aType === "sessions"
    ? t(`achievement.milestone.${milestone}.text`)
    : t("achievement.streakTitle", { n: milestone });
  const milestoneSubtext = aType === "sessions"
    ? t(`achievement.milestone.${milestone}.subtext`)
    : t("achievement.streakSubtitle");
  const milestoneEmoji = aType === "streak"
    ? "🔥"
    : t(`achievement.milestone.${milestone}.emoji`);

  // z222: native share sheet (mobile)
  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: shareText, url: shareUrl });
        return;
      } catch { /* user cancelled */ }
    }
    // fallback: X/Twitter
    handleShareX();
  };

  const handleShareX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleShareThreads = () => {
    // Threads share intent (公式 intent URL)
    window.open(
      `https://www.threads.net/intent/post?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleShareBluesky = () => {
    // Bluesky compose intent
    window.open(
      `https://bsky.app/intent/compose?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    } catch { /* clipboard 失敗時は無視 */ }
  };

  return (
    <>
      {/* Overlay background */}
      <div
        role="presentation"
        className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-in fade-in duration-300"
        onClick={() => setShowBadge(false)}
        aria-hidden="true"
      />

      {/* Badge card */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        style={{
          animation: "slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div className="bg-gradient-to-b from-violet-600 to-purple-800 rounded-2xl px-8 py-12 text-center max-w-sm mx-4 shadow-2xl pointer-events-auto relative overflow-hidden">
          {/* Confetti-like background elements */}
          <div className="absolute top-2 left-4 text-4xl opacity-30 animate-bounce">
            ✨
          </div>
          <div className="absolute top-6 right-6 text-3xl opacity-30 animate-bounce delay-150">
            ⭐
          </div>
          <div className="absolute bottom-8 left-8 text-3xl opacity-30 animate-bounce delay-300">
            🎉
          </div>

          {/* Main content */}
          <div className="relative z-10">
            <div className="text-8xl mb-4 drop-shadow-lg">
              {milestoneEmoji}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {milestoneText}
            </h2>
            <p className="text-lg text-white font-semibold mb-4">{milestoneSubtext}</p>

            {/* z222: Share card preview image (auto-generated by /api/og) */}
            <div className="mb-5 mx-auto max-w-[260px] rounded-lg overflow-hidden ring-2 ring-white/30 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImageUrl}
                alt={`${milestone} ${aType}`}
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 items-center">
              <button type="button"
                onClick={handleShare}
                className="bg-white text-violet-600 px-6 py-2.5 rounded-lg font-bold hover:bg-gray-100 transition-colors min-h-[44px] w-full max-w-[260px]"
              >
                {t("achievement.shareButton")}
              </button>
              {/* z222: SNS-specific share buttons (X / Threads / Bluesky / Copy)
                  旧 Facebook 削除 (BJJ audience 上の engagement なし) */}
              <div className="flex gap-2 flex-wrap justify-center">
                <button type="button"
                  onClick={handleShareX}
                  className="bg-black text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-zinc-800 transition-colors min-h-[40px]"
                  aria-label="Share on X"
                >
                  𝕏
                </button>
                <button type="button"
                  onClick={handleShareThreads}
                  className="bg-zinc-900 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-zinc-700 transition-colors min-h-[40px]"
                  aria-label="Share on Threads"
                >
                  Threads
                </button>
                <button type="button"
                  onClick={handleShareBluesky}
                  className="bg-[#1185FE] text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-[#0d6fda] transition-colors min-h-[40px]"
                  aria-label="Share on Bluesky"
                >
                  Bluesky
                </button>
                <button type="button"
                  onClick={handleCopyLink}
                  className="bg-purple-700 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-purple-800 transition-colors min-h-[40px]"
                  aria-label={t("achievement.copyLink")}
                >
                  📋
                </button>
                <button type="button"
                  onClick={() => setShowBadge(false)}
                  className="bg-purple-900 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-purple-950 transition-colors border border-white/30 min-h-[40px]"
                  aria-label={t("common.close")}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-bounce {
          animation: bounce 1s infinite;
        }

        .delay-150 {
          animation-delay: 0.15s;
        }

        .delay-300 {
          animation-delay: 0.3s;
        }

        .drop-shadow-lg {
          filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.2));
        }
      `}</style>
    </>
  );
}
