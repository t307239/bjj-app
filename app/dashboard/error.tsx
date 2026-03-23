"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/i18n";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-xl font-bold mb-2">{t("error.title")}</h2>
      <p className="text-gray-400 text-sm mb-6">
        {t("error.description")}
      </p>
      <button
        onClick={reset}
        className="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2 px-6 rounded-full text-sm transition-colors"
      >
        {t("error.retry")}
      </button>
    </div>
  );
}
