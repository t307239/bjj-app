"use client";

/**
 * ErrorFallback — Shared error boundary UI component.
 *
 * Replaces per-route error.tsx boilerplate with a single,
 * i18n-aware, accessible error screen that includes:
 *  - Retry button
 *  - Home link
 *  - Contact link (mailto)
 *  - "Data is safe" reassurance
 *
 * Q-18: Centralised error UI for 運用負荷 reduction.
 */

import { useEffect } from "react";
import { useLocale } from "@/lib/i18n";
import { logClientError } from "@/lib/logger";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** For logging — identifies which page errored */
  context?: string;
}

export default function ErrorFallback({ error, reset, context }: ErrorFallbackProps) {
  const { t } = useLocale();

  useEffect(() => {
    logClientError(context ?? "error-fallback", error, { digest: error.digest });
  }, [error, context]);

  return (
    <div
      className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center px-4 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
      <h2 className="text-xl font-bold mb-2 text-zinc-100">
        {t("error.title")}
      </h2>
      <p className="text-zinc-400 text-sm mb-2 max-w-md">
        {t("error.description")}
      </p>
      <p className="text-zinc-500 text-xs mb-6 max-w-md">
        {t("error.dataSafe")}
        {error.digest && (
          <span className="block mt-1 text-zinc-600">
            Error ID: {error.digest}
          </span>
        )}
      </p>
      <div className="flex gap-3 items-center flex-wrap justify-center">
        <button type="button"
          onClick={reset}
          className="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2 px-6 rounded-full text-sm transition-colors min-h-[44px]"
        >
          {t("error.retry")}
        </button>
        <a
          href="/dashboard"
          className="text-zinc-400 hover:text-zinc-200 text-sm underline underline-offset-2 transition-colors min-h-[44px] flex items-center"
        >
          {t("error.goHome")}
        </a>
      </div>
      <p className="text-zinc-600 text-xs mt-6">
        {t("error.contact")}{" "}
        <a
          href="mailto:307239t777@gmail.com?subject=BJJ App Error Report"
          className="text-emerald-500 hover:text-emerald-400 underline underline-offset-2 transition-colors"
        >
          {t("error.contactLink")}
        </a>
      </p>
    </div>
  );
}
