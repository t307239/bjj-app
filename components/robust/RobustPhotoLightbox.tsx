"use client";

import { useEffect } from "react";

/**
 * 会員写真の拡大表示（ライトボックス）。
 * Why: 一覧のアバターは小さく（〜56px）、インストラクターが「名前↔顔」を照合しづらい。
 *      タップで大きく表示し、氏名と並べて本人確認できるようにする。一覧はコンパクトに保つ。
 */
export default function RobustPhotoLightbox({
  photo,
  onClose,
}: {
  photo: { url: string; name: string } | null;
  onClose: () => void;
}) {
  // Esc で閉じる（PC 受付端末での操作性）。photo が無い間は購読しない。
  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.name} の写真`}
    >
      {/* 背景クリックで閉じる（button 化して a11y/キーボード対応）。画像本体（前面）クリックでは閉じない。 */}
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 w-full h-full cursor-default"
      />
      <div className="relative text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.name}
          className="max-w-[85vw] max-h-[75vh] rounded-xl object-contain border border-white/20 mx-auto"
        />
        <p className="text-white text-lg font-medium mt-3">{photo.name}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-[44px] px-6 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
