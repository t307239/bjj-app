/**
 * cookiePreferences.ts — non-JSX cookie consent storage helper
 *
 * z209: extracted from components/CookieConsent.tsx so that lib/analytics.ts
 * (and other non-JSX modules) can import without dragging the .tsx file
 * through vitest's transform pipeline. Vitest with `jsx: preserve` choked
 * on the transitive .tsx import, breaking the entire barrelExport / analytics
 * test cascade (14 tests).
 *
 * 仕組み:
 *   - localStorage["bjj_cookie_consent"] に JSON 永続化
 *   - 旧形式 ("accepted" / "declined" 文字列) も後方互換で読める
 *   - SSR 安全: localStorage 不在時は null 返す
 */

export const STORAGE_KEY = "bjj_cookie_consent";

export type CookiePreferences = {
  essential: true; // always true — cannot be disabled
  analytics: boolean;
  marketing: boolean;
};

/** Read stored cookie preferences. Returns null if user hasn't chosen yet. */
export function getCookiePreferences(): CookiePreferences | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Legacy: "accepted" or "declined" string
    if (raw === "accepted") return { essential: true, analytics: true, marketing: true };
    if (raw === "declined") return { essential: true, analytics: false, marketing: false };
    return JSON.parse(raw) as CookiePreferences;
  } catch {
    return null;
  }
}
