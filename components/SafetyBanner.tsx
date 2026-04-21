"use client";

import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

const STORAGE_KEY = "bjj_safety_banner_dismissed";

interface SafetyBannerProps {
  title: string;
  description: string;
  /** Optional wiki URL for "Learn more" link (e.g. /wiki/en/heel-hook). */
  wikiHref?: string;
  /** Label for the wiki link. Defaults to "Learn more →" */
  wikiLabel?: string;
}

/**
 * SafetyBanner — dismissable safety warning for white/blue belts.
 * Once dismissed, stays hidden via localStorage.
 * Fires "safety_banner_dismissed" and "safety_banner_wiki_click" for KPI tracking.
 */
export default function SafetyBanner({
  title,
  description,
  wikiHref,
  wikiLabel = "Learn more →",
}: SafetyBannerProps) {
  // null = not yet checked localStorage (hydration phase — render nothing to avoid flash)
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setDismissed(stored === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  // During hydration or if dismissed, render nothing
  if (dismissed === null || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    trackEvent("safety_banner_dismissed");
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // storage unavailable — hide for this session only
    }
  };

  return (
    <div className="mb-5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 relative">
      <button type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-md text-amber-400/60 hover:text-amber-300 hover:bg-amber-900/30 transition-colors"
        aria-label="閉じる"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="flex items-start gap-2.5 pr-6">
        <span className="text-amber-400 text-base mt-0.5 flex-shrink-0">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-amber-300 mb-1">
            {title}
          </p>
          <p className="text-xs text-amber-200/80 leading-relaxed">
            {description}
          </p>
          {wikiHref && (
            <a
              href={wikiHref}
              onClick={() => trackEvent("safety_banner_wiki_click")}
              className="inline-block mt-1.5 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {wikiLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
