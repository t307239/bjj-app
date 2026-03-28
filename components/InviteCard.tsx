"use client";
import { useState } from "react";
import { useLocale } from "@/lib/i18n";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

export default function InviteCard({ referralCode }: { referralCode: string }) {
  const { t } = useLocale();
  const [shared, setShared] = useState(false);
  const referralLink = `${APP_URL}/login?ref=${referralCode}`;

  const handleShare = async () => {
    const shareText = `${t("profile.referralShare")} ${referralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url: referralLink });
        return;
      } catch {
        // User cancelled or fallback
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(referralLink);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-zinc-900/50 p-5 flex items-center gap-4">
      <span className="text-3xl flex-shrink-0">🤝</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">
          {t("dashboard.inviteTitle")}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
          {t("dashboard.inviteDesc")}
        </p>
      </div>
      <button
        type="button"
        onClick={handleShare}
        className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
          shared
            ? "bg-emerald-600 text-white"
            : "bg-violet-600 hover:bg-violet-500 text-white"
        }`}
      >
        {shared ? t("profile.referralCopied") : t("dashboard.inviteCta")}
      </button>
    </div>
  );
}
