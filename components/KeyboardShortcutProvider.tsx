"use client";

/**
 * KeyboardShortcutProvider — Wires global keyboard shortcuts into the app.
 *
 * Q-109: Lightweight client wrapper that activates useKeyboardShortcuts
 * and renders the help overlay. Placed inside LocaleProvider in layout.tsx.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import KeyboardShortcutHelp from "@/components/KeyboardShortcutHelp";

export default function KeyboardShortcutProvider() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const toggleHelp = useCallback(() => {
    setShowHelp((prev) => !prev);
  }, []);

  useKeyboardShortcuts(router, toggleHelp);

  return <KeyboardShortcutHelp open={showHelp} onClose={() => setShowHelp(false)} />;
}
