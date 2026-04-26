"use client";

/**
 * GymUpgradeCheckoutButton — z178: 14-day trial CTA → Stripe checkout
 *
 * POSTs to /api/stripe/checkout {plan:"gym"} → redirects to Stripe-hosted
 * checkout page. Existing endpoint returns either {url} (Checkout Session) or
 * {url, fallback:true} (static Payment Link if STRIPE_GYM_PRICE_ID unset).
 *
 * GA event 'plg_upgrade_click' for funnel attribution (refSource: plg_email
 * or wiki or direct).
 */
import { useState } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

interface Props {
  ctaLabel: string;
  refSource: string;
}

export default function GymUpgradeCheckoutButton({ ctaLabel, refSource }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      // Telemetry first (in case the redirect kills the event)
      window.gtag?.("event", "plg_upgrade_click", {
        plan: "gym",
        ref: refSource,
      });

      // z181: pass attribution ref to Stripe checkout (saved as metadata.ref).
      // Sanitize: ref must be [a-z0-9_], else server rejects with 400.
      const safeRef = /^[a-z][a-z0-9_]{0,49}$/.test(refSource) ? refSource : "direct";
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "gym", ref: safeRef }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Checkout failed");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="block w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl text-base transition-colors"
        aria-label={ctaLabel}
      >
        {loading ? "..." : ctaLabel}
      </button>
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-sm text-red-400 mt-3"
        >
          {error}
        </p>
      )}
    </>
  );
}
