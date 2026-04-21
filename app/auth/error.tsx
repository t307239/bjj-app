"use client";

/**
 * error.tsx — Error boundary for OAuth callback flow
 *
 * Catches errors during authentication (PKCE exchange failures,
 * provider errors) and provides a branded recovery UI.
 *
 * (AUDIT_FRAMEWORK §21 — Observability: prevents raw error pages on auth flow)
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthError({
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
      <div className="text-5xl mb-4">🔐</div>
      <h2 className="text-lg font-bold text-zinc-100 mb-2">
        ログインに失敗しました
      </h2>
      <p className="text-sm text-zinc-400 mb-6 max-w-md">
        認証プロセスでエラーが発生しました。もう一度お試しください。
        {error.digest && (
          <span className="block mt-1 text-xs text-zinc-500">
            Error ID: {error.digest}
          </span>
        )}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          もう一度試す
        </button>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="rounded-full bg-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-600 transition-colors"
        >
          ログインページへ
        </button>
      </div>
    </div>
  );
}
