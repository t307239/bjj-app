"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

const STRIPE_MONTHLY_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || null;
const STRIPE_ANNUAL_LINK = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_LINK || null;

export default function PricingSection({ userId }: { userId?: string | null }) {
  const { t } = useLocale();
  const [isAnnual, setIsAnnual] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const monthlyUrl = userId && STRIPE_MONTHLY_LINK
    ? `${STRIPE_MONTHLY_LINK}?client_reference_id=${userId}`
    : "/login";

  const annualUrl = userId && STRIPE_ANNUAL_LINK
    ? `${STRIPE_ANNUAL_LINK}?client_reference_id=${userId}`
    : "/login";

  const upgradeUrl = isAnnual ? annualUrl : monthlyUrl;

  const freeFeatures = [
    t("pricing.freeF1"),
    t("pricing.freeF2"),
    t("pricing.freeF3"),
    t("pricing.freeF4"),
    t("pricing.freeF5"),
    t("pricing.freeF6"),
    t("pricing.freeF7"),
    t("pricing.freeF8"),
  ];

  const proFeatures = [
    { text: t("pricing.proF1"), icon: "✓" },
    { text: t("pricing.proF2"), icon: "★" },
    { text: t("pricing.proF3"), icon: "★" },
    { text: t("pricing.proF4"), icon: "★" },
    { text: t("pricing.proF5"), icon: "★" },
    { text: t("pricing.proF6"), icon: "★" },
    { text: t("pricing.proF7"), icon: "★" },
    { text: t("pricing.proF8"), icon: "★" },
    { text: t("pricing.proF9"), icon: "★" },
  ];

  return (
    <section id="pricing" className="px-4 py-16 bg-zinc-900/50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-3 text-white">
          {t("pricing.title")}
        </h2>
        <p className="text-zinc-400 text-center text-sm mb-8">
          {t("pricing.subtitle")}
        </p>

        {/* Monthly / Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium whitespace-nowrap ${!isAnnual ? "text-white" : "text-zinc-400"}`}>
            {t("pricing.monthly")}
          </span>
          <button
            onClick={() => setIsAnnual((v) => !v)}
            aria-label="Toggle billing period"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
              isAnnual ? "bg-emerald-600" : "bg-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                isAnnual ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-sm font-medium whitespace-nowrap ${isAnnual ? "text-white" : "text-zinc-400"}`}>
            {t("pricing.annually")}
          </span>
          {isAnnual && (
            <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
              {t("pricing.savePctAnnual")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free */}
          <div className="bg-zinc-900 rounded-2xl p-8 border border-white/10">
            <div className="text-lg font-bold mb-1">{t("pricing.freePlan")}</div>
            <div className="text-3xl font-bold text-white mb-1">{t("pricing.freePrice")}</div>
            <div className="text-zinc-400 text-xs mb-6">{t("pricing.freeForever")}</div>
            <ul className="space-y-3 text-sm text-zinc-400">
              {freeFeatures.map((feat, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-green-400 flex-shrink-0">✓</span> {feat}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="mt-8 block text-center bg-[#10B981] hover:bg-[#0d9668] text-white font-bold py-3 rounded-full transition-all"
            >
              {t("pricing.getStarted")}
            </Link>
            <p className="text-zinc-500 text-xs text-center mt-3">
              {t("pricing.freeUpsell")}
            </p>
          </div>

          {/* Pro */}
          <div className="bg-zinc-900 rounded-2xl p-8 border border-yellow-500/50 relative">
            <div className="absolute -top-3 right-6 bg-yellow-500 text-black text-xs px-3 py-1 rounded-full font-bold">
              {t("pricing.mostPopular")}
            </div>
            <div className="text-lg font-bold mb-1">{t("pricing.proPlan")}</div>

            {/* Price display toggles */}
            {isAnnual ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="text-3xl font-bold text-white whitespace-nowrap">{t("pricing.proAnnual")}</div>
                  <span className="text-sm font-normal text-zinc-400 whitespace-nowrap">{t("pricing.proAnnualUnit")}</span>
                  <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    {t("pricing.savePct")}
                  </span>
                </div>
                <div className="text-zinc-400 text-xs mb-6">
                  {t("pricing.proAnnualApprox")} · {t("pricing.proAnnualBilled")}
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-white mb-1">
                  {t("pricing.proMonthly")}
                  <span className="text-sm font-normal text-zinc-400">{t("pricing.proMonthlyUnit")}</span>
                </div>
                <div className="text-zinc-400 text-xs mb-6">{t("pricing.proMonthlyBilled")}</div>
              </>
            )}

            <ul className="space-y-3 text-sm text-zinc-400">
              {proFeatures.map((feat, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className={`flex-shrink-0 ${feat.icon === "★" ? "text-yellow-400" : "text-green-400"}`}>
                    {feat.icon}
                  </span>
                  {feat.text}
                </li>
              ))}
            </ul>

            {/* Stripe pre-checkout disclaimer */}
            <label className="flex items-start gap-2 mt-6 cursor-pointer text-left">
              <input
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-zinc-800 accent-yellow-500 flex-shrink-0 cursor-pointer"
                aria-label={t("pro.disclaimerAria")}
              />
              <span className="text-xs text-zinc-400 leading-relaxed">
                {t("pricing.disclaimerText").split("{terms}")[0]}
                <Link href="/terms" className="text-emerald-400 hover:underline">{t("pricing.termsLink")}</Link>
                {t("pricing.disclaimerText").split("{terms}")[1] || ""}
              </span>
            </label>

            <p className="text-emerald-400/80 text-xs text-center mt-3 mb-1">
              {t("pricing.proTrialHint")}
            </p>
            <a
              href={disclaimerAccepted ? upgradeUrl : undefined}
              className={`block text-center font-bold py-3 rounded-full transition-all ${
                disclaimerAccepted
                  ? "bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer"
                  : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              }`}
              onClick={(e) => {
                if (!disclaimerAccepted) {
                  e.preventDefault();
                  return;
                }
                trackEvent("pricing_upgrade_click", { plan: isAnnual ? "annual" : "monthly" });
              }}
              aria-disabled={!disclaimerAccepted}
            >
              {t("pricing.upgradeToPro")}
            </a>
            {/* Money-back guarantee + benefit highlight */}
            <p className="text-emerald-400 text-xs font-medium text-center mt-3">
              {t("pricing.moneyBack")}
            </p>
            <p className="text-zinc-500 text-xs text-center mt-1">
              {t("pricing.benefitHighlight")}
            </p>
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-10 text-center">
          <p className="text-zinc-500 text-xs">
            {t("pricing.socialProof")}
          </p>
        </div>
      </div>
    </section>
  );
}
