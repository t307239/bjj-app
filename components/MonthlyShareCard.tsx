"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

interface Props {
  monthCount: number;
  monthHoursStr: string | null;
  streak: number;
  belt: string;
  techniqueCount: number;
  year: number;
  month: number;
}

export default function MonthlyShareCard({
  monthCount,
  monthHoursStr,
  streak,
  belt,
  techniqueCount,
  year,
  month,
}: Props) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // Don't render if no sessions this month
  if (monthCount < 1) return null;

  const hoursNum = monthHoursStr
    ? monthHoursStr.replace(/h.*/, "").replace("m", "")
    : "0";

  const ogUrl = `${APP_URL}/api/og/monthly?sessions=${monthCount}&hours=${encodeURIComponent(hoursNum)}&streak=${streak}&belt=${encodeURIComponent(belt)}&month=${month}&year=${year}&techniques=${techniqueCount}`;

  const shareText = t("monthlyShare.shareText")
    .replace("{sessions}", String(monthCount))
    .replace("{hours}", monthHoursStr ?? "0m");

  const shareUrl = `${APP_URL}/dashboard`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url: shareUrl });
        trackEvent("monthly_share", { month, sessions: monthCount, method: "native_share" });
        setShared(true);
      } catch {
        /* user cancelled share */
      }
    } else {
      await navigator.clipboard
        .writeText(`${shareText}\n${shareUrl}`)
        .catch((err) => console.error("clipboard copy failed:", err));
      trackEvent("monthly_share", { month, sessions: monthCount, method: "clipboard" });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (shared) return null;

  return (
    <section className="mb-7">
      <p className="text-xs font-semibold text-zinc-400 tracking-widest px-0.5 mb-3 uppercase">
        {t("monthlyShare.sectionLabel")}
      </p>
      <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-hidden">
        {/* OGP Preview */}
        <div className="relative aspect-[1200/630] w-full bg-[#0f172a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ogUrl}
            alt={t("monthlyShare.previewAlt")}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Action area */}
        <div className="px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {t("monthlyShare.cta")}
          </p>
          <button
            onClick={handleShare}
            className="min-h-[44px] px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-full transition-colors flex items-center gap-2"
          >
            {copied ? t("monthlyShare.copied") : t("monthlyShare.shareButton")}
          </button>
        </div>
      </div>
    </section>
  );
}
