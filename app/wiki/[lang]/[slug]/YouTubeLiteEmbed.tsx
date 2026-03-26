"use client";

/**
 * YouTubeLiteEmbed.tsx
 *
 * @next/third-parties/google の YouTubeEmbed と同等のLite Embedパターン。
 * - 初期表示: サムネイル画像のみ（iframe不使用） → Core Web Vitals(LCP)を保護
 * - クリック後: 本物のiframeに置換 → 動画再生開始
 * - sandbox npmでインストールできないため独自実装
 */

import { useState } from "react";

interface Props {
  videoId: string;
  title: string;
}

export default function YouTubeLiteEmbed({ videoId, title }: Props) {
  const [activated, setActivated] = useState(false);

  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

  if (activated) {
    return (
      <div
        style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}
        className="rounded-xl overflow-hidden border border-white/10 shadow-xl bg-black"
      >
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      className="group relative w-full rounded-xl overflow-hidden border border-white/10 shadow-xl bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
      style={{ aspectRatio: "16/9" }}
      aria-label={`Play: ${title}`}
    >
      {/* サムネイル */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnailUrl}
        alt={title}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {/* 暗幕オーバーレイ */}
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />

      {/* 再生ボタン */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-500 flex items-center justify-center shadow-2xl transition-all duration-200 group-hover:scale-110">
          {/* YouTube play triangle */}
          <svg
            viewBox="0 0 24 24"
            fill="white"
            className="w-7 h-7 translate-x-0.5"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {/* タイトルラベル（下部） */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
        <p className="text-xs text-white/80 text-left line-clamp-1">{title}</p>
      </div>
    </button>
  );
}
