"use client";

/**
 * error.tsx — Route-level error boundary (Next.js App Router)
 *
 * Catches errors within nested routes/pages while preserving
 * the root layout (navigation, footer). Provides a user-friendly
 * recovery UI with i18n support.
 *
 * Unlike global-error.tsx, this boundary runs INSIDE the root layout,
 * so the navigation bar and theme are preserved.
 *
 * (AUDIT_FRAMEWORK §21 — Observability: prevents "白い画面" on route errors)
 * (AUDIT_FRAMEWORK §2 — Logic: graceful error recovery)
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-4">😵</div>
      <h2 className="text-lg font-bold text-zinc-100 mb-2">
        エラーが発生しました
      </h2>
      <p className="text-sm text-zinc-400 mb-6 max-w-md">
        予期しないエラーが発生しました。あなたのトレーニングデータは安全です。
        {error.digest && (
          <span className="block mt-1 text-xs text-zinc-500">
            Error ID: {error.digest}
          </span>
        )}
      </p>
      <div className="flex gap-3">
        <button type="button"
          onClick={reset}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          もう一度試す
        </button>
        <button type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-full bg-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-600 transition-colors"
        >
          ホームに戻る
        </button>
      </div>
      <p className="text-xs text-zinc-500 mt-6">
        問題が続く場合は{" "}
        <a
          href="mailto:307239t777@gmail.com?subject=BJJ App Error Report"
          className="text-emerald-500 underline"
        >
          お問い合わせ
        </a>
        {" "}ください
      </p>
    </div>
  );
}
