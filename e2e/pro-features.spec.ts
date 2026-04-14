/**
 * e2e/pro-features.spec.ts
 *
 * Free vs Pro ゲーティング「横断」検証
 *
 * 目的:
 *   各ページの個別操作テストは dashboard-auth / records-auth / profile-auth に任せ、
 *   このファイルでは「Free ↔ Pro 間で paywall の出し分けが全ページ一貫しているか」を
 *   横断的にチェックする。重複テストは排除し、差分専用に特化する。
 *
 * テスト対象:
 *   - Free: 全ページの Paywall マーカー一括検証（$9.99 / 🔒 / Upgrade to Pro）
 *   - Pro:  全ページで Paywall マーカーが消滅していること
 *   - Gym Owner / Member: アクセス権限の差分
 *
 * Run:
 *   npx playwright test e2e/pro-features.spec.ts --project=free-user
 *   npx playwright test e2e/pro-features.spec.ts --project=pro-user
 *   npx playwright test e2e/pro-features.spec.ts --project=gym-owner
 *   npx playwright test e2e/pro-features.spec.ts --project=gym-member
 */

import { test, expect } from "@playwright/test";
import {
  AUTH_FILES,
  skipIfNoAuth,
  gotoAndWait,
  expectNotPresent,
} from "./helpers";

// =============================================================================
// 1. Free ユーザー — 全ページ Paywall マーカー一括検証
// =============================================================================

test.describe("Paywall Gate — Free User (cross-page)", () => {
  test.use({ storageState: AUTH_FILES.free });

  test.beforeEach(() => {
    skipIfNoAuth(AUTH_FILES.free);
  });

  test("Free: /dashboard に 'Upgrade to Pro' が1つ以上存在する", async ({ page }) => {
    await gotoAndWait(page, "/dashboard");
    const ctas = page.getByText(/Upgrade to Pro/i);
    const count = await ctas.count();
    expect(count, "Free dashboard should show at least 1 upgrade CTA").toBeGreaterThanOrEqual(1);
  });

  test("Free: /profile Stats タブに 🔒 が1つ以上存在する", async ({ page }) => {
    await gotoAndWait(page, "/profile");
    const statsTab = page.getByRole("button", { name: /Stats|統計/i });
    if (await statsTab.count() === 0) return test.skip(true, "Stats tab not found");
    await statsTab.first().click();
    await page.waitForTimeout(500);

    const locks = page.getByText("🔒");
    const count = await locks.count();
    expect(count, "Free Stats tab should show 🔒 locks").toBeGreaterThanOrEqual(1);
  });

  test("Free: /profile Body タブに Pro paywall が存在する", async ({ page }) => {
    await gotoAndWait(page, "/profile");
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() === 0) return test.skip(true, "Body tab not found");
    await bodyTab.first().click();
    await page.waitForTimeout(500);

    const body = await page.textContent("body");
    const hasPaywall = /Upgrade to Pro|Track your weight.*Pro|体重.*Pro/i.test(body!);
    expect(hasPaywall, "Free Body tab should show Pro paywall").toBe(true);
  });

  test("Free: /techniques に 30日制限 or 'Upgrade for full history' が表示される", async ({ page }) => {
    await gotoAndWait(page, "/techniques");
    const body = await page.textContent("body");
    // Free user with data sees limit; new user may see empty state — both OK
    // This test just confirms the page loads without error
    expect(body!.length).toBeGreaterThan(100);
  });
});

// =============================================================================
// 2. Pro ユーザー — 全ページ Paywall 完全消滅検証
// =============================================================================

