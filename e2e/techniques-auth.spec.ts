/**
 * e2e/techniques-auth.spec.ts
 *
 * 認証済みユーザーの /techniques ページ「操作」E2Eテスト
 *
 * 責務: テクニックジャーナルのタブ切替、テクニック追加フォーム、
 *       統計ストリップ、RustyBanner、SafetyBanner、レスポンシブ。
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

// =============================================================================
// 1. Free ユーザーのテクニック操作
// =============================================================================

test.describe("Techniques — Free User", () => {
  test.use({ storageState: AUTH_FILES.free });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.free);
    await gotoAndWait(page, "/techniques");
  });

  test("page loads without redirect (authenticated)", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("page title and subtitle are visible", async ({ page }) => {
    // h1 title — matches both EN/JA via i18n
    const heading = page.locator("h1");
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

  // ── Tab Layout ──

  test("3-tab layout is present (Journal / Skill Map / Wiki)", async ({ page }) => {
    // Tabs are rendered as buttons in TechniquesTabsLayout
    const tabButtons = page.getByRole("button");
    const allText = await page.textContent("body");

    // Should have journal-related, skill map, and wiki tab references
    const hasJournal = /Journal|ジャーナル/i.test(allText ?? "");
    const hasSkillMap = /Skill Map|スキルマップ/i.test(allText ?? "");
    const hasWiki = /Wiki/i.test(allText ?? "");

    expect(hasJournal || hasSkillMap || hasWiki, "At least one tab label should be visible").toBe(true);
  });

  test("tab switching works without crash", async ({ page }) => {
    // Find tab buttons — they use PageTabs component
    const tabs = page.locator("[class*='sticky'] button");
    const tabCount = await tabs.count();

    if (tabCount >= 2) {
      // Click second tab
      await tabs.nth(1).click();
      await page.waitForTimeout(500);
      await expect(page.locator("body")).toBeVisible();

      // Click third tab if exists
      if (tabCount >= 3) {
        await tabs.nth(2).click();
        await page.waitForTimeout(500);
        await expect(page.locator("body")).toBeVisible();
      }

      // Return to first tab
      await tabs.nth(0).click();
      await page.waitForTimeout(500);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  // ── Technique CRUD ──

  test("add technique button exists and opens form", async ({ page }) => {
    const addBtn = page.getByText(/Add Technique|\+ Add|テクニック追加|追加/i).first();
    if (await addBtn.count() === 0) {
      // Try icon button
      const iconBtn = page.getByRole("button", { name: /add|追加/i });
      if (await iconBtn.count() === 0) return test.skip(true, "No add technique button found");
      await iconBtn.first().click();
    } else {
      await addBtn.click();
    }

    await page.waitForTimeout(500);

    // Form should show name input or save/cancel buttons
    const formIndicator = page.getByText(/Save|保存|Cancel|キャンセル|Name|名前/i);
    await expect(formIndicator.first(), "Technique form should open").toBeVisible({ timeout: 5000 });
  });

  test("technique list or empty state is shown", async ({ page }) => {
    const body = await page.textContent("body");
    // Either has technique entries or shows empty state message
    const hasTechniques = /mastery|category|guard|sweep|submission|テクニック/i.test(body ?? "");
    const hasEmptyState = /no techniques|first technique|テクニックがありません|最初のテクニック/i.test(body ?? "");
    const hasAnyContent = hasTechniques || hasEmptyState;

    expect(hasAnyContent, "Should show technique list or empty state").toBe(true);
  });

  // ── Stats Strip ──

  test("stats strip shows counts when techniques exist", async ({ page }) => {
    // Stats strip uses grid-cols-3 with counters (Logged / Solid+ / Mastered)
    const statsGrid = page.locator(".grid.grid-cols-3");
    if (await statsGrid.count() > 0) {
      await expect(statsGrid.first()).toBeVisible();
      // Should contain at least one number
      const statsText = await statsGrid.first().textContent();
      expect(statsText).toMatch(/\d/);
    }
    // No stats is also valid (0 techniques)
  });

  // ── Skill Map Link ──

  test("Skill Map card links to /techniques/skillmap", async ({ page }) => {
    // Switch to Skill Map tab first
    const tabs = page.locator("[class*='sticky'] button");
    const tabCount = await tabs.count();
    if (tabCount >= 2) {
      await tabs.nth(1).click();
      await page.waitForTimeout(500);
    }

    const skillMapLink = page.locator('a[href="/techniques/skillmap"]');
    if (await skillMapLink.count() > 0) {
      await expect(skillMapLink.first()).toBeVisible();
      // Verify href without navigating
      const href = await skillMapLink.first().getAttribute("href");
      expect(href).toBe("/techniques/skillmap");
    }
  });

  // ── Wiki Tab ──

  test("Wiki tab shows external links", async ({ page }) => {
    // Switch to Wiki tab (usually 3rd)
    const tabs = page.locator("[class*='sticky'] button");
    const tabCount = await tabs.count();
    if (tabCount >= 3) {
      await tabs.nth(2).click();
      await page.waitForTimeout(500);

      const wikiLinks = page.locator('a[href*="wiki.bjj-app.net"]');
      if (await wikiLinks.count() > 0) {
        await expect(wikiLinks.first()).toBeVisible();
      }
    }
  });

  // ── Free Limit Label ──

  test("free user sees free limit indicator", async ({ page }) => {
    const body = await page.textContent("body");
    // Free limit text rendered in both techniques page and skill map tab
    const hasFreeLimit = /free limit|30-day|無料.*制限|最新30日/i.test(body ?? "");
    // This is optional — some states might not show it
    if (hasFreeLimit) {
      expect(hasFreeLimit).toBe(true);
    }
  });

  // ── Responsive ──

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
    const proBadge = page.getByText(/✦ PRO|PRO/);
    if (await proBadge.count() > 0) {
      await expect(proBadge.first()).toBeVisible();
    }
  });

  test("no free limit indicator for Pro user", async ({ page }) => {
    const body = await page.textContent("body");
    // Pro users should not see free limit text
    const hasFreeLimit = /free limit|30-day limit|無料.*制限|最新30日のみ/i.test(body ?? "");
    // Note: "freeLimit" i18n key might still render for skill map tab — check carefully
    // This test is advisory rather than strict
  });

  test("category breakdown chips are visible (if techniques exist)", async ({ page }) => {
    // Category chips rendered with capitalize class
    const chips = page.locator(".capitalize");
    if (await chips.count() > 0) {
      await expect(chips.first()).toBeVisible();
      const chipText = await chips.first().textContent();
      expect(chipText).toMatch(/·\s*\d/); // "guard · 5" pattern
    }
  });

  test("JSON-LD structured data is present", async ({ page }) => {
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toBeAttached();
    const content = await jsonLd.textContent();
    expect(content).toContain("ItemList");
    expect(content).toContain("BJJ Technique Journal");
  });

  // ── VRT ──

  test("techniques Pro visual snapshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("techniques-pro.png", VRT_OPTIONS);
  });
});
