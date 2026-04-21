"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n";

interface ProStatusBannerProps {
  subscriptionStatus: string | null | undefined;
}

/**
 * ProStatusBanner — shown in dashboard when Stripe subscription is in a bad state.
 *
 * past_due : invoice.payment_failed — card expired / insufficient funds
 *            Stripe is retrying; user still has Pro access but should update card.
 *
 * canceled : customer.subscription.deleted — access already revoked via webhook
 *            (is_pro=false at this point so this banner rarely shows, but kept as safety net)
 */
export default function ProStatusBanner({ subscriptionStatus }: ProStatusBannerProps) {
  const { t } = useLocale();
  const [portalLoading, setPortalLoading] = useState(false);

  if (!subscriptionStatus || subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return null;
  }

  if (subscriptionStatus === "past_due") {
    return (
      <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm">
        <span className="text-lg leading-none" aria-hidden="true">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-300">{t("pro.pastDueTitle")}</p>
          <p className="text-red-400/80 text-xs mt-0.5">
            {t("pro.pastDueDesc")}
          </p>
        </div>
        <form action="/api/stripe/portal" method="POST" noValidate className="flex-shrink-0" onSubmit={() => setPortalLoading(true)}>
          <button
            type="submit"
            disabled={portalLoading}
            className="rounded-lg bg-red-500 hover:bg-red-400 px-3 py-1.5 text-xs font-bold text-white transition-colors whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none"
          >
            {portalLoading ? "…" : t("pro.updateCard")}
          </button>
        </form>
      </div>
    );
  }

  if (subscriptionStatus === "canceled") {
    return (
      <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-zinc-600/40 bg-zinc-900/60 px-4 py-3 text-sm">
        <span className="text-lg leading-none" aria-hidden="true">🔒</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-300">{t("pro.canceledTitle")}</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {t("pro.canceledDesc")}
          </p>
        </div>
        <Link
          href="/profile#upgrade"
          className="flex-shrink-0 rounded-lg bg-yellow-500 hover:bg-yellow-400 px-3 py-1.5 text-xs font-bold text-black transition-colors whitespace-nowrap"
        >
          {t("pro.rejoin")}
        </Link>
      </div>
    );
  }

  return null;
}
