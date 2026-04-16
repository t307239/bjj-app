"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

const STRIPE_MONTHLY_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "#";
const STRIPE_ANNUAL_LINK = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_LINK ?? "#";

interface ProGateProps {
  isPro: boolean;
  children: React.ReactNode;
  feature?: string;
  userId?: string;
}

/**
 * ProGate — wraps any feature with a paywall blur overlay.
 * If the user is Pro, renders children directly.
 * If not, renders a blurred preview with an upgrade CTA.
 */
export default function ProGate({
  isPro,
  children,
  feature,
  userId,
}: ProGateProps) {
  const { t } = useLocale();
  const [isAnnual, setIsAnnual] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const featureText = feature || t("pro.defaultFeature");

  if (isPro) {
    return <>{children}</>;
  }

  // Build payment links with userId metadata so webhook can identify the user
  const monthlyUrl = userId
    ? `${STRIPE_MONTHLY_LINK}?client_reference_id=${userId}`
    : STRIPE_MONTHLY_LINK;
  const annualUrl = userId
    ? `${STRIPE_ANNUAL_LINK}?client_reference_id=${userId}`
    : STRIPE_ANNUAL_LINK;
  const paymentUrl = isAnnual ? annualUrl : monthlyUrl;

  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none blur-sm opacity-60">
        {children}
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-zinc-950/80 backdrop-blur-sm border border-white/10 z-10">
        <div className="text-center px-4">
          <div className="text-2xl mb-2">🔒</div>
          <p className="text-sm text-zinc-300 mb-1">{featureText}</p>
          <p className="text-xs text-zinc-400 mb-3">{t("pro.available")}</p>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className={`text-xs whitespace-nowrap ${!isAnnual ? "text-white font-semibold" : "text-zinc-400"}`}>{t("pro.monthly")}</span>
            <button
              onClick={() => setIsAnnual((v) => !v)}
              aria-label="Toggle billing period"
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                isAnnual ? "bg-emerald-600" : "bg-zinc-600"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  isAnnual ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
            <span className={`text-xs whitespace-nowrap ${isAnnual ? "text-white font-semibold" : "text-zinc-400"}`}>{t("pro.annual")}</span>
            {isAnnual ? (
              <span className="bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                {t("pro.savePct")}
              </span>
            ) : (
              <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                {t("pro.urgencyBadge")}
              </span>
            )}
          </div>

          {/* Price display */}
          <div className="mb-3">
            {isAnnual ? (
              <div>
                <p className="text-white font-bold text-sm">{t("pro.annualPrice")} <span className="text-emerald-400 text-xs">{t("pro.annualPerMonth")}</span></p>
                <p className="text-emerald-400 text-xs mt-0.5">{t("pro.annualSavings")}</p>
              </div>
            ) : (
              <p className="text-white font-bold text-sm">{t("pro.monthlyPrice")}</p>
            )}
          </div>

          {/* Free vs Pro comparison table */}
          <div className="max-w-xs mx-auto mb-3 rounded-lg border border-white/10 overflow-hidden text-xs">
            <div className="grid grid-cols-3 bg-zinc-800/60 text-zinc-300 font-semibold">
              <div className="px-2 py-1.5 text-left">{t("pro.compareTitle")}</div>
              <div className="px-2 py-1.5 text-center">{t("pro.compareFree")}</div>
              <div className="px-2 py-1.5 text-center text-emerald-400">{t("pro.comparePro")}</div>
            </div>
            {[
              { label: t("pro.compareLog"), free: true, pro: true },
              { label: t("pro.compareTechniques"), free: true, pro: true },
              { label: t("pro.compareHeatmap"), free: true, pro: true },
              { label: t("pro.compareAI"), free: false, pro: true },
              { label: t("pro.compareStreak"), free: false, pro: true },
              { label: t("pro.compareExport"), free: false, pro: true },
              { label: t("pro.compareRoll"), free: false, pro: true },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-3 ${i % 2 === 0 ? "bg-zinc-900/40" : "bg-zinc-900/20"}`}>
                <div className="px-2 py-1 text-left text-zinc-300 whitespace-nowrap">{row.label}</div>
                <div className={`px-2 py-1 text-center ${row.free ? "text-emerald-400" : "text-zinc-600"}`}>
                  {row.free ? t("pro.compareCheck") : t("pro.compareCross")}
                </div>
                <div className="px-2 py-1 text-center text-emerald-400">{t("pro.compareCheck")}</div>
              </div>
            ))}
          </div>

          {/* Stripe pre-checkout disclaimer */}
          <label className="flex items-start gap-2 mb-3 cursor-pointer text-left max-w-xs mx-auto">
            <input
              type="checkbox"
              checked={disclaimerAccepted}
              onChange={(e) => setDisclaimerAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-zinc-800 accent-yellow-500 flex-shrink-0 cursor-pointer"
              aria-label={t("pro.disclaimerAria")}
            />
            <span className="text-xs text-zinc-300 leading-relaxed">
              {t("pro.disclaimer")}
            </span>
          </label>

          <a
            href={disclaimerAccepted ? paymentUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-block text-sm font-bold px-5 py-2 rounded-lg transition-colors ${
              disclaimerAccepted
                ? "bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer"
                : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
            }`}
            onClick={(e) => {
              if (!disclaimerAccepted) {
                e.preventDefault();
                return;
              }
              trackEvent("pro_upgrade_click", { feature: featureText });
            }}
            aria-disabled={!disclaimerAccepted}
          >
            {t("pro.upgradeButton")}
          </a>
          {/* Money-back guarantee */}
          <p className="text-emerald-400/80 text-xs font-medium mt-2">
            {t("pro.moneyBack")}
          </p>
          {/* Social proof + benefit */}
          <p className="text-xs text-zinc-500 mt-1.5">
            {t("pro.socialProof")}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {t("pro.benefitHighlight")}
          </p>
        </div>
      </div>
    </div>
  );
}
