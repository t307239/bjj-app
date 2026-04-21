"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";

type Props = {
  recordId: string;
};

export default function RecordDetailClient({ recordId }: Props) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const tid = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(tid);
  }, [copied]);

  const handleCopy = async () => {
    const url = `${window.location.origin}/records/${recordId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Fallback for iOS Safari / older browsers
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-2 min-h-[36px] rounded-lg transition-colors"
      aria-label={t("training.copyLink")}
    >
      {copied ? (
        <>
          <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-400">{t("training.linkCopied")}</span>
        </>
      ) : (
        <>
          <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          {t("training.copyLink")}
        </>
      )}
    </button>
  );
}
