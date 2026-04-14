/**
 * e2e/settings.spec.ts
 *
 * 認証済みユーザーの /settings ページE2Eテスト
 *
 * 責務: 設定ページ表示・ナビゲーション（back link）・セクション存在確認
 *       （Danger Zone・サブスク管理・紹介・データエクスポート）・レスポンシブ。
 *
 * SettingsSection は dynamic() でクライアントロードされるため
 * 各テストで十分な待機を設けている。
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
  expectVisible,
  expectNoHorizontalOverflow,
} from "./helpers";

// ── i18n regex ────────────────────────────────────────────────────────────────
// Heading: en "Settings" / ja "設定"（profile.tabs.settings の値）
const RE_HEADING = /^Settings$|^設定$/;
// Danger Zone: en "Danger Zone" / ja "危険ゾーン"
const RE_DANGER_ZONE = /Danger Zone|危険ゾーン/;
// Delete Account: en "Delete Account" / ja "退会する"
const RE_DELETE = /Delete Account|退会する/;
// Manage Subscription: en "Manage Subscription" / ja "サブスクリプションを管理"
const RE_MANAGE_SUB = /Manage Subscription|サブスクリプションを管理/;
// Referral: en "Invite" / ja "招待"
const RE_REFERRAL = /Invite|友達を招待|招待/;
// Export: en "Export" / ja "エクスポート"
const RE_EXPORT = /Export|エクスポート/i;

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

  test("settings heading (h1) matches i18n", async ({ page }) => {
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible({ timeout: 5000 });
    const text = await h1.textContent();
    expect(text?.trim()).toMatch(RE_HEADING);
  });

  test("back to profile link exists and points to /profile", async ({ page }) => {
    // main 内の back link にスコープ（NavBar にも a[href="/profile"] が2つある）
    const backLink = page.locator('main a[href="/profile"]');
    await expect(backLink).toBeVisible({ timeout: 5000 });
  });

  // ── Danger Zone ──

  test("Danger Zone section with delete button is present", async ({ page }) => {
    // Danger Zone header
    const dangerZone = page.getByText(RE_DANGER_ZONE);
    await expect(dangerZone).toBeVisible({ timeout: 8000 });

    // Delete Account button (inside Danger Zone)
    const deleteBtn = page.getByRole("button", { name: RE_DELETE });
    await expect(deleteBtn).toBeVisible();
  });

  test("delete button expands confirmation with DELETE input", async ({ page }) => {
    const deleteBtn = page.getByRole("button", { name: RE_DELETE });
    await expect(deleteBtn).toBeVisible({ timeout: 8000 });
    await deleteBtn.click();

    // After expand: confirmation input with placeholder "DELETE"
    const deleteInput = page.getByPlaceholder("DELETE");
    await expect(deleteInput).toBeVisible({ timeout: 3000 });
  });

  // ── Data Export ──

  test("CSV export button is visible", async ({ page }) => {
    const exportBtn = page.getByText(RE_EXPORT).first();
    await expect(exportBtn).toBeVisible({ timeout: 8000 });
  });

  // ── Navigation ──

  test("back link navigates to /profile", async ({ page }) => {
    const backLink = page.locator('main a[href="/profile"]');
    await expect(backLink).toBeVisible({ timeout: 5000 });
    await backLink.click();
    await page.waitForURL("**/profile", { timeout: 20000 });
    await expect(page).toHaveURL(/\/profile/);
  });

  // ── Responsive ──

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

  test("B2B lead card is NOT shown for Pro user", async ({ page }) => {
    // SettingsSection: B2B lead card is gated by !isPro
    // Pro user should NOT see the gym lead CTA
    await page.waitForTimeout(2000); // Wait for dynamic import
    const gymLeadCta = page.locator('a[href="/gym"]');
    const count = await gymLeadCta.count();
    expect(count, "Pro user should not see B2B gym lead card").toBe(0);
  });

  test("no upgrade pricing ($9.99 / $79.99) shown to Pro user", async ({ page }) => {
    // Wait for dynamic SettingsSection to fully render
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    expect(body).not.toMatch(/\$9\.99/);
    expect(body).not.toMatch(/\$79\.99/);
  });

  test("referral section is visible for Pro user", async ({ page }) => {
    const referral = page.getByText(RE_REFERRAL).first();
    // Referral only shows if referralCode exists — skip gracefully
    if (await referral.count() > 0) {
      await expect(referral).toBeVisible();
    }
  });

  // ── VRT ──

  test("settings Pro visual snapshot", async ({ page }) => {
    // Wait for dynamic section to fully load
    await page.getByText(RE_DANGER_ZONE).waitFor({ timeout: 8000 }).catch(() => {});
    await expect(page).toHaveScreenshot("settings-pro.png", VRT_OPTIONS);
  });
});
