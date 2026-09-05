"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { safeSetItem, safeGetItem } from "@/lib/safeLocalStorage";

const STORAGE_KEY = "bjj_age_verified";

// Why: ROBUST(道場会員向けB2B)は登録時に生年月日＋18歳未満の保護者同意を取得するため、
//      公開版 bjj-app 向けの汎用 COPPA 13歳ゲートは表示しない（会員体験の阻害・二重確認の回避）。
const ROBUST_PATH_PREFIX = "/gym/robust";

/**
 * AgeGate — COPPA compliance hard block.
 * On first visit, shows an age verification modal.
 * If the user selects "Under 13", the entire screen is blocked.
 * Stores result in localStorage; verified users never see it again.
 */
export default function AgeGate() {
  const { t } = useLocale();
  const pathname = usePathname();
  const isRobust = pathname?.startsWith(ROBUST_PATH_PREFIX) ?? false;
  const [status, setStatus] = useState<"loading" | "show" | "blocked" | "ok">("loading");
  // z258: lock background scroll while the age-gate or block screen is up（ROBUST では出さないのでロックもしない）。
  useBodyScrollLock(!isRobust && (status === "show" || status === "blocked"));

  useEffect(() => {
    const stored = safeGetItem(STORAGE_KEY);
    if (stored === "true") {
      setStatus("ok");
    } else if (stored === "false") {
      setStatus("blocked");
    } else {
      setStatus("show");
    }
  }, []);

  const handleConfirm = (isOldEnough: boolean) => {
    safeSetItem(STORAGE_KEY, String(isOldEnough));
    setStatus(isOldEnough ? "ok" : "blocked");
  };

  // ROBUST 配下は年齢ゲートを一切表示しない（本体アプリのみ対象）。
  if (isRobust) return null;
  if (status === "loading" || status === "ok") return null;

  if (status === "blocked") {
    return (
      <div className="fixed inset-0 z-critical bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl mb-6">🔒</span>
        <h1 className="text-xl font-black text-white mb-3">{t("ageGate.blockedTitle")}</h1>
        <p className="text-zinc-400 text-sm max-w-xs leading-relaxed">
          {t("ageGate.blockedBody")}
        </p>
        <p className="text-zinc-600 text-xs mt-8">
          {t("ageGate.blockedContact")}
        </p>
      </div>
    );
  }

  // status === "show"
  return (
    <div className="fixed inset-0 z-critical bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label={t("common.ageVerification")}>
      <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-7 shadow-2xl text-center">
        <span className="text-4xl mb-4 block">🥋</span>
        <h2 className="text-lg font-black text-white mb-2">{t("ageGate.ageVerificationTitle")}</h2>
        <p className="text-zinc-400 text-sm leading-relaxed mb-7">
          {t("ageGate.body")}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleConfirm(true)}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-sm transition-all active:scale-95"
          >
            {t("ageGate.confirm")}
          </button>
          <button
            type="button"
            onClick={() => handleConfirm(false)}
            className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-semibold text-sm transition-all active:scale-95"
          >
            {t("ageGate.deny")}
          </button>
        </div>

        <p className="text-zinc-600 text-xs mt-5">
          {t("ageGate.footer")}
        </p>
      </div>
    </div>
  );
}
