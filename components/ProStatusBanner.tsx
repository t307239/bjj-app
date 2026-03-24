"use client";

import { useLocale } from "@/lib/i18n";

const PORTAL_URL = process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL ?? "#";

type Props = {
  isPro: boolean;
  subscriptionStatus?: string | null;
};

export default function ProStatusBanner({ isPro, subscriptionStatus }: Props) {
  const { t } = useLocale();

  // Payment failure: show urgent banner
  if (subscriptionStatus === "past_due") {
    return (
      <div className="bg-red-950/60 border border-red-500/40 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-lg shrink-0">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-red-300 text-sm font-semibold">{t("pro.paymentIssueTitle")}</p>
          <p className="text-zinc-500 text-xs">{t("pro.paymentIssueDesc")}</p>
        </div>
        <a
          href={PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 bg-red-500 hover:bg-red-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
        >
          {t("pro.fixNow")}
        </a>
      </div>
    );
  }

  // Active Pro: show badge inline (subtle, not a banner)
  if (isPro) {
    return (
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 text-xs font-bold px-2.5 py-1 rounded-full">
          ⭐ PRO
        </span>
        <span className="text-xs text-zinc-400">{t("pro.allFeaturesUnlocked")}</span>
      </div>
    );
  }

  return null;
}
