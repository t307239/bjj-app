"use client";

/**
 * LangToggle — z255b: Settings 内の locale 切替 UI 復活
 *
 * 経緯:
 * - Phase 2.5 で一旦 disable (return null) されていたが、locale 切替手段が
 *   「DevTools console で localStorage.setItem」しか無く UX 不可。z255b で復活。
 * - i18n インフラ (lib/i18n.tsx の useLocale + setGlobalLocale) は既に完備、
 *   UI button を押すだけで `localStorage.bjj_locale` → 全 useLocale callback
 *   発火 → 全画面 re-render の流れが動く。
 *
 * 仕様:
 * - 3 言語 radio (EN / JA / PT)
 * - 選択後すぐ反映 (re-render via callback)、再 mount 不要
 * - aria-label / aria-pressed で a11y 対応
 */

import { useEffect, useState } from "react";
import { useLocale, type Locale } from "@/lib/i18n";

const OPTIONS: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
];

export default function LangToggle() {
  const { t, locale, setLocale } = useLocale();
  const [current, setCurrent] = useState<Locale>(locale);

  // useLocale の locale は module-level state なので setLocale 後に
  // 自動 re-render しないコンポーネントもある。useState で local mirror
  useEffect(() => {
    setCurrent(locale);
  }, [locale]);

  const handleChange = (next: Locale) => {
    if (next === current) return;
    setCurrent(next);
    setLocale(next);
    // 全画面に新 locale を反映するため reload (i18n callback だけだと
    // server-rendered text が更新されない)
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-white/8 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <svg
          aria-hidden="true"
          className="w-4 h-4 text-zinc-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
          />
        </svg>
        <p className="text-sm font-medium text-white">
          {t("profile.language")}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label={t("profile.languageAriaLabel")}
        className="flex gap-2 flex-wrap"
      >
        {OPTIONS.map((opt) => {
          const selected = current === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => handleChange(opt.code)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors active:scale-95 ${
                selected
                  ? "bg-emerald-600 text-white border border-emerald-500"
                  : "bg-zinc-800 text-zinc-300 border border-white/8 hover:bg-zinc-700"
              }`}
            >
              <span aria-hidden="true">{opt.flag}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
        {t("profile.languageDesc")}
      </p>
    </div>
  );
}
