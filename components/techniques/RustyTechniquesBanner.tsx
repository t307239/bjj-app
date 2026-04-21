"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n";

type RustyTechnique = {
  name: string;
  category: string | null;
  mastery_level: number;
  daysSinceCreated: number;
};

type Props = {
  techniques: RustyTechnique[];
};

const DISMISS_KEY = "bjj_rusty_dismissed";

export default function RustyTechniquesBanner({ techniques }: Props) {
  const { t } = useLocale();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    // Reset weekly — key includes ISO week
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const weekKey = `${DISMISS_KEY}_${now.getFullYear()}_${Math.ceil((now.getDate() + new Date(now.getFullYear(), 0, 1).getDay()) / 7)}`;
    return localStorage.getItem(weekKey) === "1";
  });

  if (dismissed || techniques.length === 0) return null;

  const handleDismiss = () => {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const weekKey = `${DISMISS_KEY}_${now.getFullYear()}_${Math.ceil((now.getDate() + new Date(now.getFullYear(), 0, 1).getDay()) / 7)}`;
    localStorage.setItem(weekKey, "1");
    setDismissed(true);
  };

  const displayCount = Math.min(techniques.length, 3);
  const display = techniques.slice(0, 3);

  return (
    <div className="mb-5 bg-amber-950/30 border border-amber-500/20 rounded-2xl p-4 relative">
      {/* Dismiss */}
      <button type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition-colors text-xs p-1"
        aria-label={t("common.dismiss")}
      >
        ✕
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5 pr-6">
        <span className="text-base">🧹</span>
        <h3 className="text-sm font-bold text-amber-300">
          {t("techniques.rustyTitle")}
        </h3>
        <span className="text-xs text-zinc-500">
          {t("techniques.rustyCount", { n: techniques.length })}
        </span>
      </div>

      <p className="text-xs text-zinc-400 mb-3">
        {t("techniques.rustyDesc")}
      </p>

      {/* Technique list */}
      <div className="space-y-1.5">
        {display.map((tech, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-900/40"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-sm text-zinc-200 truncate flex-1">
              {tech.name}
            </span>
            {tech.category && (
              <span className="text-[10px] text-zinc-500 capitalize whitespace-nowrap">
                {tech.category}
              </span>
            )}
            <span className="text-[10px] text-zinc-600 whitespace-nowrap">
              {t("techniques.rustyDays", { n: tech.daysSinceCreated })}
            </span>
          </div>
        ))}
      </div>

      {techniques.length > 3 && (
        <p className="text-[11px] text-zinc-500 mt-2 text-center">
          {t("focus.more", { n: techniques.length - 3 })}
        </p>
      )}

      {/* CTA */}
      <Link
        href="#"
        className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors py-2"
        onClick={(e) => {
          e.preventDefault();
          // Scroll to journal section
          const el = document.querySelector("[data-tab='journal']");
          if (el) (el as HTMLElement).click();
        }}
      >
        {t("techniques.rustyReview")}
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
