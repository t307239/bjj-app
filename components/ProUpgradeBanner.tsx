"use client";

import { useState } from "react";

type Props = {
  isPro: boolean;
};

const PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "#";

const PRO_FEATURES = [
  "CSV Export",
  "12-month Charts",
  "Streak Freeze Tickets",
];

export default function ProUpgradeBanner({ isPro }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (isPro || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-xl px-4 py-3 mb-4 border border-[#e94560]/20 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-gray-600 hover:text-gray-400 transition-colors text-xs p-1"
        aria-label="Close"
      >
        ✕
      </button>
      <div className="flex items-center justify-between pr-4">
        <div>
          <p className="text-xs font-semibold text-[#e94560] mb-1">⭐ BJJ App Pro — $4.99/mo (tax incl.)</p>
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
          Upgrade
        </a>
      </div>
    </div>
  );
}
