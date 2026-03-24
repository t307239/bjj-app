"use client";

import { useLocale } from "@/lib/i18n";

type Props = {
  isPro: boolean;
};

const PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;

export default function ProUpgradeBanner({ isPro }: Props) {
  const { t } = useLocale();

  if (isPro) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-emerald-950/30 to-zinc-900 rounded-xl px-4 py-3.5 mb-4 border border-emerald-500/20 shadow-sm shadow-emerald-900/20">
      {/* Subtle glow accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent pointer-events-none" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-emerald-400 mb-0.5">{t("pro.bannerTitle")}</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {t("pro.bannerFeatures")}
          </p>
          {/* Social proof */}
          <p className="text-[10px] text-zinc-500 mt-1">{t("pro.socialProof")}</p>
        </div>
        {PAYMENT_LINK ? (
          <a
            href={PAYMENT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-black text-xs font-black px-4 py-2 rounded-lg transition-all shadow-sm shadow-emerald-900/40"
          >
            {t("pro.bannerCta")}
          </a>
        ) : (
          <span className="flex-shrink-0 bg-zinc-700 text-zinc-500 text-xs font-semibold px-4 py-2 rounded-lg cursor-not-allowed">
            {t("pro.bannerCta")}
          </span>
        )}
      </div>
    </div>
  );
}
