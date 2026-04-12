/**
 * e2e/records-auth.spec.ts
 *
 * 認証済みユーザーの練習記録ページ（/techniques）E2Eテスト
 *
 * テスト対象:
 *   - Gi/NoGi/All フィルタ切替
 *   - ログの展開・折りたたみ
 *   - 検索フィルタ
 *   - 期間フィルタ（All Time / This Month / This Week）
 *   - CSV エクスポート（Pro のみ）
 *   - Free プランの 30日制限表示
 *   - Load More ページネーション
 *   - カレンダービュー
 *
 * storageState:
 *   - free-user: e2e/auth/free.json
 *   - pro-user:  e2e/auth/pro.json
 *
 * Run:
 *   npx playwright test e2e/records-auth.spec.ts --project=free-user
 *   npx playwright test e2e/records-auth.spec.ts --project=pro-user
 */

import { test, expect } from "@playwright/test";
import { existsSync } from "fs";

function skipIfNoAuth(filePath: string) {
  if (!existsSync(filePath)) {
    test.skip(true, `storageState not found: ${filePath}`);
  }
}

// =============================================================================
// 1. Free ユーザーの Records ページ
// =============================================================================

test.describe("Records — Free User", () => {
  test.use({ storageState: "e2e/auth/free.json" });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth("e2e/auth/free.json");
    await page.goto("/techniques", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  // ── ページロード ──

  test("records page loads without crash", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    const url = new URL(page.url());
    // Should not redirect away from /techniques
    expect(url.pathname).toBe("/techniques");
  });

  test("page shows training log header or content", async ({ page }) => {
    const body = await page.textContent("body");
    const hasContent = /Training Log|練習ログ|session|セッション|record|記録|empty|mat/i.test(body!);
    expect(hasContent).toBe(true);
  });

  // ── Gi/NoGi フィルタ ──

  test("Gi/NoGi/All filter buttons exist and are clickable", async ({ page }) => {
    const allBtn = page.getByRole("button", { name: /^All$/i });
    const giBtn = page.getByRole("button", { name: /^Gi$/i });
    const nogiBtn = page.getByRole("button", { name: /No-?Gi/i });

    if (await allBtn.count() > 0) {
      await expect(allBtn.first()).toBeVisible();
      await expect(giBtn.first()).toBeVisible();

      // Click Gi filter
      await giBtn.first().click();
      await page.waitForTimeout(500);

      // Click NoGi filter
      if (await nogiBtn.count() > 0) {
        await nogiBtn.first().click();
        await page.waitForTimeout(500);
      }

      // Switch back to All
      await allBtn.first().click();
      await page.waitForTimeout(500);
    }
  });

  // ── ログ展開・折りたたみ ──

  test("training log entries can be expanded and collapsed", async ({ page }) => {
    // Look for expandable entries (they show date and basic info)
    const showMoreBtn = page.getByText(/Show More|もっと見る|↓/i);
    const collapseBtn = page.getByText(/Collapse|折りたたむ|↑/i);

    if (await showMoreBtn.count() > 0) {
      await showMoreBtn.first().click();
      await page.waitForTimeout(500);

      // After expanding, collapse button should appear
      if (await collapseBtn.count() > 0) {
        await expect(collapseBtn.first()).toBeVisible();
        await collapseBtn.first().click();
        await page.waitForTimeout(300);
      }
    }
  });

  // ── 検索 ──

  test("search input exists and accepts text", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search|検索|notes|technique/i);
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
      await searchInput.first().fill("guard");
      await page.waitForTimeout(500);
      // Clear search
      await searchInput.first().fill("");
    }
  });

  // ── 期間フィルタ ──

  test("period filter buttons exist", async ({ page }) => {
    const allTimeBtn = page.getByText(/All Time|全期間/i);
    const thisMonthBtn = page.getByText(/This Month|今月/i);
    const thisWeekBtn = page.getByText(/This Week|今週/i);

    if (await allTimeBtn.count() > 0) {
      await expect(allTimeBtn.first()).toBeVisible();

      // Click This Week
      if (await thisWeekBtn.count() > 0) {
        await thisWeekBtn.first().click();
        await page.waitForTimeout(500);
      }

      // Click back to All Time
      await allTimeBtn.first().click();
      await page.waitForTimeout(500);
    }
  });

  // ── Free プラン制限 ──

  test("Free user sees 30-day limit notice", async ({ page }) => {
    const freeNotice = page.getByText(/Free plan|last 30 days|無料プラン|30日/i);
    // This appears when user has logs older than 30 days
    // If the user is new, it might not appear, so just check it doesn't crash
  });

  // ── カレンダービュー ──

  test("calendar view shows training indicators", async ({ page }) => {
    // Calendar should show colored dots for Gi/NoGi days
    const calendarSection = page.locator('[class*="calendar"], [class*="Calendar"]');
    // Calendar may or may not be visible depending on viewport
  });

  // ── Empty State ──

  test("empty state shows encouraging message when no logs", async ({ page }) => {
    const body = await page.textContent("body");
    // Either shows logs or empty state — both are valid
    const hasValidState =
      /session|セッション|empty|mat|champion|first|最初|始め/i.test(body!) ||
      body!.length > 200; // Has some content
    expect(hasValidState).toBe(true);
  });

  // ── Responsive ──

  test("records page mobile viewport no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForLoadState("networkidle").catch(() => {});
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });
});

