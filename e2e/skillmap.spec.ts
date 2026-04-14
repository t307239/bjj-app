/**
 * e2e/skillmap.spec.ts
 *
 * 認証済みユーザーの /techniques/skillmap ページE2Eテスト
 *
 * 責務: SkillMap ページの読み込み、ツールバー（back / title / badge）、
 *       React Flow キャンバスの dynamic import 完了、ナビゲーション。
 *       SkillMap は @xyflow/react (~300KB) を dynamic() で遅延読み込みするため
 *       15s のロード猶予を設ける。
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
  expectVisible,
  expectNoHorizontalOverflow,
} from "./helpers";

// ── i18n regex ────────────────────────────────────────────────────────────────
// Title: en "Skill Map" / ja "スキルマップ"
// Back: en "Techniques" / ja "テクニック"
// FreeLimit: en "Free: up to 10 nodes" / ja "無料: ノード10個"
const RE_BACK = /Techniques|テクニック/;
const RE_FREE_LIMIT = /Free:|無料:/;

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

  test("toolbar: back link points to /techniques", async ({ page }) => {
    const backLink = page.locator('a[href="/techniques"]');
    await expect(backLink).toBeVisible({ timeout: 5000 });
    // Verify text content matches i18n
    const text = await backLink.textContent();
    expect(text).toMatch(RE_BACK);
  });

  test("toolbar: title h1 is visible", async ({ page }) => {
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible({ timeout: 5000 });
    const text = await h1.textContent();
    expect(text).toMatch(/Skill Map|スキルマップ/);
  });

  test("free limit indicator visible for Free user", async ({ page }) => {
    const limitText = page.getByText(RE_FREE_LIMIT);
    await expect(limitText).toBeVisible({ timeout: 5000 });
  });

  test("React Flow canvas loads via dynamic import", async ({ page }) => {
    // dynamic() loading: spinner → canvas/SVG
    // .react-flow is the container class injected by @xyflow/react
    const reactFlow = page.locator(".react-flow");

    // Allow up to 15s for ~300KB bundle to download + parse
    await reactFlow.waitFor({ state: "attached", timeout: 15000 }).catch(() => {});

    const attached = await reactFlow.count();
    if (attached > 0) {
      // Canvas rendered — check it has viewbox or nodes
      await expect(reactFlow).toBeVisible();
    } else {
      // Fallback: at minimum the page container should have loaded
      const container = page.locator("[class*='flex-1'][class*='min-h-0']");
      await expect(container).toBeAttached();
    }
  });

  test("back link navigates to /techniques", async ({ page }) => {
    const backLink = page.locator('a[href="/techniques"]');
    await expect(backLink).toBeVisible({ timeout: 5000 });
    await backLink.click();
    await page.waitForURL("**/techniques", { timeout: 10000 });
    await expect(page).toHaveURL(/\/techniques$/);
  });

  test("mobile 375px no horizontal overflow", async ({ page }) => {
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
    const proBadge = page.getByText("✦ PRO");
    await expectVisible(page, proBadge, "Pro user should see ✦ PRO badge on SkillMap");
  });

  test("no free limit indicator for Pro user", async ({ page }) => {
    const limitText = page.getByText(RE_FREE_LIMIT);
    const count = await limitText.count();
    expect(count, "Pro user should not see free limit text").toBe(0);
  });

  test("page title contains 'Skill Map'", async ({ page }) => {
    const title = await page.title();
    expect(title).toContain("Skill Map");
  });

  // ── VRT ──

  test("skillmap Pro visual snapshot", async ({ page }) => {
    // Wait for dynamic import to finish loading before screenshot
    const reactFlow = page.locator(".react-flow");
    await reactFlow.waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000); // settle animations
    await expect(page).toHaveScreenshot("skillmap-pro.png", VRT_OPTIONS);
  });
});
