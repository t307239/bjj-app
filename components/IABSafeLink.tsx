"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { isInAppBrowser } from "@/lib/isInAppBrowser";
import { useLocale } from "@/lib/i18n";

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
    }).catch((err) => console.error("clipboard copy failed:", err));
  };

  return (
    <>
      <button onClick={handleClick} className={className}>
        {children}
      </button>
      {showBanner && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => setShowBanner(false)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-3">🌐</div>
            <h3 className="text-lg font-bold text-white mb-2">{t("login.iabWarning")}</h3>
            <p className="text-gray-400 text-sm mb-5">{t("login.iabDesc")}</p>
            <button
              onClick={copyUrl}
              className="w-full bg-[#10B981] hover:bg-[#0d9668] text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm mb-3"
            >
              {copied ? t("login.iabCopied") : t("login.iabCopy")}
            </button>
            <p className="text-gray-500 text-xs">{t("login.iabPaste")}</p>
          </div>
        </div>
      )}
    </>
  );
}
