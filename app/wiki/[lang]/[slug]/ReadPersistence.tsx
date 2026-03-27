"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface ReadPersistenceProps {
  slug: string;
  lang?: string;
}

const STRINGS: Record<string, { title: string; body: string; resume: string; startOver: string; dismiss: string }> = {
  ja: {
    title: "続きから読む？",
    body: "この記事の途中まで読みました。",
    resume: "続きから",
    startOver: "最初から",
    dismiss: "閉じる",
  },
  pt: {
    title: "Continuar lendo?",
    body: "Você estava lendo este artigo anteriormente.",
    resume: "Retomar",
    startOver: "Reiniciar",
    dismiss: "Fechar",
  },
  en: {
    title: "Continue reading?",
    body: "You were reading this article earlier.",
    resume: "Resume",
    startOver: "Start over",
    dismiss: "Dismiss",
  },
};

/**
 * #45: Read position persistence via localStorage
 * - Saves scroll Y position every second while reading
 * - On next visit, shows "Continue reading?" toast if user left midway
 * - Dismiss removes the saved position
 */
export default function ReadPersistence({ slug, lang = "en" }: ReadPersistenceProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [savedY, setSavedY] = useState(0);
  const storageKey = `wiki-scroll-${slug}`;
  const saveRef = useRef(false);
  const s = STRINGS[lang] ?? STRINGS.en;

  // Load saved position on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const y = parseInt(saved, 10);
        // Only show if they scrolled at least 300px
        if (y > 300) {
          setSavedY(y);
          setShowBanner(true);
        }
      }
    } catch {
      // localStorage blocked (private mode etc.) — silently ignore
    }
    saveRef.current = true;
  }, [storageKey]);

  // Save scroll position (throttled to once per second)
  useEffect(() => {
    let lastSave = 0;
    const save = () => {
      if (!saveRef.current) return;
      const now = Date.now();
      if (now - lastSave < 1000) return;
      lastSave = now;
      try {
        localStorage.setItem(storageKey, String(Math.round(window.scrollY)));
      } catch {}
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [storageKey]);

  const resume = useCallback(() => {
    window.scrollTo({ top: savedY, behavior: "smooth" });
    setShowBanner(false);
  }, [savedY]);

  const dismiss = useCallback(() => {
    setShowBanner(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  if (!showBanner) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-40 bg-slate-800/95 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-xl p-4 flex items-start gap-3"
    >
      <span className="text-xl shrink-0 mt-0.5">📖</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{s.title}</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-snug">
          {s.body}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={resume}
            className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-xs font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-pink-500"
          >
            {s.resume}
          </button>
          <button
            onClick={dismiss}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors"
          >
            {s.startOver}
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label={s.dismiss}
        className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 p-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
