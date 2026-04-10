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

  if (monthCount < 1) return null;

  const hoursNum = monthHoursStr
    ? monthHoursStr.replace(/h.*/, "").replace("m", "")
    : "0";

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

  /* Compact stat pills — no OGP image inline (image used via og:meta for social previews only) */
  const stats = [
    { value: monthCount, label: "🥋", color: "text-emerald-400" },
    { value: hoursNum + "h", label: "⏱", color: "text-blue-400" },
    ...(streak > 0 ? [{ value: streak, label: "🔥", color: "text-yellow-400" }] : []),
    ...(techniqueCount > 0 ? [{ value: techniqueCount, label: "💡", color: "text-purple-400" }] : []),
  ];

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/10 px-4 py-3 flex items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-x-auto">
        {stats.map((s, i) => (
          <span key={i} className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-sm">{s.label}</span>
            <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
          </span>
        ))}
        <span className="text-xs text-zinc-500 whitespace-nowrap">{t("monthlyShare.cta")}</span>
      </div>
      <button
        onClick={handleShare}
        className="min-h-[36px] px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0"
      >
        {copied ? t("monthlyShare.copied") : t("monthlyShare.shareButton")}
      </button>
    </div>
  );
}
