"use client";

/**
 * components/ui/BottomSheet.tsx
 *
 * B-29: Reusable bottom sheet / modal hybrid
 * - Mobile  (< md): slides up from bottom, full-width, rounded-t-2xl
 * - Desktop (≥ md): centered dialog, max-w-lg, rounded-2xl
 *
 * Usage:
 *   <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="記録を追加">
 *     <YourFormHere />
 *   </BottomSheet>
 */

import { useEffect, useRef } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export default function BottomSheet({ isOpen, onClose, title, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // ── Body scroll lock ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ── Keyboard: Escape to close ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // ── Focus trap: initial focus on sheet ───────────────────────────────────
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-sheet-fade"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Sheet container ───────────────────────────────────────────────── */}
      {/* Mobile: pinned to bottom | Desktop: centered via flex */}
      {/* NOTE: aria-hidden removed — was hiding the dialog from iOS focus/tap tree */}
      <div
        className="fixed inset-x-0 bottom-0 z-[61] md:inset-0 md:flex md:items-center md:justify-center md:px-4 pointer-events-none"
      >
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className={[
            // Layout
            "pointer-events-auto w-full flex flex-col",
            // Sizing: svh fallback chain for older iOS Safari (15.x doesn't support svh)
            // max-h order: svh → dvh → 92vh fallback
            "max-h-[92vh] max-h-[92dvh] max-h-[92svh] md:max-h-[85vh]",
            "md:max-w-lg",
            // Appearance
            "bg-zinc-900 border border-white/10 shadow-2xl outline-none",
            // Shape: mobile rounded top, desktop fully rounded
            "rounded-t-2xl md:rounded-2xl",
            // Animation: slide up on mobile, no extra animation needed on desktop
            "animate-sheet-up md:animate-none",
          ].join(" ")}
          // Prevent backdrop click from propagating through the sheet
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Drag handle (mobile only) ───────────────────────────────── */}
          <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
            <div className="w-9 h-1 bg-white/20 rounded-full" />
          </div>

          {/* ── Header ─────────────────────────────────────────────────── */}
          {title && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <h2 className="text-base font-semibold text-white">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="w-4 h-4"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* ── Scrollable body ────────────────────────────────────────── */}
          {/* -webkit-overflow-scrolling: touch enables momentum scroll on iOS Safari */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
            style={{
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
