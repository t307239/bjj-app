"use client";

import { useEffect, useState } from "react";

interface AchievementBadgeProps {
  userId: string;
  totalCount: number;
}

const MILESTONES = [1, 10, 30, 50, 100, 200, 365] as const;

const MILESTONE_DATA: Record<number, { emoji: string; text: string }> = {
  1: { emoji: "🎯", text: "初めての練習記録！BJJジャーニー開始！" },
  10: { emoji: "🔥", text: "10回達成！習慣化してきた！" },
  30: { emoji: "💪", text: "30回突破！本当の挑戦が始まる！" },
  50: { emoji: "⭐", text: "50回！ブルーベルトへの道！" },
  100: { emoji: "🏆", text: "100回！本物のBJJ戦士！" },
  200: { emoji: "👊", text: "200回！マスターへの道！" },
  365: { emoji: "🥋", text: "365回！1年間の継続！本物のBJJライフ！" },
};

export default function AchievementBadge({
  userId,
  totalCount,
}: AchievementBadgeProps) {
  const [showBadge, setShowBadge] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);

  useEffect(() => {
    if (totalCount === 0) return;

    // Check if totalCount matches a milestone
    const matchedMilestone = MILESTONES.find((m) => m === totalCount);
    if (!matchedMilestone) return;

    // Check if this milestone has been shown before
    const shown = localStorage.getItem("bjj_shown_milestones");
    const shownMilestones = shown ? JSON.parse(shown) : [];

    if (!shownMilestones.includes(matchedMilestone)) {
      // Mark milestone as shown
      shownMilestones.push(matchedMilestone);
      localStorage.setItem("bjj_shown_milestones", JSON.stringify(shownMilestones));

      setMilestone(matchedMilestone);
      setShowBadge(true);
    }
  }, [totalCount]);

  if (!showBadge || !milestone) return null;

  const data = MILESTONE_DATA[milestone];

  const handleShare = () => {
    const text = `BJJアプリで${milestone}回目の練習記録達成！🥋 ${data.text} #BJJ #ブラジリアン柔術 #続ける力`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <>
      {/* Overlay background */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-in fade-in duration-300"
        onClick={() => setShowBadge(false)}
      />

      {/* Badge card */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        style={{
          animation: "slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div className="bg-gradient-to-b from-[#e94560] to-[#c03550] rounded-2xl px-8 py-12 text-center max-w-sm mx-4 shadow-2xl pointer-events-auto relative overflow-hidden">
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
            <div className="text-8xl mb-4 drop-shadow-lg">{data.emoji}</div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {milestone}回達成！
            </h2>
            <p className="text-lg text-white font-semibold mb-6">{data.text}</p>

            {/* Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleShare}
                className="bg-white text-[#e94560] px-6 py-2 rounded-lg font-bold hover:bg-gray-100 transition-colors"
              >
                Xでシェア
              </button>
              <button
                onClick={() => setShowBadge(false)}
                className="bg-[#c03550] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#a02a3f] transition-colors border border-white border-opacity-30"
              >
                ✕
              </button>
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
