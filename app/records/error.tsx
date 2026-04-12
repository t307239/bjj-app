"use client";

import { useLocale } from "@/lib/i18n";

export default function RecordsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-2">{t("records.errorTitle")}</h2>
        <p className="text-sm text-zinc-400 mb-4">{error.message}</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
