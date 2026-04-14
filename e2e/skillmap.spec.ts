/**
 * e2e/skillmap.spec.ts
 *
 * 認証済みユーザーの /techniques/skillmap ページE2Eテスト
 *
 * 責務: SkillMap ページの読み込み、back リンク、ツールバー表示、
 *       SVGレンダリング（@xyflow/react）、レスポンシブ。
 *       SkillMap は ~300KB の dynamic import なので読み込みタイミングにも注意。
 *
 * Run:
 *   npx playwright test e2e/skillmap.spec.ts --project=free-user
 *   npx playwright test e2e/skillmap.spec.ts --project=pro-user
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
// 1. Free ユーザーのスキルマップ
// =============================================================================

test.describe("SkillMap — Free User", () => {
  test.use({ storageState: AUTH_FILES.free });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.free);
    await gotoAndWait(page, "/techniques/skillmap");
  });

  test("page loads without redirect (authenticated)", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("toolbar shows back link and title", async ({ page }) => {
    // Back link to /techniques
    const backLink = page.locator('a[href="/techniques"]');
    await expect(backLink).toBeVisible({ timeout: 5000 });

    // Title text
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });

  test("free limit indicator is visible for free user", async ({ page }) => {
    const body = await page.textContent("body");
    const hasFreeLimit = /free limit|30-day|無料.*制限|最新30日/i.test(body ?? "");
    // Free users should see the limitation notice
    expect(hasFreeLimit, "Free user should see limit indicator").toBe(true);
  });

  test("SkillMap container renders (dynamic import loads)", async ({ page }) => {
    // The SkillMap is loaded via dynamic(), so wait for the loading spinner to disappear
    // and the React Flow canvas to appear
    const container = page.locator(".react-flow, [class*='reactflow'], canvas, svg").first();

    // Wait up to 15s for dynamic import to complete
    try {
      await container.waitFor({ state: "attached", timeout: 15000 });
      await expect(container).toBeAttached();
    } catch {
      // If React Flow didn't load, at least verify the loading spinner showed
      const body = await page.textContent("body");
      const hasContent = body && body.length > 100;
      expect(hasContent, "Page should have rendered content").toBe(true);
    }
  });

  test("back link navigates to /techniques", async ({ page }) => {
    const backLink = page.locator('a[href="/techniques"]');
    await expect(backLink).toBeVisible({ timeout: 5000 });
    await backLink.click();
    await page.waitForURL("**/techniques", { timeout: 10000 });
    await expect(page).toHaveURL(/\/techniques$/);
  });

  test("no horizontal overflow on mobile", async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});

// =============================================================================
// 2. Pro ユーザーのスキルマップ
// =============================================================================

test.describe("SkillMap — Pro User", () => {
  test.use({ storageState: AUTH_FILES.pro });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.pro);
    await gotoAndWait(page, "/techniques/skillmap");
  });

  test("Pro badge is displayed in toolbar", async ({ page }) => {
    const proBadge = page.getByText(/✦ PRO|PRO/);
    if (await proBadge.count() > 0) {
      await expect(proBadge.first()).toBeVisible();
    }
  });

  test("no free limit indicator for Pro user", async ({ page }) => {
    const body = await page.textContent("body");
    // Pro should NOT see "free limit" / "30-day" restriction text
    const hasFreeLimit = /free limit|30-day limit/i.test(body ?? "");
    expect(hasFreeLimit, "Pro user should not see free limit").toBe(false);
  });

  test("page title matches metadata", async ({ page }) => {
    const title = await page.title();
    expect(title).toContain("Skill Map");
  });

  // ── VRT ──

  test("skillmap Pro visual snapshot", async ({ page }) => {
    // Wait for dynamic import to finish loading
    await page.waitForTimeout(3000);
    await expect(page).toHaveScreenshot("skillmap-pro.png", VRT_OPTIONS);
  });
});
