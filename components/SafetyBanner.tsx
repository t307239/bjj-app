"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "bjj_safety_banner_dismissed";

interface SafetyBannerProps {
  title: string;
  description: string;
}

/**
 * SafetyBanner — dismissable safety warning for white/blue belts.
 * Once dismissed, stays hidden via localStorage.
 */
export default function SafetyBanner({ title, description }: SafetyBannerProps) {
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setDismissed(stored === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // storage unavailable — hide for this session only
    }
  };

  return (
    <div className="mb-5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 relative">
      <button
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
        </div>
      </div>
    </div>
  );
}
