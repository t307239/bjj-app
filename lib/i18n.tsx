/**
 * i18n — Multi-locale support: en / ja / pt (pt-BR)
 * Locale detection: profile.locale → localStorage → browser → "en"
 * Falls back to English for any missing key.
 *
 * NOTE: No "use client" — compatible with Server Components (serverT)
 * and Client Components (useLocale). Locale is read once at module init
 * on client and refreshed via LocaleProvider when profile locale is set.
 */

import React, { type ReactNode } from "react";

import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import pt from "@/messages/pt.json";

export type Locale = "en" | "ja" | "pt";

const MESSAGES: Record<Locale, Record<string, unknown>> = {
  en: en as unknown as Record<string, unknown>,
  ja: ja as unknown as Record<string, unknown>,
  pt: pt as unknown as Record<string, unknown>,
};

const LOCALE_STORAGE_KEY = "bjj_locale";

// ── Flatten nested JSON to dot-notation keys ──────────────────────────────────

function flattenMessages(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  return Object.entries(obj).reduce(
    (acc, [key, val]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof val === "string") {
        acc[fullKey] = val;
      } else if (typeof val === "object" && val !== null) {
        Object.assign(
          acc,
          flattenMessages(val as Record<string, unknown>, fullKey)
        );
      }
      return acc;
    },
    {} as Record<string, string>
  );
}

export const flatMessages: Record<Locale, Record<string, string>> = {
  en: flattenMessages(MESSAGES.en),
  ja: flattenMessages(MESSAGES.ja),
  pt: flattenMessages(MESSAGES.pt),
};

// ── Translation function ──────────────────────────────────────────────────────

export function makeT(locale: Locale) {
  return function t(
    key: string,
    vars?: Record<string, string | number>
  ): string {
    // Try requested locale → English fallback
    let str =
      flatMessages[locale][key] ??
      flatMessages["en"][key] ??
      key;

    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  };
}

// ── Static English t() for server components ─────────────────────────────────

export const serverT = makeT("en");

// ── Server-side locale detection (for SSR in Server Components) ──────────────
// Reads bjj_locale cookie → Accept-Language header → "en"
// Auto-detects ja, pt, en from Accept-Language header.
// pt.json is 101% coverage — safe for auto-detect.
export async function detectServerLocale(): Promise<Locale> {
  // Dynamic imports to avoid bundling next/headers in client code
  const { cookies, headers } = await import("next/headers");
  // 1. Cookie (explicit user preference) — highest priority
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_STORAGE_KEY)?.value;
    if (cookieLocale === "ja" || cookieLocale === "pt" || cookieLocale === "en") {
      return cookieLocale as Locale;
    }
  } catch { /* ignore — cookies() may throw outside request context */ }
  // 2. Accept-Language header — parse quality-weighted list
  try {
    const hdrs = await headers();
    const acceptLang = hdrs.get("accept-language") ?? "";
    const detected = parseAcceptLanguage(acceptLang);
    if (detected) return detected;
  } catch { /* ignore */ }
  return "en";
}

/**
 * Parse Accept-Language header and return the best matching locale.
 * Handles formats like "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7"
 * Auto-detects ja, pt, and en from browser Accept-Language header.
 */
export function parseAcceptLanguage(header: string): Locale | null {
  if (!header) return null;
  // Split by comma, parse each tag + quality
  const entries = header.split(",").map((part) => {
    const [tag, ...params] = part.trim().split(";");
    const qParam = params.find((p) => p.trim().startsWith("q="));
    const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1.0;
    return { lang: tag.trim().toLowerCase(), q: isNaN(q) ? 0 : q };
  });
  // Sort by quality descending
  entries.sort((a, b) => b.q - a.q);
  for (const { lang } of entries) {
    if (lang.startsWith("ja")) return "ja";
    if (lang.startsWith("pt")) return "pt";
    if (lang.startsWith("en")) return "en";
  }
  return null;
}

// ── Client-side locale detection (runs once at module load) ──────────────────

function syncLocaleCookie(locale: Locale) {
  try {
    document.cookie = `${LOCALE_STORAGE_KEY}=${locale};path=/;max-age=${365 * 86400};SameSite=Lax`;
  } catch { /* ignore */ }
}

function detectClientLocale(): Locale {
  if (typeof window === "undefined") return "en";
  let detected: Locale = "en";
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "en" || stored === "ja" || stored === "pt") {
      detected = stored as Locale;
      syncLocaleCookie(detected);
      return detected;
    }
  } catch {
    /* ignore */
  }
  const lang = navigator.language?.toLowerCase() ?? "en";
  if (lang.startsWith("ja")) detected = "ja";
  else if (lang.startsWith("pt")) detected = "pt";
  syncLocaleCookie(detected);
  return detected;
}

// Module-level locale state (safe: only written on client)
let _clientLocale: Locale =
  typeof window !== "undefined" ? detectClientLocale() : "en";

const _setLocaleCallbacks: Array<(l: Locale) => void> = [];

function setGlobalLocale(locale: Locale) {
  _clientLocale = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  syncLocaleCookie(locale);
  _setLocaleCallbacks.forEach((cb) => cb(locale));
}

// ── Sync initial locale (called by LocaleProvider before children render) ────
// Lets server-detected locale override the module-init value, preventing #418
export function setInitialLocale(locale: Locale) {
  _clientLocale = locale;
}

// ── useLocale hook ────────────────────────────────────────────────────────────

export function useLocale() {
  // GuestDashboard は ssr:false で client-only レンダリング → hydration mismatch なし
  // 他コンポーネントも _clientLocale は module init 時に確定するため re-render 不要
  return {
    locale: _clientLocale,
    setLocale: setGlobalLocale,
    t: makeT(_clientLocale),
  };
}

// ── LocaleProvider (optional — wraps app to sync profile locale) ─────────────

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: string | null;
}) {
  // Apply profile locale preference once on mount (server-known value)
  if (
    typeof window !== "undefined" &&
    (initialLocale === "ja" || initialLocale === "pt" || initialLocale === "en")
  ) {
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(LOCALE_STORAGE_KEY)
        : null;
    // Only apply profile locale if user hasn't explicitly overridden in browser
    if (!stored) {
      _clientLocale = initialLocale as Locale;
    }
  }

  return <>{children}</>;
}
