// i18n — English-only static implementation
// All components can continue using `const { t } = useLocale()` unchanged.
// LocaleProvider is kept as a no-op for backward compatibility.

import en from "@/messages/en.json";

export type Locale = "en";

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

const flatEn = flattenMessages(en as unknown as Record<string, unknown>);

function t(key: string, vars?: Record<string, string | number>): string {
  let str = flatEn[key] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, String(v));
    });
  }
  return str;
}

/** Drop-in replacement — always returns English locale */
export function useLocale() {
  return {
    locale: "en" as const,
    setLocale: (_l: Locale) => {},
    t,
  };
}

/** No-op provider kept for backward compatibility */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
