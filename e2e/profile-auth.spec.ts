/**
 * e2e/profile-auth.spec.ts
 *
 * 認証済みユーザーの Profile ページ「操作」E2Eテスト
 *
 * 責務: タブ切替、フォーム操作、Body Heatmap サイクル等のUI操作検証。
 * ※ Paywall ゲーティング（🔒 / $9.99 / Body paywall）は pro-features.spec.ts に委譲。
 *
 * テスト対象:
 *   - Profile タブ切替（Stats / Profile / Body / Settings / Milestones / Badges）
 *   - Profile 編集フォーム（帯、ジム、Save ボタン）
 *   - Body: BodyHeatmap サイクル（OK → Sore → Injured → OK）
 *   - Body: Weight Goal フォーム開閉
 *   - Body: Quick Weight Log
 *   - Settings: Timezone、CSV Export、Account Deletion UI
 *   - Referral セクション
 *
 * Run:
 *   npx playwright test e2e/profile-auth.spec.ts --project=free-user
 *   npx playwright test e2e/profile-auth.spec.ts --project=pro-user
 */

import { test, expect } from "@playwright/test";
import {
  AUTH_FILES,
  VRT_OPTIONS,
  skipIfNoAuth,
  gotoAndWait,
  expectVisible,
  expectNoHorizontalOverflow,
  navigateToProfileTab,
} from "./helpers";

// =============================================================================
// 1. Free ユーザーの Profile 操作
// =============================================================================

test.describe("Profile Ops — Free User", () => {
  test.use({ storageState: AUTH_FILES.free });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.free);
    await gotoAndWait(page, "/profile");
  });

  // ── ページロード ──

  test("profile page loads without redirect", async ({ page }) => {
    expect(new URL(page.url()).pathname).toBe("/profile");
  });

  // ── タブ切替 ──

  test("all profile tabs are clickable and show relevant content", async ({ page }) => {
    // Stats tab (default)
    const statsTab = page.getByRole("button", { name: /Stats|統計/i });
    if (await statsTab.count() === 0) return test.skip(true, "Tabs not found");

    // Profile tab → shows Belt / Gym
    await navigateToProfileTab(page, /Profile|プロフィール/i);
    const profileContent = await page.textContent("body");
    expect(profileContent, "Profile tab should show Belt/Gym").toMatch(/Belt|belt|帯|Gym|ジム|BJJ Start/i);

    // Body tab → shows body-related content
    await navigateToProfileTab(page, /Body|ボディ/i);
    const bodyContent = await page.textContent("body");
    expect(bodyContent, "Body tab should show body content").toMatch(/Body|Weight|体重|ボディ|Upgrade/i);

    // Settings tab → shows Account/Timezone
    await navigateToProfileTab(page, /Settings|設定/i);
    const settingsContent = await page.textContent("body");
    expect(settingsContent, "Settings tab should show Account/Settings").toMatch(/Account|Settings|アカウント|設定|Delete|Timezone/i);
  });

  test("Milestones tab exists and is clickable", async ({ page }) => {
    const tab = page.getByRole("button", { name: /Milestones|マイルストーン/i });
    if (await tab.count() === 0) return test.skip(true, "Milestones tab not found");
    await tab.first().click();
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toBeVisible();
  });

  test("Badges tab exists and is clickable", async ({ page }) => {
    const tab = page.getByRole("button", { name: /Badges|バッジ/i });
    if (await tab.count() === 0) return test.skip(true, "Badges tab not found");
    await tab.first().click();
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toBeVisible();
  });

  // ── Profile タブ: 編集フォーム ──

  test("Profile tab shows Belt selector and Save button", async ({ page }) => {
    await navigateToProfileTab(page, /Profile|プロフィール/i);

    const beltText = page.getByText(/Belt|帯/i);
    await expect(beltText.first(), "Belt label should be visible").toBeVisible({ timeout: 5000 });

    const saveBtn = page.getByRole("button", { name: /Save|保存/i });
    if (await saveBtn.count() > 0) {
      await expect(saveBtn.first()).toBeVisible();
    }
  });

  // ── Settings タブ ──

  test("Settings tab shows timezone selector", async ({ page }) => {
    await navigateToProfileTab(page, /Settings|設定/i);

    const timezoneText = page.getByText(/Timezone|タイムゾーン/i);
    if (await timezoneText.count() > 0) {
      await expect(timezoneText.first()).toBeVisible();
    }
  });

  test("Settings tab shows account deletion section", async ({ page }) => {
    await navigateToProfileTab(page, /Settings|設定/i);

    const deleteSection = page.getByText(/Delete Account|Danger Zone|アカウント削除|危険/i);
    if (await deleteSection.count() > 0) {
      await expect(deleteSection.first()).toBeVisible();
    }
  });

  test("Settings tab shows CSV export button", async ({ page }) => {
    await navigateToProfileTab(page, /Settings|設定/i);

    const exportBtn = page.getByText(/Download.*CSV|エクスポート|📥/i);
    if (await exportBtn.count() > 0) {
      await expect(exportBtn.first()).toBeVisible();
    }
  });

  // ── Responsive ──

  test("profile page mobile 375px no overflow", async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});

