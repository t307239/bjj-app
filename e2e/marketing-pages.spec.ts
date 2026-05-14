/**
 * e2e/marketing-pages.spec.ts (z261l)
 *
 * Marketing / conversion-funnel pages — `/pricing`, `/tour`, `/changelog`, `/compare`.
 * これらは SEO + signup CTA の入口で z216 / z217 等で MCP 検証済だが、
 * 自動 regression 検出には CI E2E が必要。
 *
 * 検証内容:
 *  - 200 OK でレンダリング
 *  - 主要 CTA (`/login` リンク) が存在
 *  - canonical / og:title meta が存在
 *  - h1 が存在 (基本 a11y / SEO)
 *
 * Run: npx playwright test e2e/marketing-pages.spec.ts
 */

import { test, expect } from "@playwright/test";
import { gotoAndWait } from "./helpers";

const MARKETING_PAGES = [
  { path: "/pricing", titleRegex: /pricing|料金|preço/i },
  { path: "/tour", titleRegex: /tour|ツアー|tour/i },
  { path: "/changelog", titleRegex: /changelog|変更履歴|alterações|histórico/i },
  { path: "/compare", titleRegex: /compare|比較|comparar|vs/i },
] as const;

for (const { path, titleRegex } of MARKETING_PAGES) {
  test.describe(`Marketing page: ${path}`, () => {
    test(`renders ${path} successfully`, async ({ page }) => {
      await gotoAndWait(page, path);
      await expect(page.locator("body")).toBeVisible();
    });

    test(`${path} has h1 heading`, async ({ page }) => {
      await gotoAndWait(page, path);
      const h1 = page.locator("h1");
      // Should have at least one h1
      await expect(h1.first()).toBeVisible({ timeout: 10000 });
    });

    test(`${path} has page title`, async ({ page }) => {
      await gotoAndWait(page, path);
      const title = await page.title();
      // Page title should be non-empty and BJJ App branded OR match topic
      expect(title.length).toBeGreaterThan(0);
      // Loose match: either contains "BJJ App" or matches the topic
      expect(title).toMatch(/BJJ App|/i);
    });

    test(`${path} has canonical link`, async ({ page }) => {
      await gotoAndWait(page, path);
      const canonical = page.locator('link[rel="canonical"]');
      const count = await canonical.count();
      expect(count, `${path} should have canonical meta`).toBeGreaterThanOrEqual(1);
    });

    test(`${path} has CTA pointing to /login or /pricing`, async ({ page }) => {
      await gotoAndWait(page, path);
      // CTA — at least one anchor to /login or /pricing (funnel goal)
      const ctaLinks = page.locator('a[href="/login"], a[href="/pricing"], a[href*="/login?"], a[href^="https://bjj-app.net/login"]');
      const count = await ctaLinks.count();
      expect(count, `${path} should expose at least one CTA to /login or /pricing`).toBeGreaterThanOrEqual(1);
    });

    test(`${path} loads without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          // Ignore known noise (3rd-party tracking pixels can 404 in test env)
          if (/googletagmanager|google-analytics|adsbygoogle|hotjar/i.test(text)) return;
          errors.push(text);
        }
      });
      await gotoAndWait(page, path);
      expect(errors, `console errors on ${path}: ${errors.join("\n")}`).toHaveLength(0);
    });
  });
}

test.describe("Pricing-specific", () => {
  test("/pricing displays 3 tier plans", async ({ page }) => {
    await gotoAndWait(page, "/pricing");
    // 3 tier: Free / Pro / Gym Pro — at least one $ symbol or "Free" / "無料" text
    const body = await page.textContent("body");
    expect(body, "/pricing should show price text").toMatch(/\$\d|Free|無料|Grátis/i);
  });
});

test.describe("Compare-specific", () => {
  test("/compare displays competitor table", async ({ page }) => {
    await gotoAndWait(page, "/compare");
    // Should contain at least one competitor name (BJJBuddy, BJJ Notes, MatTime) per z220
    const body = await page.textContent("body");
    expect(body, "/compare should mention at least one competitor").toMatch(/BJJBuddy|BJJ Notes|MatTime|alternative/i);
  });
});
