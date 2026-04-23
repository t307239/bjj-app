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
 * (AUDIT_FRAMEWORK §10 — i18n: error copy is locale-aware, no hardcoded JA)
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const { t } = useLocale();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-4">😵</div>
      <h2 className="text-lg font-bold text-zinc-100 mb-2">
        {t("error.title")}
      </h2>
      <p className="text-sm text-zinc-400 mb-6 max-w-md">
        {t("error.dataSafe")}
        {error.digest && (
          <span className="block mt-1 text-xs text-zinc-500">
            {t("error.errorIdLabel")} {error.digest}
          </span>
        )}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          {t("error.retry")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-full bg-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-600 transition-colors"
        >
          {t("error.goHome")}
        </button>
      </div>
      <p className="text-xs text-zinc-500 mt-6">
        {t("error.contact")}{" "}
        <a
          href="mailto:307239t777@gmail.com?subject=BJJ App Error Report"
          className="text-emerald-500 underline"
        >
          {t("error.contactLink")}
        </a>
      </p>
    </div>
  );
}
