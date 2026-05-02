"use client";

/**
 * HeroPreviewVideo — z240 (L-6 placeholder)
 *
 * /tour-preview.mp4 が public/ にあれば video 表示、なければ既存 mockup placeholder。
 * Toshiki が screen recording 撮影 → ffmpeg 圧縮 → public/tour-preview.mp4 配置 で
 * 自動的に video に切り替わる。
 *
 * 使い方 (LP の hero に):
 *   <HeroPreviewVideo />
 */
import { useEffect, useRef, useState } from "react";

export default function HeroPreviewVideo() {
  const [hasVideo, setHasVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // mount 時に HEAD で video file の存在確認 (404 ならば placeholder fallback)
  useEffect(() => {
    let cancelled = false;
    fetch("/tour-preview.mp4", { method: "HEAD" })
      .then((r) => {
        if (!cancelled && r.ok) setHasVideo(true);
      })
      .catch(() => {
        // ネットワーク fail は黙って placeholder のままで OK
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="mt-16 w-full max-w-4xl mx-auto rounded-t-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden"
      style={{
        maskImage: "linear-gradient(to bottom, white 60%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, white 60%, transparent 100%)",
      }}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          src="/tour-preview.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-label="BJJ App product tour preview"
          className="w-full h-auto"
          onError={() => setHasVideo(false)}
        />
      ) : (
        <div className="px-8 py-10 flex flex-col gap-3">
          <div className="h-3 w-2/3 rounded-full bg-zinc-700/60 animate-pulse" />
          <div className="h-3 w-1/2 rounded-full bg-zinc-700/40 animate-pulse" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-zinc-800/60 animate-pulse"
              />
            ))}
          </div>
          <div className="mt-4 h-32 rounded-xl bg-zinc-800/40 animate-pulse" />
        </div>
      )}
    </div>
  );
}
