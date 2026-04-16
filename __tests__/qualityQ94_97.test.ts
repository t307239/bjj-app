/**
 * qualityQ94_97 — tests for Q-94 through Q-97 quality improvements
 *
 * Tests:
 * - Q-94: Landing page i18n pills (no hardcoded English)
 * - Q-94: WCAG text-gray audit (zero text-gray-[3-6]00 in app/ and components/)
 * - Q-95: PricingSection free upsell + trial hint
 * - Q-95: Conversion i18n keys (freeUpsell, proTrialHint)
 * - Q-96: PricingSection dynamic import on LP
 * - Q-97: text-gray-400 complete eradication
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const APP_DIR = path.resolve(__dirname, "../app");
const COMPONENTS_DIR = path.resolve(__dirname, "../components");
const MESSAGES_DIR = path.resolve(__dirname, "../messages");

// ── Q-94: Landing page i18n — no hardcoded English pills ────────────────────

describe("Q-94: LP feature pills i18n", () => {
  const source = fs.readFileSync(path.join(APP_DIR, "page.tsx"), "utf-8");

  it("has no hardcoded 'Weight Management' string", () => {
    expect(source).not.toContain('"Weight Management"');
  });

  it("has no hardcoded 'Belt Progress' string", () => {
    expect(source).not.toContain('"Belt Progress"');
  });

  it("uses t() for weight pill", () => {
    expect(source).toContain('t("landing.engPillWeight")');
  });

  it("uses t() for belt pill", () => {
    expect(source).toContain('t("landing.engPillBelt")');
  });

  it("i18n keys exist in ja/en/pt", () => {
    const langs = ["ja", "en", "pt"] as const;
    for (const lang of langs) {
      const messages = JSON.parse(
        fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), "utf-8")
      );
      expect(messages.landing?.engPillWeight).toBeDefined();
      expect(messages.landing?.engPillBelt).toBeDefined();
    }
  });
});

// ── Q-94: WCAG text-gray audit ──────────────────────────────────────────────

describe("Q-94: WCAG text-gray eradication", () => {
  const scanDir = (dir: string): string[] => {
    const results: string[] = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...scanDir(fullPath));
      } else if (item.name.endsWith(".tsx")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const matches = content.match(/text-gray-[3456]00/g);
        if (matches) {
          results.push(`${fullPath}: ${matches.length} occurrences`);
        }
      }
    }
    return results;
  };

  it("app/ has zero text-gray-[3-6]00", () => {
    const hits = scanDir(APP_DIR);
    expect(hits).toEqual([]);
  });

  it("components/ has zero text-gray-[3-6]00", () => {
    const hits = scanDir(COMPONENTS_DIR);
    expect(hits).toEqual([]);
  });
});

// ── Q-95: PricingSection conversion improvements ────────────────────────────

describe("Q-95: PricingSection conversion", () => {
  const source = fs.readFileSync(
    path.join(COMPONENTS_DIR, "PricingSection.tsx"),
    "utf-8"
  );

  it("has free plan upsell hint", () => {
    expect(source).toContain('t("pricing.freeUpsell")');
  });

  it("has trial hint badge before CTA", () => {
    expect(source).toContain('t("pricing.proTrialHint")');
  });

  it("has money-back guarantee", () => {
    expect(source).toContain('t("pricing.moneyBack")');
  });

  it("conversion i18n keys exist in all 3 languages", () => {
    const langs = ["ja", "en", "pt"] as const;
    const keys = ["pricing.freeUpsell", "pricing.proTrialHint"];
    for (const lang of langs) {
      const messages = JSON.parse(
        fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), "utf-8")
      );
      for (const dotKey of keys) {
        const [section, key] = dotKey.split(".");
        expect(messages[section]?.[key]).toBeDefined();
        expect(messages[section][key].length).toBeGreaterThan(0);
      }
    }
  });
});

// ── Q-96: PricingSection dynamic import ─────────────────────────────────────

describe("Q-96: PricingSection dynamic import on LP", () => {
  const source = fs.readFileSync(path.join(APP_DIR, "page.tsx"), "utf-8");

  it("uses next/dynamic import for PricingSection", () => {
    expect(source).toContain("dynamic(() => import");
    expect(source).toContain("PricingSection");
  });

  it("has loading fallback with animate-pulse", () => {
    expect(source).toContain("animate-pulse");
  });

  it("does not have static import of PricingSection", () => {
    expect(source).not.toMatch(/^import PricingSection from/m);
  });
});
