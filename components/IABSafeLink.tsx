"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { isInAppBrowser } from "@/lib/isInAppBrowser";
import { useLocale } from "@/lib/i18n";
import { clientLogger } from "@/lib/clientLogger";

/**
 * IABSafeLink — Wraps Link to detect In-App Browsers (Instagram, Facebook, etc.)
 * When IAB is detected, clicking shows a "copy URL" banner instead of navigating
 * to /login where OAuth will fail silently.
 */
export default function IABSafeLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const [isIAB, setIsIAB] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setIsIAB(isInAppBrowser());
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    if (!showBanner) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowBanner(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showBanner]);

  if (!isIAB) {
    return <Link href={href} className={className}>{children}</Link>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowBanner(true);
  };

  const copyUrl = () => {
    const url = window.location.origin + href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }).catch((err) => clientLogger.error("clipboard_copy_failed", {}, err));
  };

  return (
    <>
      <button type="button" onClick={handleClick} className={className}>
        {children}
      </button>
      {showBanner && (
        <div
          role="presentation"
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setShowBanner(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("login.iabWarning")}
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center"
          >
            <div className="text-4xl mb-3">🌐</div>
            <h3 className="text-lg font-bold text-white mb-2">{t("login.iabWarning")}</h3>
            <p className="text-zinc-400 text-sm mb-5">{t("login.iabDesc")}</p>
            <button type="button"
              onClick={copyUrl}
              autoFocus
              className="w-full bg-[#10B981] hover:bg-[#0d9668] text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm mb-3"
            >
              {copied ? t("login.iabCopied") : t("login.iabCopy")}
            </button>
            <p className="text-zinc-500 text-xs">{t("login.iabPaste")}</p>
          </div>
        </div>
      )}
    </>
  );
}
