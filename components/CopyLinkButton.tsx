"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/lib/i18n";

type Props = {
  entryId: string;
};

/**
 * Compact icon button that copies a deep-link URL for a training log entry.
 * Shows a green checkmark for 2 seconds after copying.
 */
export default function CopyLinkButton({ entryId }: Props) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const tid = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(tid);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    const url = `${window.location.origin}/records/${entryId}`;
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
  }, [entryId]);

  return (
    <button type="button"
      onClick={handleCopy}
      className={`transition-colors p-2 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center ${
        copied
          ? "text-emerald-400"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
      title={copied ? t("training.linkCopied") : t("training.copyLink")}
      aria-label={copied ? t("training.linkCopied") : t("training.copyLink")}
    >
      {copied ? (
        <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )}
    </button>
  );
}
