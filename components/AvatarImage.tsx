"use client";

import { useState } from "react";
import Image from "next/image";

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
  /** Width in pixels for next/image (default: 96) */
  width?: number;
  /** Height in pixels for next/image (default: 96) */
  height?: number;
}

/**
 * AvatarImage — client component wrapper using next/image with onError fallback
 * and blur-up fade-in transition.
 * Shows fallback initials or default icon if image fails to load.
 * Q-6: Migrated from raw <img> to next/image for AVIF/WebP optimization.
 */
export default function AvatarImage({
  src,
  alt,
  className,
  priority = false,
  fallbackInitials,
  width = 96,
  height = 96,
}: AvatarImageProps) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (errored || !src) {
    return (
      <div
        className={`${className ?? ""} flex items-center justify-center bg-gradient-to-br from-violet-500/80 to-emerald-600/80 text-white font-bold text-sm`}
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
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        priority={priority}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        unoptimized={src.startsWith("data:")}
      />
    </div>
  );
}
