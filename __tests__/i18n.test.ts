/**
 * Unit tests for lib/i18n.tsx
 * Tests: flattenMessages, t() function behavior, locale fallback
 *
 * Note: LocaleProvider / useLocale hook require jsdom + React Testing Library.
 * These pure-logic tests run in node environment.
 */

import { describe, it, expect } from "vitest";

// ── Inline copy of flattenMessages (pure function — no React dependency) ──────
function flattenMessages(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
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

// ── t() logic (extracted from LocaleProvider) ─────────────────────────────────
function makeT(
  flatMessages: Record<"ja" | "en", Record<string, string>>,
  locale: "ja" | "en"
) {
  return (key: string, vars?: Record<string, string | number>): string => {
    let str = flatMessages[locale][key] ?? flatMessages["ja"][key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  };
}

// ── Test data ──────────────────────────────────────────────────────────────────
const sampleJa = {
  nav: {
    home: "ホーム",
    techniques: "テクニック",
  },
  dashboard: {
    welcomeBack: "おかえり、{name} 👋",
    streakMsg3: "{n}日連続！良い習慣が育っています。",
  },
  deep: {
    nested: {
      key: "深いネストの値",
    },
  },
};

const sampleEn = {
  nav: {
    home: "Home",
    techniques: "Techniques",
  },
  dashboard: {
    welcomeBack: "Welcome back, {name} 👋",
    // streakMsg3 intentionally missing — tests fallback to ja
  },
  deep: {
    nested: {
      key: "Deep nested value",
    },
  },
};

const flatJa = flattenMessages(sampleJa as unknown as Record<string, unknown>);
const flatEn = flattenMessages(sampleEn as unknown as Record<string, unknown>);
const flat = { ja: flatJa, en: flatEn };

// ─────────────────────────────────────────────────────────────────────────────
describe("flattenMessages", () => {
  it("flattens shallow keys with dot notation", () => {
    const result = flattenMessages({ nav: { home: "ホーム" } } as Record<string, unknown>);
    expect(result["nav.home"]).toBe("ホーム");
  });

  it("flattens deeply nested keys", () => {
    const result = flattenMessages(sampleJa as unknown as Record<string, unknown>);
    expect(result["deep.nested.key"]).toBe("深いネストの値");
  });

  it("top-level string values are preserved as-is", () => {
    const result = flattenMessages({ greeting: "こんにちは" } as Record<string, unknown>);
    expect(result["greeting"]).toBe("こんにちは");
  });

  it("produces all expected keys from sample ja", () => {
    const result = flattenMessages(sampleJa as unknown as Record<string, unknown>);
    expect(Object.keys(result)).toContain("nav.home");
    expect(Object.keys(result)).toContain("nav.techniques");
    expect(Object.keys(result)).toContain("dashboard.welcomeBack");
    expect(Object.keys(result)).toContain("dashboard.streakMsg3");
    expect(Object.keys(result)).toContain("deep.nested.key");
  });

  it("returns empty object for empty input", () => {
    const result = flattenMessages({});
    expect(result).toEqual({});
  });

  it("ignores null values", () => {
    const result = flattenMessages({ a: null } as unknown as Record<string, unknown>);
    expect(result["a"]).toBeUndefined();
  });

  it("ignores numeric values (not strings)", () => {
    const result = flattenMessages({ count: 42 } as unknown as Record<string, unknown>);
    expect(result["count"]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("t() — key lookup", () => {
  it("returns Japanese string for ja locale", () => {
    const t = makeT(flat, "ja");
    expect(t("nav.home")).toBe("ホーム");
  });

  it("returns English string for en locale", () => {
    const t = makeT(flat, "en");
    expect(t("nav.home")).toBe("Home");
  });

  it("falls back to Japanese when key missing in English", () => {
    const t = makeT(flat, "en");
    // "dashboard.streakMsg3" only exists in ja
    expect(t("dashboard.streakMsg3", { n: 5 })).toContain("連続");
  });

  it("returns the key itself when missing from both locales", () => {
    const t = makeT(flat, "en");
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("t() — variable interpolation", () => {
  it("replaces {name} placeholder", () => {
    const t = makeT(flat, "ja");
    expect(t("dashboard.welcomeBack", { name: "太郎" })).toBe("おかえり、太郎 👋");
  });

  it("replaces {name} in English locale", () => {
    const t = makeT(flat, "en");
    expect(t("dashboard.welcomeBack", { name: "John" })).toBe("Welcome back, John 👋");
  });

  it("replaces {n} placeholder with number", () => {
    const t = makeT(flat, "ja");
    expect(t("dashboard.streakMsg3", { n: 7 })).toBe("7日連続！良い習慣が育っています。");
  });

  it("replaces {n} placeholder with string", () => {
    const t = makeT(flat, "ja");
    expect(t("dashboard.streakMsg3", { n: "10" })).toBe("10日連続！良い習慣が育っています。");
  });

  it("replaces {n} with 0 (falsy number) correctly", () => {
    const t = makeT(flat, "ja");
    expect(t("dashboard.streakMsg3", { n: 0 })).toBe("0日連続！良い習慣が育っています。");
  });

  it("does not mutate original string when no vars provided", () => {
    const t = makeT(flat, "ja");
    const result1 = t("nav.home");
    const result2 = t("nav.home");
    expect(result1).toBe(result2);
  });

  it("leaves unreplaced placeholders when vars key missing", () => {
    const t = makeT(flat, "ja");
    // Pass wrong var name — placeholder should remain
    expect(t("dashboard.welcomeBack", { user: "太郎" })).toBe("おかえり、{name} 👋");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("t() — edge cases", () => {
  it("handles multiple variable replacements in same string", () => {
    const flatMulti = {
      ja: { "msg.multi": "Hello {name}, you have {n} sessions!" },
      en: { "msg.multi": "Hello {name}, you have {n} sessions!" },
    };
    const t = makeT(flatMulti, "en");
    expect(t("msg.multi", { name: "Alice", n: 42 })).toBe("Hello Alice, you have 42 sessions!");
  });

  it("handles empty vars object gracefully", () => {
    const t = makeT(flat, "ja");
    expect(t("nav.home", {})).toBe("ホーム");
  });
});
