"use client";

/**
 * lib/useKeyboardShortcuts.ts — Global keyboard shortcuts hook
 *
 * Q-109: Power-user navigation via keyboard shortcuts.
 * Shortcuts are disabled when an input/textarea/select is focused.
 *
 * Usage:
 *   useKeyboardShortcuts(router);
 */

import { useEffect, useCallback } from "react";

interface RouterLike {
  push: (url: string) => void;
}

export interface ShortcutEntry {
  /** Keys to display (e.g. "g → h") */
  keys: string;
  /** i18n key for description */
  labelKey: string;
  /** Fallback description (English) */
  label: string;
}

/** Exported for the help overlay */
export const SHORTCUTS: ShortcutEntry[] = [
  { keys: "?", labelKey: "shortcuts.help", label: "Show keyboard shortcuts" },
  { keys: "g → h", labelKey: "shortcuts.home", label: "Go to Home" },
  { keys: "g → r", labelKey: "shortcuts.records", label: "Go to Records" },
  { keys: "g → t", labelKey: "shortcuts.techniques", label: "Go to Techniques" },
  { keys: "g → p", labelKey: "shortcuts.profile", label: "Go to Profile" },
];

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (document.activeElement?.getAttribute("contenteditable") === "true") return true;
  return false;
}

/**
 * Hook: enables global keyboard shortcuts for navigation.
 * @param router - Next.js router (from useRouter)
 * @param onToggleHelp - callback to show/hide the shortcut help overlay
 */
export function useKeyboardShortcuts(
  router: RouterLike,
  onToggleHelp: () => void,
): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing in inputs or with modifier keys
      if (isInputFocused()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // "?" key → toggle help overlay
      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        onToggleHelp();
        return;
      }

      // "g" prefix for navigation (vim-style g+key)
      if (key === "g") {
        // Listen for the next key within 1s
        const onNext = (e2: KeyboardEvent) => {
          if (isInputFocused()) return;
          window.removeEventListener("keydown", onNext);
          clearTimeout(timer);

          const k2 = e2.key.toLowerCase();
          const routes: Record<string, string> = {
            h: "/dashboard",
            r: "/records",
            t: "/techniques",
            p: "/profile",
          };

          if (routes[k2]) {
            e2.preventDefault();
            router.push(routes[k2]);
          }
        };
        const timer = setTimeout(() => {
          window.removeEventListener("keydown", onNext);
        }, 1000);
        window.addEventListener("keydown", onNext, { once: true });
        return;
      }
    },
    [router, onToggleHelp],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
