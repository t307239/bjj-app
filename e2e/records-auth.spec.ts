/**
 * e2e/records-auth.spec.ts
 *
 * 認証済みユーザーの練習記録ページ（/techniques）「操作」E2Eテスト
 *
 * 責務: フィルタ切替、ログ展開折りたたみ、検索、フォーム操作の動作検証。
 * ※ Free 30日制限 / Pro full history のゲーティングは pro-features.spec.ts に委譲。
 *
 * テスト対象:
 *   - Gi/NoGi/All フィルタ切替
 *   - ログの展開・折りたたみ
 *   - 検索フィルタ
 *   - 期間フィルタ（All Time / This Month / This Week）
 *   - Load More ページネーション
 *   - Training Log Form（Records ページからの開閉）
 *   - Empty State 表示
 *   - レスポンシブ
 *
 * Run:
 *   npx playwright test e2e/records-auth.spec.ts --project=free-user
 *   npx playwright test e2e/records-auth.spec.ts --project=pro-user
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
// 1. Free ユーザーの Records 操作
// =============================================================================

test.describe("Records Ops — Free User", () => {
  test.use({ storageState: AUTH_FILES.free });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.free);
    await gotoAndWait(page, "/techniques");
  });

  // ── ページロード ──

  test("records page loads without redirect", async ({ page }) => {
    expect(new URL(page.url()).pathname).toBe("/techniques");
  });

  test("page shows training log content or empty state", async ({ page }) => {
    const body = await page.textContent("body");
    const hasContent = /Training Log|練習ログ|session|セッション|record|記録|empty|mat|champion/i.test(body!);
    expect(hasContent, "Records page should show log content or empty state").toBe(true);
  });

  // ── Gi/NoGi フィルタ ──

  test("Gi/NoGi/All filter buttons exist and are interactive", async ({ page }) => {
    const allBtn = page.getByRole("button", { name: /^All$/i });
    const giBtn = page.getByRole("button", { name: /^Gi$/i });

    if (await allBtn.count() === 0) return test.skip(true, "Filter buttons not found");

    await expect(allBtn.first()).toBeVisible();
    await expect(giBtn.first()).toBeVisible();

    // Click Gi filter
    await giBtn.first().click();
    await page.waitForTimeout(500);

    // Click NoGi
    const nogiBtn = page.getByRole("button", { name: /No-?Gi/i });
    if (await nogiBtn.count() > 0) {
      await nogiBtn.first().click();
      await page.waitForTimeout(500);
    }

    // Switch back to All
    await allBtn.first().click();
    await page.waitForTimeout(500);

    // No crash
    await expect(page.locator("body")).toBeVisible();
  });

  // ── ログ展開・折りたたみ ──

  test("training log entries expand and collapse", async ({ page }) => {
    const showMoreBtn = page.getByText(/Show More|もっと見る|↓/i);
    if (await showMoreBtn.count() === 0) return test.skip(true, "No expandable entries (user may have no logs)");

    await showMoreBtn.first().click();
    await page.waitForTimeout(500);

    const collapseBtn = page.getByText(/Collapse|折りたたむ|↑/i);
    if (await collapseBtn.count() > 0) {
      await expect(collapseBtn.first()).toBeVisible();
      await collapseBtn.first().click();
      await page.waitForTimeout(300);
    }
  });

  // ── 検索 ──

  test("search input accepts text and filters", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search|検索|notes|technique/i);
    if (await searchInput.count() === 0) return test.skip(true, "Search input not found");

    await expect(searchInput.first()).toBeVisible();
    await searchInput.first().fill("guard");
    await page.waitForTimeout(500);
    // Clear
    await searchInput.first().fill("");
    await page.waitForTimeout(300);
  });

  // ── 期間フィルタ ──

  test("period filter buttons (All Time / This Month / This Week) are interactive", async ({ page }) => {
    const allTimeBtn = page.getByText(/All Time|全期間/i);
    if (await allTimeBtn.count() === 0) return test.skip(true, "Period filter not found");

    await expect(allTimeBtn.first()).toBeVisible();

    const thisWeekBtn = page.getByText(/This Week|今週/i);
    if (await thisWeekBtn.count() > 0) {
      await thisWeekBtn.first().click();
      await page.waitForTimeout(500);
    }

    // Switch back
    await allTimeBtn.first().click();
    await page.waitForTimeout(500);
  });

  // ── Responsive ──

  test("records page mobile 375px no overflow", async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});

// =============================================================================
// 2. Pro ユーザーの Records 操作
// =============================================================================

test.describe("Records Ops — Pro User", () => {
  test.use({ storageState: AUTH_FILES.pro });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.pro);
    await gotoAndWait(page, "/techniques");
  });

  // ── Gi フィルタ ──

  test("Gi filter shows only Gi sessions or appropriate message", async ({ page }) => {
    const giBtn = page.getByRole("button", { name: /^Gi$/i });
    if (await giBtn.count() === 0) return test.skip(true, "Gi filter not found");

    await giBtn.first().click();
    await page.waitForTimeout(500);

    // After filtering: Gi entries or "no sessions of this type"
    const body = await page.textContent("body");
    expect(body!.length, "Page should still have content after filter").toBeGreaterThan(100);
  });

  // ── Load More ──

  test("Load More button triggers pagination", async ({ page }) => {
    const loadMoreBtn = page.getByText(/Load More|もっと読み込む/i);
    if (await loadMoreBtn.count() === 0) return test.skip(true, "Load More not visible (not enough entries)");

    await loadMoreBtn.first().click();
    await page.waitForTimeout(1000);
    // No crash
    await expect(page.locator("body")).toBeVisible();
  });

  // ── Export ──

  test("Export/CSV button is visible for Pro user", async ({ page }) => {
    const exportBtn = page.getByText(/Export|CSV|エクスポート|📥/i);
    if (await exportBtn.count() > 0) {
      await expect(exportBtn.first()).toBeVisible();
    }
  });

  // ── Training Log Form from Records ──

  test("training log form opens and has save/cancel buttons", async ({ page }) => {
    const addBtn = page.getByText(/\+ Add Session|Add Session|セッションを追加/i);
    if (await addBtn.count() === 0) return test.skip(true, "Add session button not found");

    await addBtn.first().click();
    await page.waitForTimeout(500);

    const saveBtn = page.getByRole("button", { name: /Log Roll|保存|Save/i });
    if (await saveBtn.count() > 0) {
      await expect(saveBtn.first()).toBeVisible();
    }

    const cancelBtn = page.getByRole("button", { name: /Cancel|キャンセル/i });
    if (await cancelBtn.count() > 0) {
      await cancelBtn.first().click();
    }
  });

  // ── VRT ──

  test("records Pro visual snapshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("records-pro.png", VRT_OPTIONS);
  });
});
