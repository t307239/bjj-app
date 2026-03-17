"use client";

import { createContext, useContext, useEffect, useState } from "react";
import ja from "@/messages/ja.json";
import en from "@/messages/en.json";

export type Locale = "ja" | "en";

type Messages = typeof ja;

const STORAGE_KEY = "bjj_locale";

const messages: Record<Locale, Messages> = { ja, en };

// Flatten nested keys: "nav.home" -> value
function flattenMessages(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce((acc, [key, val]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === "string") {
      acc[fullKey] = val;
    } else if (typeof val === "object" && val !== null) {
      Object.assign(acc, flattenMessages(val as Record<string, unknown>, fullKey));
    }
    return acc;
  }, {} as Record<string, string>);
}

const flatJa = flattenMessages(ja as unknown as Record<string, unknown>);
const flatEn = flattenMessages(en as unknown as Record<string, unknown>);
const flatMessages: Record<Locale, Record<string, string>> = { ja: flatJa, en: flatEn };

type LocaleContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextType>({
  locale: "ja",
  setLocale: () => {},
  t: (key) => key,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ja");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === "en" || saved === "ja") setLocaleState(saved);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str = flatMessages[locale][key] ?? flatMessages["ja"][key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
