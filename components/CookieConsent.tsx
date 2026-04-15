"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";

const STORAGE_KEY = "bjj_cookie_consent";

export default function CookieConsent() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if user hasn't already consented/declined
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage unavailable — don't show
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch { /* noop */ }
    setVisible(false);
  }

  function handleDecline() {
    try {
      localStorage.setItem(STORAGE_KEY, "declined");
    } catch { /* noop */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t("common.cookieConsent")}
      className="fixed bottom-0 inset-x-0 z-[9999] p-3 sm:p-4"
    >
      <div className="max-w-lg mx-auto bg-zinc-900 border border-white/10 rounded-2xl p-4 shadow-2xl">
        <p className="text-sm text-zinc-300 leading-relaxed">
          {t("common.cookieConsentMessage")}{" "}
          <a
            href="/privacy"
            className="text-emerald-400 underline underline-offset-2"
          >
            {t("common.cookieConsentPrivacy")}
          </a>
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleAccept}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
          >
            {t("common.cookieConsentAccept")}
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold py-2 rounded-xl border border-white/10 transition-colors"
          >
            {t("common.cookieConsentDecline")}
          </button>
        </div>
      </div>
    </div>
  );
}
