"use client";

import { useState } from "react";

interface AvatarImageProps {
  src: string;
  alt: string;
  className?: string;
  /**
   * priority=true → fetchpriority="high" + loading="eager" (LCP最適化 — ヒーローエリア用)
   * priority=false (default) → loading="lazy" + decoding="async" (スクロール下の画像用)
   */
  priority?: boolean;
  /** Fallback initials (e.g. "TT" from "Toshiki Terasawa"). Shown if image fails to load. */
  fallbackInitials?: string;
}

/**
 * AvatarImage — client component wrapper for avatar <img> with onError fallback
 * and blur-up fade-in transition.
 * Shows fallback initials or default icon if image fails to load.
 * perf: priority prop で LCP スコアを最適化 (fetchpriority="high" / loading="lazy" の切り替え)
 */
export default function AvatarImage({ src, alt, className, priority = false, fallbackInitials }: AvatarImageProps) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (errored || !src) {
    return (
      <div
        className={`${className ?? ""} flex items-center justify-center bg-zinc-800 text-zinc-400 font-semibold text-xs`}
        aria-label={alt}
      >
        {fallbackInitials ? (
          fallbackInitials.slice(0, 2).toUpperCase()
        ) : (
          <svg className="w-1/2 h-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
          </svg>
        )}
      </div>
    );
  }

  return (
    <div className={`${className ?? ""} relative overflow-hidden bg-zinc-800`}>
      {/* Skeleton placeholder — visible until image loads */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-700/50" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