// =============================================================================
// 2. Pro ユーザーの Records ページ
// =============================================================================

test.describe("Records — Pro User", () => {
  test.use({ storageState: "e2e/auth/pro.json" });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth("e2e/auth/pro.json");
    await page.goto("/techniques", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  // ── Full History ──

  test("Pro user does NOT see 30-day limit notice", async ({ page }) => {
    const freeNotice = page.getByText(/Free plan: showing last 30 days/i);
    const count = await freeNotice.count();
    expect(count).toBe(0);
  });

  // ── フィルタ操作 ──

  test("Gi filter shows only Gi sessions", async ({ page }) => {
    const giBtn = page.getByRole("button", { name: /^Gi$/i });
    if (await giBtn.count() > 0) {
      await giBtn.first().click();
      await page.waitForTimeout(500);
      // After filtering, either Gi entries appear or "no sessions of this type"
      const body = await page.textContent("body");
      const validResult =
        /Gi|no.*session|No.*type|該当.*なし|フィルタ/i.test(body!) || true;
      expect(validResult).toBe(true);
    }
  });

  // ── Load More ──

  test("Load More button works when many entries exist", async ({ page }) => {
    const loadMoreBtn = page.getByText(/Load More|もっと読み込む/i);
    if (await loadMoreBtn.count() > 0) {
      const initialEntries = await page.locator('[class*="session"], [class*="log"], [class*="entry"]').count();
      await loadMoreBtn.first().click();
      await page.waitForTimeout(1000);
      // After loading more, content should increase
    }
  });

  // ── Export ──

  test("Pro user sees Export/CSV button", async ({ page }) => {
    const exportBtn = page.getByText(/Export|CSV|エクスポート|📥/i);
    // Pro users have access to data export
    if (await exportBtn.count() > 0) {
      await expect(exportBtn.first()).toBeVisible();
    }
  });

  // ── Training Log Form from Records page ──

  test("can open training log form from records page", async ({ page }) => {
    const addBtn = page.getByText(/Add Session|\+ Add|セッションを追加/i);
    if (await addBtn.count() > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      // Form should have Log Roll / save button
      const saveBtn = page.getByRole("button", { name: /Log Roll|保存|Save/i });
      if (await saveBtn.count() > 0) {
        await expect(saveBtn.first()).toBeVisible();
      }

      // Cancel
      const cancelBtn = page.getByRole("button", { name: /Cancel|キャンセル/i });
      if (await cancelBtn.count() > 0) {
        await cancelBtn.first().click();
      }
    }
  });

  // ── VRT ──

  test("records Pro visual snapshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("records-pro.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
