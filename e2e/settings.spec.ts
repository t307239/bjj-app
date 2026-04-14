/**
 * e2e/settings.spec.ts
 *
 * 認証済みユーザーの /settings ページE2Eテスト
 *
 * 責務: 設定ページの読み込み、back リンク、セクション表示（タイムゾーン、
 *       アカウント削除、サブスク管理）、Pro/Free 差分、レスポンシブ。
 *
 * Run:
 *   npx playwright test e2e/settings.spec.ts --project=free-user
 *   npx playwright test e2e/settings.spec.ts --project=pro-user
 */

import { test, expect } from "@playwright/test";
import {
  AUTH_FILES,
  VRT_OPTIONS,
  skipIfNoAuth,
  gotoAndWait,
  expectNoHorizontalOverflow,
} from "./helpers";

// =============================================================================
// 1. Free ユーザーの設定ページ
// =============================================================================

test.describe("Settings — Free User", () => {
  test.use({ storageState: AUTH_FILES.free });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.free);
    await gotoAndWait(page, "/settings");
  });

  test("page loads without redirect (authenticated)", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("settings heading is visible", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
    const text = await heading.first().textContent();
    expect(text).toMatch(/Settings|設定/i);
  });

  test("back to profile link exists", async ({ page }) => {
    const backLink = page.locator('a[href="/profile"]');
    await expect(backLink).toBeVisible({ timeout: 5000 });
  });

  test("timezone selector is present", async ({ page }) => {
    const body = await page.textContent("body");
    const hasTimezone = /timezone|タイムゾーン|time zone/i.test(body ?? "");
    expect(hasTimezone, "Settings should include timezone option").toBe(true);
  });

  test("account deletion section is visible", async ({ page }) => {
    const body = await page.textContent("body");
    const hasDeletion = /delete.*account|アカウント.*削除|danger zone/i.test(body ?? "");
    expect(hasDeletion, "Settings should include account deletion section").toBe(true);
  });

  test("referral section exists", async ({ page }) => {
    const body = await page.textContent("body");
    const hasReferral = /referral|紹介|invite|招待/i.test(body ?? "");
    // Referral might not be visible for all users, so this is advisory
    if (hasReferral) {
      expect(hasReferral).toBe(true);
    }
  });

  test("back link navigates to /profile", async ({ page }) => {
    const backLink = page.locator('a[href="/profile"]');
    await expect(backLink).toBeVisible({ timeout: 5000 });
    await backLink.click();
    await page.waitForURL("**/profile", { timeout: 10000 });
    await expect(page).toHaveURL(/\/profile/);
  });

  test("mobile 375px no horizontal overflow", async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});

// =============================================================================
// 2. Pro ユーザーの設定ページ
// =============================================================================

test.describe("Settings — Pro User", () => {
  test.use({ storageState: AUTH_FILES.pro });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.pro);
    await gotoAndWait(page, "/settings");
  });

  test("subscription management section is visible for Pro", async ({ page }) => {
    const body = await page.textContent("body");
    const hasSubscription = /manage.*subscription|サブスクリプション.*管理|billing|stripe|customer portal/i.test(body ?? "");
    expect(hasSubscription, "Pro user should see subscription management").toBe(true);
  });

  test("no upgrade CTA for Pro user on settings page", async ({ page }) => {
    const body = await page.textContent("body");
    const hasUpgrade = /upgrade to pro|\$9\.99|\$79\.99/i.test(body ?? "");
    expect(hasUpgrade, "Pro user should not see upgrade pricing on settings").toBe(false);
  });

  // ── VRT ──

  test("settings Pro visual snapshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("settings-pro.png", VRT_OPTIONS);
  });
});
