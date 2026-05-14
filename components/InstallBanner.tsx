"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n";
import { clientLogger } from "@/lib/clientLogger";
import { safeSetItem, safeGetItem } from "@/lib/safeLocalStorage";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const { t, locale } = useLocale();
  const [dismissed, setDismissed] = useState(true);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const isDismissed = safeGetItem("bjj_install_dismissed") === "1";
    if (isDismissed) { setDismissed(true); return; }
    // B-03: Show install banner only after 3rd session log (dopamine moment)
    const logCount = parseInt(safeGetItem("bjj_log_count") ?? "0", 10);
    if (logCount < 3) { setDismissed(true); return; }
    // iOS detection: iPhone/iPad/iPod + iPadOS 13+ desktop mode (UA reports Mac
     // but maxTouchPoints > 1 indicates touchscreen iPad). Exclude already-installed
     // (standalone mode) to avoid false positive on home-screen-launched PWA.
    const ua = navigator.userAgent;
    const isIPadOSDesktopMode =
      /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const isIOSUA = /iPhone|iPad|iPod/.test(ua) || isIPadOSDesktopMode;
    const isStandalone =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches);
    // z255ccc: when user is currently using the installed PWA (standalone mode),
    // mark dismissed permanently in localStorage so other tabs/Safari sessions
    // also skip the banner. This is a one-time auto-suppress, NOT a manual dismiss.
    if (isStandalone) {
      safeSetItem("bjj_install_dismissed", "1");
      setDismissed(true);
      return;
    }
    const isIOS = isIOSUA && !isStandalone;
    if (isIOS) { setPlatform("ios"); setDismissed(false); return; }
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      setDismissed(false);
    };
    // z255ccc: Listen for `appinstalled` event (fires after Android Chrome install
    // succeeds OR system add-to-home-screen completes). Persist dismissal so the
    // banner never re-appears after install — even if user opens app in a new
    // browser tab where standalone-mode detection wouldn't apply.
    const handleAppInstalled = () => {
      safeSetItem("bjj_install_dismissed", "1");
      setDismissed(true);
      setPlatform(null);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => { safeSetItem("bjj_install_dismissed", "1"); setDismissed(true); };

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") { safeSetItem("bjj_install_dismissed", "1"); setDismissed(true); }
    } catch (err) {
      clientLogger.error("pwa.install_prompt_error", {}, err);
      setInstallError(true);
      errorTimerRef.current = setTimeout(() => setInstallError(false), 3000);
    }
    finally { setIsInstalling(false); setDeferredPrompt(null); }
  };

  if (dismissed || !platform) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-dropdown bg-gradient-to-r from-[#0d9668] to-[#10B981] text-white p-4 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          {platform === "ios" ? (
            <p className="text-sm font-medium">
              📲 {t("install.ios")}
              <br />
              <span className="text-xs opacity-90">{t("install.iosInstructions")}</span>
            </p>
          ) : (
            <p className="text-sm font-medium">📲 {t("install.android")}</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {platform === "android" && (
            <div className="flex flex-col items-end gap-1">
              <button type="button" onClick={handleInstallAndroid} disabled={isInstalling}
                className="px-4 py-2 bg-white text-[#0d9668] font-semibold rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50 text-sm">
                {isInstalling ? t("install.installing") : t("install.button")}
              </button>
              {installError && (
                <span className="text-xs text-red-200">{t("install.error")}</span>
              )}
            </div>
          )}
          <button type="button" onClick={handleDismiss} className="px-3 py-2 hover:bg-[#0d9668] rounded-lg transition-colors text-sm font-medium" aria-label={t("install.close")}>✕</button>
        </div>
      </div>
    </div>
  );
}