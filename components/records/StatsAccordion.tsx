"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "@/lib/i18n";

const TrainingBarChart = dynamic(() => import("@/components/TrainingBarChart"), {
  ssr: false,
  loading: () => <div className="h-36 bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});
const TrainingTypeChart = dynamic(() => import("@/components/TrainingTypeChart"), {
  ssr: false,
  loading: () => <div className="h-36 bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});
const ExtendedBadgeGrid = dynamic(() => import("@/components/ExtendedBadgeGrid"), {
  ssr: false,
  loading: () => <div className="h-48 bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});

interface Props {
  userId: string;
  isPro: boolean;
}

export default function StatsAccordion({ userId, isPro }: Props) {
  const { t } = useLocale();
  const [showDetailCharts, setShowDetailCharts] = useState(false);
  const [showExtendedBadges, setShowExtendedBadges] = useState(false);

  return (
    <>
      {/* Collapsible detail charts */}
      {showDetailCharts && (
        <div className="mt-3 space-y-3">
          <TrainingBarChart userId={userId} isPro={isPro} />
          <TrainingTypeChart userId={userId} isPro={isPro} />
        </div>
      )}
      <button type="button"
        onClick={() => setShowDetailCharts((v) => !v)}
        aria-expanded={showDetailCharts}
        className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <span>
          {showDetailCharts
            ? t("profile.hideDetailCharts")
            : t("profile.showDetailCharts")}
        </span>
        <svg
aria-hidden="true"           className={`w-3.5 h-3.5 transition-transform ${showDetailCharts ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible extended badges */}
      {showExtendedBadges && (
        <div className="mt-3">
          <ExtendedBadgeGrid userId={userId} />
        </div>
      )}
      <button type="button"
        onClick={() => setShowExtendedBadges((v) => !v)}
        aria-expanded={showExtendedBadges}
        className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <span>
          {showExtendedBadges
            ? t("profile.hideExtendedBadges")
            : t("profile.showExtendedBadges")}
        </span>
        <svg
aria-hidden="true"           className={`w-3.5 h-3.5 transition-transform ${showExtendedBadges ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </>
  );
}
