"use client";

import { useState, useEffect } from "react";

interface ShareButtonProps {
  title: string;
  url: string;
  lang: string;
}

/**
 * #32: Web Share API Button
 * On mobile (navigator.share available): opens native OS share sheet.
 * On desktop: copies URL to clipboard with visual feedback.
 */
export default function ShareButton({ title, url, lang }: ShareButtonProps) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const labels = {
    en: "Share",
    ja: "シェア",
    pt: "Compartilhar",
  };
  const copiedLabels = {
    en: "Copied!",
    ja: "コピー済み！",
    pt: "Copiado!",
  };

  const label = labels[lang as keyof typeof labels] ?? labels.en;
  const copiedLabel = copiedLabels[lang as keyof typeof copiedLabels] ?? copiedLabels.en;

  const shareTexts = {
    en: `${title} — Free BJJ technique guide on BJJ Wiki`,
    ja: `${title} — BJJ Wikiの無料テクニックガイド`,
    pt: `${title} — Guia de técnica gratuito no BJJ Wiki`,
  };
  const shareText = shareTexts[lang as keyof typeof shareTexts] ?? shareTexts.en;

  const handleShare = async () => {
    if (canShare) {
      try {
        await navigator.share({ title, url, text: shareText });
      } catch {
        // User cancelled or error — silently ignore
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } catch {}
    }
  };

  return (
    <button
      onClick={handleShare}
      aria-label={label}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-700 border border-slate-700/60 text-slate-400 hover:text-slate-200 transition-all focus-visible:ring-2 focus-visible:ring-pink-500"
    >
      {copied ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {copiedLabel}
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
