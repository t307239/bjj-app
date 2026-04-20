"use client";

import { useState, useEffect, useCallback } from "react";

type Props = {
  onClose: () => void;
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
  t: (k: string) => string;
};

export default function ProModal({ onClose, stripePaymentLink, stripeAnnualLink, t }: Props) {
  const [isAnnual, setIsAnnual] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // §1 UX: Escape key dismiss
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
  const fallbackUrl = isAnnual ? stripeAnnualLink : stripePaymentLink;

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: isAnnual ? "annual" : "monthly" }),
      });
      if (res.ok) {
        const json = await res.json() as { url?: string; fallback?: boolean };
        if (json.url && !json.fallback) {
          window.location.href = json.url;
          return;
        }
      }
    } catch {
      // network error — fall through to static link
    }
    if (fallbackUrl) window.location.href = fallbackUrl;
    setIsLoading(false);
  };

  const hasLink = !!fallbackUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-7 max-w-sm w-full text-center shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-4xl mb-3">🥋</div>
        <h3 className="text-lg font-bold text-white mb-2">{t("skillmap.proModalTitlePC")}</h3>
        <p className="text-sm text-zinc-400 mb-4">{t("skillmap.proModalBodyPC")}</p>
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className={`text-xs ${!isAnnual ? "text-white font-semibold" : "text-zinc-400"}`}>{t("proModal.monthly")}</span>
          <button
            role="switch"
            aria-checked={isAnnual}
            aria-label={t("proModal.togglePlan")}
            onClick={() => setIsAnnual((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isAnnual ? "bg-emerald-600" : "bg-zinc-600"}`}
          >
            <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${isAnnual ? "translate-x-5" : "translate-x-1"}`} />
          </button>
          <span className={`text-xs ${isAnnual ? "text-white font-semibold" : "text-zinc-400"}`}>{t("proModal.annual")}</span>
          {isAnnual && <span className="bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{t("proModal.save33")}</span>}
        </div>
        <div className="mb-1">
          {isAnnual
            ? <p className="text-white font-bold text-sm">$79.99 / year <span className="text-emerald-400 text-xs">≈ $6.67/mo</span></p>
            : <p className="text-white font-bold text-sm">$9.99 / month</p>}
        </div>
        <p className="text-xs text-emerald-400 mb-4">{t("proModal.trialText")}</p>
        {hasLink ? (
          <button
            onClick={handleCheckout}
            disabled={isLoading}
            className="block w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 disabled:opacity-60 text-black font-semibold py-3 rounded-xl mb-3 transition-all"
          >
            {isLoading ? "…" : t("skillmap.upgradeBtn")}
          </button>
        ) : (
          <span className="block w-full bg-zinc-700 text-zinc-400 font-semibold py-3 rounded-xl mb-3 cursor-not-allowed">
            {t("skillmap.upgradeBtn")}
          </span>
        )}
        <button onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-300 min-h-[44px] px-6 py-2">{t("skillmap.maybeLater")}</button>
        <p className="mt-2">
          <a href="/help" className="text-xs text-zinc-500 hover:text-zinc-400 underline underline-offset-2">
            {t("proModal.alreadyPro")}
          </a>
        </p>
      </div>
    </div>
  );
}
