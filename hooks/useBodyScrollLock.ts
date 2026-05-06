"use client";

import { useEffect } from "react";

// z258: Lock background scroll while a modal/lightbox/celebration overlay
// is mounted. Without this, page content scrolls behind the dialog and the
// scroll position is lost on close.
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}
