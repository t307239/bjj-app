"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-xl font-bold mb-2">エラーが発生しました</h2>
      <p className="text-gray-400 text-sm mb-6">
        ページの読み込み中に問題が発生しました
      </p>
      <button
        onClick={reset}
        className="bg-[#e94560] hover:bg-[#c73652] text-white font-semibold py-2 px-6 rounded-full text-sm transition-colors"
      >
        再試行
      </button>
    </div>
  );
}
