"use client";

import { useLocale } from "@/lib/i18n";

/** Footer button that dispatches a custom event to re-open CookieConsent. */
export default function CookieSettingsButton() {
  const { t } = useLocale();

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("bjj:open-cookie-settings"))}
      className="hover:text-zinc-400 transition-colors"
    >
      {t("common.cookieSettings")}
    </button>
  );
}
