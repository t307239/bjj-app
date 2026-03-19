"use client";

import { useLocale, type Locale } from "@/lib/i18n";

export default function LangToggle() {
  const { locale, setLocale } = useLocale();

  const toggle = () => setLocale(locale === "ja" ? "en" : "ja");

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-white/10 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
      title={locale === "ja" ? "Switch to English" : "日本語に切り替え"}
      aria-label="Toggle language"
    >
      <span className="text-base leading-none">{locale === "ja" ? "🇯🇵" : "🇺🇸"}</span>
      <span>{locale === "ja" ? "JA" : "EN"}</span>
    </button>
  );
}
