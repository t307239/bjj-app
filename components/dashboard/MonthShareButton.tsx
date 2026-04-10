"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

interface Props {
  monthCount: number;
  monthHoursStr: string | null;
}

export default function MonthShareButton({ monthCount, monthHoursStr }: Props) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  if (monthCount < 1) return null;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareText = t("monthlyShare.shareText")
      .replace("{sessions}", String(monthCount))
      .replace("{hours}", monthHoursStr ?? "0m");
    const shareUrl = `${APP_URL}/dashboard`;

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url: shareUrl });
        trackEvent("monthly_share", { sessions: monthCount, method: "native_share" });
      } catch {
        /* user cancelled share */
      }
    } else {
      await navigator.clipboard
        .writeText(`${shareText}\n${shareUrl}`)
        .catch((err) => console.error("clipboard copy failed:", err));
      trackEvent("monthly_share", { sessions: monthCount, method: "clipboard" });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1 text-xs text-emerald-400/70 hover:text-emerald-300 transition-colors font-medium"
      aria-label={t("monthlyShare.shareButton")}
    >
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Z" />
      </svg>
      <span>{copied ? t("monthlyShare.copied") : t("monthlyShare.shareButton")}</span>
    </button>
  );
}
