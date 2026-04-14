/**
 * e2e/techniques-auth.spec.ts
 *
 * 認証済みユーザーの /techniques ページ「操作」E2Eテスト
 *
 * 責務: テクニックジャーナルのタブ切替、テクニック追加フォーム、
 *       統計ストリップ、JSON-LD、レスポンシブ。
 * ※ Paywall / Pro制限は pro-features.spec.ts に委譲。
 *
 * Run:
 *   npx playwright test e2e/techniques-auth.spec.ts --project=free-user
 *   npx playwright test e2e/techniques-auth.spec.ts --project=pro-user
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

// ── i18n-aware regex helpers ──────────────────────────────────────────────────
// Tab labels: en "Journal" / ja "ジャーナル", en "Skill Map" / ja "スキルマップ", "Wiki"
const RE_TAB_JOURNAL = /^Journal$|^ジャーナル$/;
const RE_TAB_SKILLMAP = /^Skill Map$|^スキルマップ$/;
const RE_TAB_WIKI = /^Wiki$/;

// Technique form actions: en "+ Add" / ja "+ 追加"
const RE_ADD_BTN = /\+ Add|\+ 追加/;
const RE_SAVE = /^Save$|^保存$/;
const RE_CANCEL = /^Cancel$|^キャンセル$/;

// Empty state: en "No techniques yet" / ja "テクニックはまだありません"
const RE_EMPTY = /No techniques yet|テクニックはまだありません/;

// Search: en "Search techniques..." / ja "テクニックを検索..."
const RE_SEARCH = /Search techniques|テクニックを検索/;

// =============================================================================
// 1. Free ユーザーのテクニック操作
// =============================================================================

test.describe("Techniques — Free User", () => {
  test.use({ storageState: AUTH_FILES.free });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.free);
    await gotoAndWait(page, "/techniques");
  });

  // ── 基本表示 ──

  test("page loads without redirect (authenticated)", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("page heading is visible", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  // ── 3タブ ──

  test("3 tab buttons are rendered (Journal / Skill Map / Wiki)", async ({ page }) => {
    const journal = page.getByRole("button", { name: RE_TAB_JOURNAL });
    const skillmap = page.getByRole("button", { name: RE_TAB_SKILLMAP });
    const wiki = page.getByRole("button", { name: RE_TAB_WIKI });

    await expect(journal).toBeVisible({ timeout: 5000 });
    await expect(skillmap).toBeVisible();
    await expect(wiki).toBeVisible();
  });

  test("tab switching renders different content", async ({ page }) => {
    const journalTab = page.getByRole("button", { name: RE_TAB_JOURNAL });
    const skillmapTab = page.getByRole("button", { name: RE_TAB_SKILLMAP });
    const wikiTab = page.getByRole("button", { name: RE_TAB_WIKI });

    // Journal tab (default): add button or empty state or technique list
    await expect(journalTab).toBeVisible({ timeout: 5000 });

    // → Skill Map tab: should show link to /techniques/skillmap
    await skillmapTab.click();
    await page.waitForTimeout(400);
    const skillmapLink = page.locator('a[href="/techniques/skillmap"]');
    await expect(skillmapLink).toBeVisible({ timeout: 3000 });

    // → Wiki tab: should show wiki.bjj-app.net links
    await wikiTab.click();
    await page.waitForTimeout(400);
    const wikiLink = page.locator('a[href*="wiki.bjj-app.net"]').first();
    await expect(wikiLink).toBeVisible({ timeout: 3000 });

    // → Back to Journal: page is still alive
    await journalTab.click();
    await page.waitForTimeout(400);
    await expect(page.locator("body")).toBeVisible();
  });

  // ── テクニック追加フォーム ──

  test("add technique button opens form with Save/Cancel", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: RE_ADD_BTN });
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();

    // Form should appear — Name input + Save + Cancel
    const nameInput = page.getByPlaceholder(/technique name|テクニック名/i);
    await expect(nameInput).toBeVisible({ timeout: 3000 });

    const saveBtn = page.getByRole("button", { name: RE_SAVE });
    const cancelBtn = page.getByRole("button", { name: RE_CANCEL });
    await expect(saveBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    // Close
    await cancelBtn.click();
    await expect(nameInput).not.toBeVisible({ timeout: 3000 });
  });

  test("search input is present on Journal tab", async ({ page }) => {
    const search = page.getByPlaceholder(RE_SEARCH);
    await expect(search).toBeVisible({ timeout: 5000 });
  });

  test("technique list or empty state is shown", async ({ page }) => {
    // Wait for initial load (TechniqueLog has initialLoading state)
    await page.waitForTimeout(2000);

    const empty = page.getByText(RE_EMPTY);
    const listItems = page.locator("[data-technique-id], [data-testid='technique-item']");

    // At least one of: empty state OR technique items
    const emptyCount = await empty.count();
    const listCount = await listItems.count();

    if (emptyCount === 0 && listCount === 0) {
      // Fallback: check body text for any technique-related content
      const body = await page.textContent("body");
      const hasContent = /guard|sweep|submission|pass|mount|mastery|テクニック/i.test(body ?? "");
      expect(hasContent || emptyCount > 0, "Should show technique list or empty state").toBe(true);
    }
  });

  // ── 統計ストリップ ──

  test("stats strip shows numeric counts when techniques exist", async ({ page }) => {
    const statsGrid = page.locator(".grid.grid-cols-3");
    const count = await statsGrid.count();
    if (count > 0) {
      await expect(statsGrid.first()).toBeVisible();
      // Each stat cell has a number in text-xl/text-2xl
      const numbers = statsGrid.first().locator(".tabular-nums");
      const numCount = await numbers.count();
      expect(numCount, "Stats strip should have numeric counters").toBeGreaterThanOrEqual(1);
    }
    // count === 0 is valid (user has 0 techniques → no stats)
  });

  // ── JSON-LD ──

  test("JSON-LD structured data (ItemList) is present", async ({ page }) => {
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toBeAttached();
    const content = await jsonLd.textContent();
    expect(content).toContain('"@type":"ItemList"');
    expect(content).toContain("BJJ Technique Journal");
  });

  // ── レスポンシブ ──

  test("mobile 375px no horizontal overflow", async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});

// =============================================================================
// 2. Pro ユーザーのテクニック操作
// =============================================================================

test.describe("Techniques — Pro User", () => {
  test.use({ storageState: AUTH_FILES.pro });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.pro);
    await gotoAndWait(page, "/techniques");
  });

  test("Pro badge is displayed", async ({ page }) => {
    const proBadge = page.getByText("✦ PRO");
    await expectVisible(page, proBadge, "Pro user should see ✦ PRO badge");
  });

  test("category breakdown chips show 'name · count' format", async ({ page }) => {
    // Category chips: e.g. "guard · 5", "submission · 3"
    const chips = page.locator(".capitalize");
    const count = await chips.count();
    if (count > 0) {
      const text = await chips.first().textContent();
      expect(text, "Chip should have 'category · count' format").toMatch(/·\s*\d/);
    }
    // count === 0 valid (Pro user may have 0 techniques)
  });

  test("Skill Map tab card is clickable and links correctly", async ({ page }) => {
    const skillmapTab = page.getByRole("button", { name: RE_TAB_SKILLMAP });
    await expect(skillmapTab).toBeVisible({ timeout: 5000 });
    await skillmapTab.click();
    await page.waitForTimeout(400);

    const card = page.locator('a[href="/techniques/skillmap"]');
    await expect(card).toBeVisible({ timeout: 3000 });

    // Verify the card has title text
    const cardText = await card.textContent();
    expect(cardText).toMatch(/Skill Map|スキルマップ/);
  });

  // ── VRT ──

  test("techniques Pro visual snapshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("techniques-pro.png", VRT_OPTIONS);
  });
});
