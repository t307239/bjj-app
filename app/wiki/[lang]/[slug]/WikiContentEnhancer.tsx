"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * WikiContentEnhancer — headless client component that progressively enhances
 * the server-rendered .wiki-content div:
 *   #27: Internal /wiki/ links → Next.js router.push (client navigation)
 *   #29: h2/h3 headings get a copy-link anchor button on hover
 *   #30: Images get a click-to-expand lightbox
 */
export default function WikiContentEnhancer() {
  const router = useRouter();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ── #27: Intercept internal /wiki/ links for client-side navigation ──
  useEffect(() => {
    const content = document.querySelector(".wiki-content");
    if (!content) return;

    const links = content.querySelectorAll<HTMLAnchorElement>('a[href^="/wiki/"]');
    const cleanup: Array<() => void> = [];

    links.forEach((a) => {
      const handler = (e: MouseEvent) => {
        e.preventDefault();
        router.push(a.getAttribute("href") ?? "/");
      };
      a.addEventListener("click", handler);
      cleanup.push(() => a.removeEventListener("click", handler));
    });

    return () => cleanup.forEach((fn) => fn());
  }, [router]);

  // ── #29: Heading anchor links ──
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    const content = document.querySelector(".wiki-content");
    if (!content) return;

    const headings = content.querySelectorAll<HTMLElement>("h2[id], h3[id]");
    const cleanup: Array<() => void> = [];

    headings.forEach((h) => {
      const id = h.id;
      if (!id) return;

      // Inject anchor button
      const btn = document.createElement("button");
      btn.className = "heading-anchor-btn";
      btn.setAttribute("aria-label", "Copy link");
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
      Object.assign(btn.style, {
        display: "inline-flex",
        alignItems: "center",
        marginLeft: "8px",
        opacity: "0",
        transition: "opacity 0.15s",
        color: "rgb(148,163,184)",
        cursor: "pointer",
        background: "none",
        border: "none",
        padding: "2px 3px",
        verticalAlign: "middle",
        borderRadius: "4px",
      });

      const onEnter = () => { btn.style.opacity = "1"; };
      const onLeave = () => { btn.style.opacity = "0"; };
      const onClick = (e: MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}${window.location.pathname}#${id}`;
        navigator.clipboard.writeText(url).then(() => showToast("🔗 Copied!")).catch(() => {});
      };
      const onBtnEnter = () => { btn.style.opacity = "1"; btn.style.color = "rgb(244,114,182)"; };
      const onBtnLeave = () => { btn.style.opacity = "0"; btn.style.color = "rgb(148,163,184)"; };

      h.appendChild(btn);
      h.addEventListener("mouseenter", onEnter);
      h.addEventListener("mouseleave", onLeave);
      btn.addEventListener("mouseenter", onBtnEnter);
      btn.addEventListener("mouseleave", onBtnLeave);
      btn.addEventListener("click", onClick);

      cleanup.push(() => {
        h.removeEventListener("mouseenter", onEnter);
        h.removeEventListener("mouseleave", onLeave);
        btn.remove();
      });
    });

    return () => cleanup.forEach((fn) => fn());
  }, [showToast]);

  // ── #30: Image lightbox ──
  useEffect(() => {
    const content = document.querySelector(".wiki-content");
    if (!content) return;

    const imgs = content.querySelectorAll<HTMLImageElement>("img");
    const cleanup: Array<() => void> = [];

    imgs.forEach((img) => {
      img.style.cursor = "zoom-in";
      const handler = () => setLightboxSrc(img.src);
      img.addEventListener("click", handler);
      cleanup.push(() => img.removeEventListener("click", handler));
    });

    return () => cleanup.forEach((fn) => fn());
  }, []);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxSrc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxSrc]);

  return (
    <>
      {/* #29: Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-4 py-2 rounded-full shadow-lg border border-slate-700 pointer-events-none"
        >
          {toast}
        </div>
      )}

      {/* #30: Lightbox overlay */}
      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            aria-label="Close image viewer"
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full p-2 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Expanded view"
            className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
    </>
  );
}
