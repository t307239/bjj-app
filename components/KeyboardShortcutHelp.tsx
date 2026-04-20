"use client";

/**
 * KeyboardShortcutHelp — Modal overlay showing available keyboard shortcuts
 *
 * Q-109: Accessible modal triggered by "?" key.
 * Uses semantic <dialog> pattern with Escape-to-close and click-outside-to-close.
 */

import { useEffect, useRef, useCallback } from "react";
import { SHORTCUTS } from "@/lib/useKeyboardShortcuts";
import { useLocale } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutHelp({ open, onClose }: Props) {
  const { t } = useLocale();
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // §9 a11y: Save previous focus + auto-focus dialog + restore on close
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => { previousFocusRef.current?.focus(); };
  }, [open]);

  // Close on Escape + Focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      // §9 a11y: Focus trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("shortcuts.title") || "Keyboard shortcuts"}
    >
      <div ref={dialogRef} tabIndex={-1} className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl outline-none">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
            {t("shortcuts.title") || "Keyboard Shortcuts"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t("common.close") || "Close"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {t(s.labelKey) || s.label}
              </span>
              <kbd className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-white/10">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-500 mt-4 text-center">
          {t("shortcuts.hint") || "Press ? to toggle this panel"}
        </p>
      </div>
    </div>
  );
}
