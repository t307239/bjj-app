"use client";

import { useState } from "react";

type Props = {
  isPro: boolean;
};

const PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "#";

const PRO_FEATURES = [
  "練習CSVエクスポート",
  "12ヶ月グラフ閲覧",
  "StreakFreezeチケット",
];

export default function ProUpgradeBanner({ isPro }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (isPro || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-[#16213e] to-[#0f3460] rounded-xl px-4 py-3 mb-4 border border-[#e94560]/20 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-gray-600 hover:text-gray-400 transition-colors text-xs p-1"
        aria-label="閉じる"
      >
        ✕
      </button>
      <div className="flex items-center justify-between pr-4">
        <div>
          <p className="text-xs font-semibold text-[#e94560] mb-1">⭐ BJJ App Pro — ¥750/月</p>
          <p className="text-[11px] text-gray-400">
            {PRO_FEATURES.join(" · ")}
          </p>
        </div>
        <a
          href={PAYMENT_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 ml-3 bg-[#e94560] hover:bg-[#c73652] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          アップグレード
        </a>
      </div>
    </div>
  );
}
