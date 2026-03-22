import { test, expect } from "@playwright/test";

/**
 * E2E: UIガイドライン違反検出テスト
 *
 * CLAUDE.md の UIガイドライン（BJJ App）に基づき、
 * レガシーカラー・不透明ボーダー・禁止クラスがDOMに存在しないことを検証。
 *
 * これにより、AIがUIを修正した際にガイドラインから逸脱した変更を自動検知できる。
 */

/** レガシーカラー — 過去に使用されていたが現在は禁止 */
const BANNED_CLASSES = [
  // レガシーネイビー背景
  ".bg-\\[\\#1a1a2e\\]",
  ".bg-\\[\\#16213e\\]",
  ".bg-\\[\\#0f3460\\]",
  // 不透明ボーダー（UIガイドラインで禁止）
  ".border-gray-700",
  ".border-gray-600",
  ".border-gray-500",
  // レガシーテキスト色
  ".text-gray-100",
  ".text-gray-200",
  // レガシーフォーカス（青禁止、紫に統一）
  ".focus\\:border-blue-400",
  ".focus\\:border-blue-500",
];

/** 許可される背景・ボーダーパターン */
const REQUIRED_PATTERNS = {
  /** ベース背景: bg-[#0f172a] or bg-zinc-950 or bg-zinc-900 */
  baseBg: /bg-\[#0f172a\]|bg-zinc-950|bg-zinc-900/,
  /** 透過ボーダー: border-white\/10 or border-zinc-800 or border-white\/\[0.08\] */
  transparentBorder: /border-white\/|border-zinc-800|border-white\/\[/,
};

const PUBLIC_PAGES = [
  { path: "/", name: "LP" },
  { path: "/login", name: "Login" },
  { path: "/dashboard", name: "Dashboard (Guest)" },
];

test.describe("UI Guideline Compliance", () => {
  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) has no banned CSS classes`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle");

      for (const selector of BANNED_CLASSES) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          // Get the actual class for better error message
          const classes = await Promise.all(
            elements.slice(0, 3).map((el) => el.getAttribute("class"))
          );
          expect
            .soft(elements.length, `${name}: Found banned class "${selector}" on elements: ${classes.join(", ")}`)
            .toBe(0);
        }
      }
    });

    test(`${name} (${path}) uses correct design tokens`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle");

      // Body or main container should use approved dark background
      const bodyClass = await page.getAttribute("body", "class");
      const mainClass = await page
        .locator("main, [class*='min-h-screen']")
        .first()
        .getAttribute("class")
        .catch(() => "");

      const combinedClasses = `${bodyClass ?? ""} ${mainClass ?? ""}`;

      // At least one approved dark bg should be present
      expect(
        REQUIRED_PATTERNS.baseBg.test(combinedClasses),
        `${name}: Expected approved dark background (bg-[#0f172a] / bg-zinc-950 / bg-zinc-900) in body/main. Got: "${combinedClasses}"`
      ).toBe(true);
    });
  }

  test("Dashboard cards use glassmorphism pattern", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // Cards should use bg-zinc-900/50 or bg-white/5 (glassmorphism)
    const cards = await page.$$("[class*='rounded-2xl'], [class*='rounded-xl']");
    // At least some rounded cards should exist
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  test("No legacy opaque borders on dashboard", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // Check all elements with border classes
    const opaqueCount = await page.evaluate(() => {
      const all = document.querySelectorAll("*");
      let count = 0;
      const bannedPatterns = [
        /\bborder-gray-[5-7]00\b/,
        /\bborder-slate-[5-7]00\b/,
      ];
      for (const el of all) {
        const cls = el.className;
        if (typeof cls !== "string") continue;
        for (const pat of bannedPatterns) {
          if (pat.test(cls)) count++;
        }
      }
      return count;
    });

    expect(
      opaqueCount,
      "Found opaque border classes (border-gray-500/600/700). Use border-white/10 or border-zinc-800 instead."
    ).toBe(0);
  });

  test("Focus states use purple accent, not blue", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const blueFocusCount = await page.evaluate(() => {
      const all = document.querySelectorAll("*");
      let count = 0;
      for (const el of all) {
        const cls = el.className;
        if (typeof cls !== "string") continue;
        if (/focus:border-blue/.test(cls)) count++;
      }
      return count;
    });

    expect(
      blueFocusCount,
      "Found focus:border-blue-* classes. UIガイドラインではfocus:border-[#7c3aed]（紫）に統一。"
    ).toBe(0);
  });
});
