"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";

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

  useEffect(() => {
    const isDismissed = localStorage.getItem("bjj_install_dismissed") === "1";
    if (isDismissed) { setDismissed(true); return; }
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.navigator as Navigator & { standalone?: boolean }).standalone;
    if (isIOS) { setPlatform("ios"); setDismissed(false); return; }
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      setDismissed(false);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleDismiss = () => { localStorage.setItem("bjj_install_dismissed", "1"); setDismissed(true); };

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") { localStorage.setItem("bjj_install_dismissed", "1"); setDismissed(true); }
    } catch (err) { console.error("Install prompt error:", err); }
    finally { setIsInstalling(false); setDeferredPrompt(null); }
  };

  if (dismissed || !platform) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-[#0d9668] to-[#10B981] text-white p-4 shadow-lg">
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
            <button onClick={handleInstallAndroid} disabled={isInstalling}
              className="px-4 py-2 bg-white text-[#0d9668] font-semibold rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50 text-sm">
              {isInstalling ? t("install.installing") : t("install.button")}
            </button>
          )}
          <button onClick={handleDismiss} className="px-3 py-2 hover:bg-[#0d9668] rounded-lg transition-colors text-sm font-medium" aria-label={t("install.close")}>✕</button>
        </div>
      </div>
    </div>
  );
}