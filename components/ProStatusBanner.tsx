"use client";

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
  if (!subscriptionStatus || subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return null;
  }

  if (subscriptionStatus === "past_due") {
    return (
      <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm">
        <span className="text-lg leading-none" aria-hidden="true">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-300">お支払いが失敗しました</p>
          <p className="text-red-400/80 text-xs mt-0.5">
            カードの有効期限切れまたは残高不足です。Proアクセスを維持するには決済情報を更新してください。
          </p>
        </div>
        <form action="/api/stripe/portal" method="POST" className="flex-shrink-0">
          <button
            type="submit"
            className="rounded-lg bg-red-500 hover:bg-red-400 px-3 py-1.5 text-xs font-bold text-white transition-colors whitespace-nowrap"
          >
            カードを更新
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
          <p className="font-semibold text-zinc-300">Proプランが解約されました</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            プレミアム機能は無効化されています。再度アップグレードして全機能をご利用ください。
          </p>
        </div>
        <Link
          href="/profile#upgrade"
          className="flex-shrink-0 rounded-lg bg-yellow-500 hover:bg-yellow-400 px-3 py-1.5 text-xs font-bold text-black transition-colors whitespace-nowrap"
        >
          再加入
        </Link>
      </div>
    );
  }

  return null;
}
