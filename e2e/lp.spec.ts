import { test, expect } from "@playwright/test";

/**
 * E2E: Landing Page (LP) — 外結テスト
 *
 * LP はパブリックページなので認証不要。
 * 主要セクション、CTA、メタデータ、ナビゲーションを検証。
 */

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // --- 基本表示 ---

  test("renders hero section with CTA", async ({ page }) => {
    // ヒーローヘッダーが表示される
    await expect(page.locator("h1")).toBeVisible();

    // メインCTA（ログインへ遷移するリンク/ボタン）が存在
    const cta = page.locator('a[href="/login"], a[href="/dashboard"]').first();
    await expect(cta).toBeVisible();
  });

  test("renders features section", async ({ page }) => {
    // 機能紹介セクション（3つ以上のフィーチャーカード）
    const featureItems = page.locator("h3, [class*='feature']");
    const count = await featureItems.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("renders social proof section", async ({ page }) => {
    // 社会的証拠（数字 or "practitioners" テキスト）
    const socialProof = page.getByText(/practitioners|sessions|3[,.]?[05]00/i);
    await expect(socialProof.first()).toBeVisible();
  });

  // --- メタデータ ---

  test("has correct page title", async ({ page }) => {
    const title = await page.title();
    expect(title).toMatch(/BJJ App/i);
  });

  test("has og:type meta tag", async ({ page }) => {
    const ogType = page.locator('meta[property="og:type"]');
    await expect(ogType).toHaveAttribute("content", /website/i);
  });

  test("has JSON-LD structured data", async ({ page }) => {
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd.first()).toBeAttached();
    const content = await jsonLd.first().textContent();
    expect(content).toContain("WebApplication");
  });

  // --- ナビゲーション ---

  test("login link navigates to /login", async ({ page }) => {
    const loginLink = page.locator('a[href="/login"]').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("guest link navigates to /dashboard", async ({ page }) => {
    const guestLink = page.locator('a[href="/dashboard"]').first();
    if (await guestLink.isVisible()) {
      await guestLink.click();
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  // --- BJJ Wiki クロスリンク ---

  test("has BJJ Wiki cross-link section", async ({ page }) => {
    const wikiSection = page.getByText(/BJJ Wiki|技術を深める/i);
    // LP has wiki cross-links if section exists
    if (await wikiSection.first().isVisible().catch(() => false)) {
      const wikiLinks = page.locator('a[href*="bjj-wiki"]');
      const count = await wikiLinks.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  // --- レスポンシブ ---

  test("hero is visible on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator("h1")).toBeVisible();
  });
});
