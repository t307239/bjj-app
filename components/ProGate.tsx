"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

const STRIPE_MONTHLY_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "#";
const STRIPE_ANNUAL_LINK = process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_LINK ?? "#";

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
          <p className="text-sm text-gray-400 mb-1">{featureText}</p>
          <p className="text-xs text-gray-500 mb-3">{t("pro.available")}</p>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className={`text-xs ${!isAnnual ? "text-white font-semibold" : "text-gray-500"}`}>Monthly</span>
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
            <span className={`text-xs ${isAnnual ? "text-white font-semibold" : "text-gray-500"}`}>Annual</span>
            {isAnnual && (
              <span className="bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                Save 16%
              </span>
            )}
          </div>

          {/* Price display */}
          <div className="mb-3">
            {isAnnual ? (
              <p className="text-white font-bold text-sm">$49.99 / year <span className="text-emerald-400 text-xs">≈ $4.17/mo</span></p>
            ) : (
              <p className="text-white font-bold text-sm">$4.99 / month</p>
            )}
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
            <span className="text-xs text-gray-400 leading-relaxed">
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
                : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
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
          <p className="text-xs text-gray-500 mt-2">
            {t("pro.features")}
          </p>
        </div>
      </div>
    </div>
  );
}