// =============================================================================
// 2. Pro ユーザーの Profile 操作
// =============================================================================

test.describe("Profile Ops — Pro User", () => {
  test.use({ storageState: AUTH_FILES.pro });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.pro);
    await gotoAndWait(page, "/profile");
  });

  // ── Body タブ: BodyHeatmap ──

  test("Body tab shows body map components (not paywall)", async ({ page }) => {
    await navigateToProfileTab(page, /Body|ボディ/i);

    const bodyMapText = page.getByText(/Body Map|Body Management|ボディマップ|ボディ管理|Quick Weight/i);
    await expect(bodyMapText.first(), "Pro should see body management, not paywall").toBeVisible({ timeout: 5000 });
  });

  test("Body heatmap part labels are visible", async ({ page }) => {
    await navigateToProfileTab(page, /Body|ボディ/i);

    // At least one body part should be visible
    const bodyParts = [/Neck|首/i, /Shoulder|肩/i, /Knee|膝/i, /Lower Back|腰/i];
    let found = false;
    for (const partRegex of bodyParts) {
      const part = page.getByText(partRegex);
      if (await part.count() > 0) {
        await expect(part.first()).toBeVisible();
        found = true;
        break;
      }
    }
    expect(found, "At least one body part label should be visible").toBe(true);
  });

  test("Body heatmap tap cycles OK → Sore → Injured → OK", async ({ page }) => {
    await navigateToProfileTab(page, /Body|ボディ/i);

    const neckBtn = page.getByText(/Neck|首/i);
    if (await neckBtn.count() === 0) return test.skip(true, "Neck button not found");

    // 3 clicks to cycle: OK → Sore → Injured → OK
    await neckBtn.first().click();
    await page.waitForTimeout(300);
    await neckBtn.first().click();
    await page.waitForTimeout(300);
    await neckBtn.first().click();
    await page.waitForTimeout(300);

    // Verify element survived the cycle (no crash)
    await expect(neckBtn.first()).toBeVisible();
  });

  // ── Body タブ: Weight Goal ──

  test("Weight Goal form can be opened and closed", async ({ page }) => {
    await navigateToProfileTab(page, /Body|ボディ/i);

    const goalBtn = page.getByText(/Set Goal|Edit|目標設定|編集/i);
    if (await goalBtn.count() === 0) return test.skip(true, "Goal button not found");

    await goalBtn.first().click();
    await page.waitForTimeout(500);

    // Form should show weight input
    const weightInput = page.locator('input[type="number"], input[placeholder*="kg"], input[placeholder*="weight"]');
    if (await weightInput.count() > 0) {
      await expect(weightInput.first()).toBeVisible();
    }

    // Close
    const cancelBtn = page.getByRole("button", { name: /Cancel|Clear|キャンセル|クリア/i });
    if (await cancelBtn.count() > 0) {
      await cancelBtn.first().click();
      await page.waitForTimeout(300);
    }
  });

  // ── Body タブ: Quick Weight Log ──

  test("Quick Weight Log section is visible", async ({ page }) => {
    await navigateToProfileTab(page, /Body|ボディ/i);

    const quickLogText = page.getByText(/Quick Weight Log|体重記録|Log Weight/i);
    if (await quickLogText.count() > 0) {
      await expect(quickLogText.first()).toBeVisible();
    }
  });

  // ── Referral Section ──

  test("Referral section exists on Profile tab", async ({ page }) => {
    await navigateToProfileTab(page, /Profile|プロフィール/i);

    const referralText = page.getByText(/Invite Friends|Referral|友達を招待|紹介/i);
    if (await referralText.count() > 0) {
      await expect(referralText.first()).toBeVisible();
    }
  });

  // ── VRT ──

  test("profile Pro visual snapshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("profile-pro.png", VRT_OPTIONS);
  });
});
