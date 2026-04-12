"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";

const STORAGE_KEY = "bjj_age_verified";

/**
 * AgeGate — COPPA compliance hard block.
 * On first visit, shows an age verification modal.
 * If the user selects "Under 13", the entire screen is blocked.
 * Stores result in localStorage; verified users never see it again.
 */
export default function AgeGate() {
  const { t } = useLocale();
  const [status, setStatus] = useState<"loading" | "show" | "blocked" | "ok">("loading");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setStatus("ok");
    } else if (stored === "false") {
      setStatus("blocked");
    } else {
      setStatus("show");
    }
  }, []);

  const handleConfirm = (isOldEnough: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(isOldEnough));
    setStatus(isOldEnough ? "ok" : "blocked");
  };

  if (status === "loading" || status === "ok") return null;

  if (status === "blocked") {
    return (
      <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl mb-6">🔒</span>
        <h1 className="text-xl font-black text-white mb-3">{t("ageGate.title")}</h1>
        <p className="text-zinc-400 text-sm max-w-xs leading-relaxed">
          BJJ App is designed for users <span className="text-white font-semibold">{t("ageGate.ageRequirement")}</span>.
          We cannot allow access for users under 13 (COPPA compliance).
        </p>
        <p className="text-zinc-600 text-xs mt-8">
          If you believe this is an error, please have a parent or guardian contact us at{" "}
          <span className="text-zinc-400">307239t777@gmail.com</span>
        </p>
      </div>
    );
  }

  // status === "show"
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-7 shadow-2xl text-center">
        <span className="text-4xl mb-4 block">🥋</span>
        <h2 className="text-lg font-black text-white mb-2">{t("ageGate.ageVerificationTitle")}</h2>
        <p className="text-zinc-400 text-sm leading-relaxed mb-7">
          BJJ App collects training data. By US law (COPPA), we must verify you are{" "}
          <span className="text-white font-semibold">{t("ageGate.ageVerificationDesc")}</span> before continuing.
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleConfirm(true)}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-sm transition-all active:scale-95"
          >
            ✓ I am 13 or older
          </button>
          <button
            type="button"
            onClick={() => handleConfirm(false)}
            className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-semibold text-sm transition-all active:scale-95"
          >
            I am under 13
          </button>
        </div>

        <p className="text-zinc-600 text-xs mt-5">
          Required by US federal law · bjj-app.net
        </p>
      </div>
    </div>
  );
}
