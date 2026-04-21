"use client";

/**
 * components/ui/BottomSheet.tsx
 *
 * B-29: Reusable bottom sheet / modal hybrid
 * - Mobile  (< md): slides up from bottom, full-width, rounded-t-2xl
 * - Desktop (≥ md): centered dialog, max-w-lg, rounded-2xl
 * - Swipe-to-close: drag down on mobile to dismiss (threshold 80px)
 *
 * Usage:
 *   <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="記録を追加">
 *     <YourFormHere />
 *   </BottomSheet>
 */

import { useEffect, useRef, useState, useCallback, useId } from "react";
import { useLocale } from "@/lib/i18n";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

const CLOSE_THRESHOLD = 80; // px — swipe distance to trigger close

export default function BottomSheet({ isOpen, onClose, title, children }: Props) {
  const { t } = useLocale();
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ── Swipe-to-close state ────────────────────────────────────────────────
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const isVertical = useRef<boolean | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable swipe on the drag handle area or when content is scrolled to top
    const target = e.target as HTMLElement;
    const isHandle = target.closest("[data-drag-handle]");
    const scrollBody = sheetRef.current?.querySelector("[data-scroll-body]") as HTMLElement | null;
    const isScrolledToTop = !scrollBody || scrollBody.scrollTop <= 0;

    if (!isHandle && !isScrolledToTop) return;

    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isVertical.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    const dx = e.touches[0].clientX - touchStartX.current;

    // Determine gesture direction on first significant movement
    if (isVertical.current === null && (Math.abs(dy) > 4 || Math.abs(dx) > 4)) {
      isVertical.current = Math.abs(dy) > Math.abs(dx);
    }
    if (!isVertical.current) return;

    // Only allow downward drag (positive dy)
    if (dy > 0) {
      setDragY(dy);
      setDragging(true);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragY > CLOSE_THRESHOLD) {
      onClose();
    }
    setDragY(0);
    setDragging(false);
    touchStartY.current = null;
    touchStartX.current = null;
    isVertical.current = null;
  }, [dragY, onClose]);

  // Reset drag state when closing
  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      setDragging(false);
    }
  }, [isOpen]);

  // ── Body scroll lock (scroll position preserved) ─────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      // Restore scroll position to prevent jump-to-bottom on close
      window.scrollTo({ top: scrollY, behavior: "instant" });
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

  // ── Focus trap: save previous focus, initial focus + Tab cycling within sheet
  useEffect(() => {
    if (!isOpen || !sheetRef.current) return;
    // Save the element that had focus before opening
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    sheetRef.current.focus();

    const sheet = sheetRef.current;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = sheet.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === sheet) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      // Restore focus to the element that triggered the sheet
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const backdropOpacity = dragging ? Math.max(0, 1 - dragY / 300) : 1;

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 animate-sheet-fade"
        style={{ opacity: backdropOpacity }}
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />

      {/* ── Sheet container ───────────────────────────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-[61] md:inset-0 md:flex md:items-center md:justify-center md:px-4 pointer-events-none"
      >
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          className={[
            "pointer-events-auto w-full flex flex-col",
            "max-h-[92vh] max-h-[92dvh] max-h-[92svh] md:max-h-[85vh]",
            "md:max-w-lg",
            "bg-zinc-900 border border-white/10 shadow-2xl outline-none",
            "rounded-t-2xl md:rounded-2xl",
            "animate-sheet-up md:animate-none",
          ].join(" ")}
          style={{
            transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
            transition: dragging ? "none" : "transform 0.2s ease",
          }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* ── Drag handle (mobile only) ───────────────────────────────── */}
          <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0 cursor-grab" data-drag-handle>
            <div className="w-9 h-1 bg-white/20 rounded-full" />
          </div>

          {/* ── Header ─────────────────────────────────────────────────── */}
          {title && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <h2 id={titleId} className="text-base font-semibold text-white">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={t("common.close")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="w-5 h-5"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* ── Scrollable body ────────────────────────────────────────── */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
            data-scroll-body
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
