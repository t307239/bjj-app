"use client";
import { useEffect } from "react";

/**
 * useUnsavedChanges
 * Shows a browser-native "unsaved changes" warning when the user tries to
 * navigate away or close the tab while `isDirty` is true.
 *
 * Usage:
 *   useUnsavedChanges(formHasChanges);
 */
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
