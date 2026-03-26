"use client";

import { useEffect, useState } from "react";

/**
 * #21: Scroll-aware Back to Top button.
 * Appears after scrolling 400px; smooth-scrolls to top on click.
 */
export default function BackToTopButton({ lang }: { lang: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggle = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", toggle, { passive: true });
    return () => window.removeEventListener("scroll", toggle);
  }, []);

  const label =
    lang === "ja" ? "トップへ" : lang === "pt" ? "Topo" : "Top";

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={label}
      className="
        fixed bottom-24 right-5 z-40 lg:bottom-10 lg:right-8
        flex items-center justify-center
        w-10 h-10 rounded-full
        bg-slate-800/90 border border-slate-700/60
        text-slate-400 hover:text-white hover:border-slate-600
        backdrop-blur-sm shadow-lg
        transition-all duration-200
      "
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
