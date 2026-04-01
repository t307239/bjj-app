"use client";

interface AvatarImageProps {
  src: string;
  alt: string;
  className?: string;
  /**
   * priority=true → fetchpriority="high" + loading="eager" (LCP最適化 — ヒーローエリア用)
   * priority=false (default) → loading="lazy" + decoding="async" (スクロール下の画像用)
   */
  priority?: boolean;
}

/**
 * AvatarImage — client component wrapper for avatar <img> with onError fallback.
 * Hides the image if it fails to load (broken avatar URL).
 * Must be a client component because onError is an event handler.
 * perf: priority prop で LCP スコアを最適化 (fetchpriority="high" / loading="lazy" の切り替え)
 */
export default function AvatarImage({ src, alt, className, priority = false }: AvatarImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
