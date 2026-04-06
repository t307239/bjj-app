"use client";

/**
 * LocaleProvider — SSR/CSR locale mismatch fix (I-14 / Hydration Error #418)
 *
 * Problem: During SSR, _clientLocale in i18n.tsx defaults to "en" (no window).
 * On client hydration, detectClientLocale() may return "ja" → mismatch → #418.
 *
 * Fix: This client component wraps the app and calls setInitialLocale(locale)
 * SYNCHRONOUSLY before any children render. Since parent renders before children
 * in React, _clientLocale is aligned with the server-detected value on both
 * SSR and client, eliminating the hydration mismatch entirely.
 */

import { type ReactNode } from "react";
import { setInitialLocale, type Locale } from "@/lib/i18n";

export default function LocaleProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  // Synchronously set _clientLocale before children render.
  // Runs on both SSR (for initial HTML) and client hydration.
  setInitialLocale(locale);
  return <>{children}</>;
}
