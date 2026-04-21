"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";

const STORAGE_KEY = "bjj_cookie_consent";

export type CookiePreferences = {
  essential: true; // always true — cannot be disabled
  analytics: boolean;
  marketing: boolean;
};

/** Read stored cookie preferences. Returns null if user hasn't chosen yet. */
export function getCookiePreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Legacy: "accepted" or "declined" string
    if (raw === "accepted") return { essential: true, analytics: true, marketing: true };
    if (raw === "declined") return { essential: true, analytics: false, marketing: false };
    return JSON.parse(raw) as CookiePreferences;
  } catch {
    return null;
  }
}

export default function CookieConsent() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage unavailable — don't show
    }
  }, []);

  function save(prefs: CookiePreferences) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch { /* noop */ }
    setVisible(false);
  }

  function handleAcceptAll() {
    save({ essential: true, analytics: true, marketing: true });
  }

  function handleDeclineAll() {
    save({ essential: true, analytics: false, marketing: false });
  }

  function handleSaveCustom() {
    save({ essential: true, analytics, marketing });
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
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

        {showDetails && (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            {/* Essential — always on */}
            <label className="flex items-center justify-between text-sm">
              <span className="text-zinc-300">{t("common.cookieEssential")}</span>
              <input
                type="checkbox"
                checked
                disabled
                className="accent-emerald-500 w-4 h-4"
                aria-label={t("common.cookieEssential")}
              />
            </label>
            {/* Analytics */}
            <label className="flex items-center justify-between text-sm cursor-pointer">
              <span className="text-zinc-300">{t("common.cookieAnalytics")}</span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="accent-emerald-500 w-4 h-4"
                aria-label={t("common.cookieAnalytics")}
              />
            </label>
            {/* Marketing */}
            <label className="flex items-center justify-between text-sm cursor-pointer">
              <span className="text-zinc-300">{t("common.cookieMarketing")}</span>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="accent-emerald-500 w-4 h-4"
                aria-label={t("common.cookieMarketing")}
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          {showDetails ? (
            <button type="button"
              onClick={handleSaveCustom}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2 rounded-xl transition-colors min-h-[44px]"
            >
              {t("common.cookieSavePreferences")}
            </button>
          ) : (
            <>
              <button type="button"
                onClick={handleAcceptAll}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2 rounded-xl transition-colors min-h-[44px]"
              >
                {t("common.cookieConsentAccept")}
              </button>
              <button type="button"
                onClick={handleDeclineAll}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold py-2 rounded-xl border border-white/10 transition-colors min-h-[44px]"
              >
                {t("common.cookieConsentDecline")}
              </button>
            </>
          )}
        </div>
        {!showDetails && (
          <button type="button"
            onClick={() => setShowDetails(true)}
            className="w-full text-center text-xs text-zinc-400 hover:text-zinc-300 mt-2 py-1 transition-colors"
          >
            {t("common.cookieCustomize")}
          </button>
        )}
      </div>
    </div>
  );
}