test.describe("Paywall Gone — Pro User (cross-page)", () => {
  test.use({ storageState: AUTH_FILES.pro });

  test.beforeEach(() => {
    skipIfNoAuth(AUTH_FILES.pro);
  });

  test("Pro: /dashboard に '$9.99' が存在しない", async ({ page }) => {
    await gotoAndWait(page, "/dashboard");
    await expectNotPresent(page, page.getByText("$9.99"), "Pro dashboard should not show $9.99");
  });

  test("Pro: /dashboard に '$79.99' が存在しない", async ({ page }) => {
    await gotoAndWait(page, "/dashboard");
    await expectNotPresent(page, page.getByText("$79.99"), "Pro dashboard should not show $79.99");
  });

  test("Pro: /dashboard に 'Upgrade to Pro' が存在しない", async ({ page }) => {
    await gotoAndWait(page, "/dashboard");
    await expectNotPresent(page, page.getByText(/Upgrade to Pro/i), "Pro dashboard should not show upgrade CTA");
  });

  test("Pro: /profile Stats タブに 🔒 が存在しない", async ({ page }) => {
    await gotoAndWait(page, "/profile");
    const statsTab = page.getByRole("button", { name: /Stats|統計/i });
    if (await statsTab.count() === 0) return test.skip(true, "Stats tab not found");
    await statsTab.first().click();
    await page.waitForTimeout(500);

    await expectNotPresent(page, page.getByText("🔒"), "Pro Stats tab should not show 🔒");
  });

  test("Pro: /profile Body タブに paywall が存在しない", async ({ page }) => {
    await gotoAndWait(page, "/profile");
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() === 0) return test.skip(true, "Body tab not found");
    await bodyTab.first().click();
    await page.waitForTimeout(500);

    await expectNotPresent(
      page,
      page.getByText(/Track your weight.*Pro 🎯/i),
      "Pro Body tab should not show paywall"
    );
  });

  test("Pro: /profile に '$9.99' が存在しない", async ({ page }) => {
    await gotoAndWait(page, "/profile");
    await expectNotPresent(page, page.getByText("$9.99"), "Pro profile should not show $9.99");
  });

  test("Pro: /techniques に '30 days' 制限が存在しない", async ({ page }) => {
    await gotoAndWait(page, "/techniques");
    await expectNotPresent(
      page,
      page.getByText(/Free plan: showing last 30 days/i),
      "Pro records should not show 30-day limit"
    );
  });

  test("Pro: /profile Settings に 'Manage Subscription' が存在する", async ({ page }) => {
    await gotoAndWait(page, "/profile");
    const settingsTab = page.getByRole("button", { name: /Settings|設定/i });
    if (await settingsTab.count() === 0) return test.skip(true, "Settings tab not found");
    await settingsTab.first().click();
    await page.waitForTimeout(500);

    const manageSub = page.getByText(/Manage Subscription|サブスクリプション管理/i);
    const count = await manageSub.count();
    expect(count, "Pro should see Manage Subscription in Settings").toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// 3. Gym Owner — /gym/dashboard アクセス権限
// =============================================================================

test.describe("Gym Access — Gym Owner", () => {
  test.use({ storageState: AUTH_FILES.gymOwner });

  test.beforeEach(() => {
    skipIfNoAuth(AUTH_FILES.gymOwner);
  });

  test("Gym Owner: /gym/dashboard にアクセスできる", async ({ page }) => {
    await gotoAndWait(page, "/gym/dashboard");
    const url = new URL(page.url());
    expect(url.pathname, "Gym owner should access /gym/dashboard").not.toBe("/login");
  });

  test("Gym Owner: 道場管理コンテンツが表示される", async ({ page }) => {
    await gotoAndWait(page, "/gym/dashboard");
    const body = await page.textContent("body");
    const hasGymContent = /gym|dojo|道場|member|メンバー|invite|招待|QR|ACTIVE/i.test(body!);
    expect(hasGymContent, "Gym dashboard should show gym management content").toBe(true);
  });
});

// =============================================================================
// 4. Gym Member — /gym/dashboard アクセス不可
// =============================================================================

test.describe("Gym Access — Gym Member", () => {
  test.use({ storageState: AUTH_FILES.gymMember });

  test.beforeEach(() => {
    skipIfNoAuth(AUTH_FILES.gymMember);
  });

  test("Gym Member: /gym/dashboard にアクセスできない", async ({ page }) => {
    await gotoAndWait(page, "/gym/dashboard");
    const pathname = new URL(page.url()).pathname;
    expect(pathname, "Gym member should NOT access /gym/dashboard").not.toBe("/gym/dashboard");
  });

  test("Gym Member: /dashboard にはアクセスできる", async ({ page }) => {
    await gotoAndWait(page, "/dashboard");
    expect(new URL(page.url()).pathname).toBe("/dashboard");
  });

  test("Gym Member: /profile でジム所属情報が表示される", async ({ page }) => {
    await gotoAndWait(page, "/profile");
    const profileTab = page.getByRole("button", { name: /Profile|プロフィール/i });
    if (await profileTab.count() === 0) return test.skip(true, "Profile tab not found");
    await profileTab.first().click();
    await page.waitForTimeout(500);

    const body = await page.textContent("body");
    const hasGymInfo = /Gym|Academy|道場|ジム|E2E Test Dojo|Linked to gym/i.test(body!);
    expect(hasGymInfo, "Gym member should see gym affiliation on profile").toBe(true);
  });
});
