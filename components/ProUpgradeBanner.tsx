"use client";

import { useLocale } from "@/lib/i18n";

type Props = {
  isPro: boolean;
};

const PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "#";

export default function ProUpgradeBanner({ isPro }: Props) {
  const { t } = useLocale();

  if (isPro) return null;

  return (
    <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-xl px-4 py-3 mb-4 border border-yellow-500/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-yellow-400 mb-1">{t("pro.bannerTitle")}</p>
          <p className="text-[11px] text-gray-400">
            {t("pro.bannerFeatures")}
          </p>
        </div>
        <a
          href={PAYMENT_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 ml-3 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          {t("pro.bannerCta")}
        </a>
      </div>
    </div>
  );
}
