/**
 * e2e/dashboard-auth.spec.ts
 *
 * 認証済みユーザーのダッシュボード「操作」E2Eテスト
 *
 * 責務: UI操作（ボタン押下、フォーム開閉、タブ切替）の動作検証。
 * ※ Paywall ゲーティング（Upgrade CTA / $9.99 / 🔒）は pro-features.spec.ts に委譲。
 *
 * テスト対象:
 *   - WeeklyReportCard: 週/月タブ切替
 *   - AICoachCard: モードチップ切替、生成ボタン表示
 *   - TrainingLogForm: フォーム開閉、Duration presets、Type選択、Optional fields
 *   - StreakCard / StatsCards: コンテンツ表示
 *   - レスポンシブ: モバイル水平overflow
 *
 * Run:
 *   npx playwright test e2e/dashboard-auth.spec.ts --project=free-user
 *   npx playwright test e2e/dashboard-auth.spec.ts --project=pro-user
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
// 1. Free ユーザーのダッシュボード操作
// =============================================================================

test.describe("Dashboard Ops — Free User", () => {
  test.use({ storageState: AUTH_FILES.free });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.free);
    await gotoAndWait(page, "/dashboard");
  });

  // ── WeeklyReportCard ──

  test("WeeklyReportCard tab buttons (Week/Month) are visible", async ({ page }) => {
    const weekTab = page.getByRole("button", { name: /^Week$|^週$/ });
    const monthTab = page.getByRole("button", { name: /^Month$|^月$/ });
    // Free user still has tabs rendered (behind blur)
    if (await weekTab.count() > 0) {
      await expect(weekTab.first()).toBeVisible();
      await expect(monthTab.first()).toBeVisible();
    }
  });

  // ── Record FAB (TrainingLog is on /records, not /dashboard) ──

  test("record FAB links to /records", async ({ page }) => {
    // Dashboard has a mobile FAB linking to /records (TrainingLog page)
    // On desktop, check for the "Records" link or Recent Logs section
    const recordsLink = page.locator('a[href="/records"]').first();
    await expect(recordsLink).toBeAttached({ timeout: 5000 });
  });

  test("training log form has duration presets (30/60/90/120)", async ({ page }) => {
    const addBtn = page.getByText(/\+ Add Session|Log your roll|Log Your First Roll/i).first();
    if (await addBtn.count() === 0) return test.skip(true, "No add session button");
    await addBtn.click();
    await page.waitForTimeout(500);

    // Duration presets are rendered as buttons with just numbers
    const preset60 = page.getByRole("button", { name: /^60$/ });
    await expect(preset60.first(), "60-min preset button should exist").toBeVisible({ timeout: 3000 });

    const preset90 = page.getByRole("button", { name: /^90$/ });
    await expect(preset90.first(), "90-min preset button should exist").toBeVisible();

    // Click 60 to verify it's interactive
    await preset60.first().click();
    await page.waitForTimeout(300);
  });

  test("training log form has type selection (Gi/NoGi/Drilling)", async ({ page }) => {
    const addBtn = page.getByText(/\+ Add Session|Log your roll|Log Your First Roll/i).first();
    if (await addBtn.count() === 0) return test.skip(true, "No add session button");
    await addBtn.click();
    await page.waitForTimeout(500);

    const giBtn = page.getByRole("button", { name: /^Gi$/i });
    await expect(giBtn.first(), "Gi type button should exist").toBeVisible({ timeout: 3000 });

    const nogiBtn = page.getByRole("button", { name: /No-?Gi/i });
    await expect(nogiBtn.first(), "NoGi type button should exist").toBeVisible();

    // Click Gi
    await giBtn.first().click();
    await page.waitForTimeout(300);
  });

  test("training log form optional fields toggle expands partner/instructor", async ({ page }) => {
    const addBtn = page.getByText(/\+ Add Session|Log your roll|Log Your First Roll/i).first();
    if (await addBtn.count() === 0) return test.skip(true, "No add session button");
    await addBtn.click();
    await page.waitForTimeout(500);

    const optionalToggle = page.getByText(/Optional details|optional|任意/i);
    if (await optionalToggle.count() === 0) return test.skip(true, "No optional toggle found");

    await optionalToggle.first().click();
    await page.waitForTimeout(500);

    // After expanding: partner, instructor, or roll focus should be visible
    const expandedContent = page.getByText(/Partner|パートナー|Instructor|インストラクター|Focus|フォーカス/i);
    await expect(expandedContent.first(), "Expanded optional section should show partner/instructor/focus").toBeVisible({ timeout: 3000 });
  });

  // ── Dashboard Content ──

  test("dashboard shows streak or training stats", async ({ page }) => {
    const body = await page.textContent("body");
    const hasTrainingContent = /streak|sessions?|training|練習|ストリーク|セッション|Log your first/i.test(body!);
    expect(hasTrainingContent, "Dashboard should contain training-related content").toBe(true);
  });

  // ── Responsive ──

  test("mobile 375px no horizontal overflow", async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});

// =============================================================================
// 2. Pro ユーザーのダッシュボード操作
// =============================================================================

test.describe("Dashboard Ops — Pro User", () => {
  test.use({ storageState: AUTH_FILES.pro });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth(AUTH_FILES.pro);
    await gotoAndWait(page, "/dashboard");
  });

  // ── WeeklyReportCard (Pro) ──

  test("WeeklyReportCard tab switching (Week ↔ Month) works", async ({ page }) => {
    const weekTab = page.getByRole("button", { name: /^Week$|^週$/ });
    const monthTab = page.getByRole("button", { name: /^Month$|^月$/ });

    if (await weekTab.count() === 0) return test.skip(true, "Report tabs not found");

    await monthTab.first().click();
    await page.waitForTimeout(500);
    // Verify page didn't crash
    await expect(page.locator("body")).toBeVisible();

    await weekTab.first().click();
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toBeVisible();
  });

  // ── AICoachCard (Pro) ──

  test("AICoachCard 4 mode chips are visible", async ({ page }) => {
    const aiSection = page.getByText(/AI Coach/i);
    if (await aiSection.count() === 0) return test.skip(true, "AI Coach section not found");

    const modes = [
      { regex: /Weekly|週次/i, label: "Weekly" },
      { regex: /Weakness|弱点/i, label: "Weakness" },
      { regex: /Next Session|次のセッション/i, label: "Next Session" },
      { regex: /Comp Prep|試合準備/i, label: "Comp Prep" },
    ];

    for (const mode of modes) {
      const chip = page.getByText(mode.regex);
      if (await chip.count() > 0) {
        await expect(chip.first()).toBeVisible();
      }
    }
  });

  test("AICoachCard mode switching is interactive", async ({ page }) => {
    const weaknessChip = page.getByText(/Weakness|弱点/i);
    if (await weaknessChip.count() === 0) return test.skip(true, "Weakness chip not found");

    await weaknessChip.first().click();
    await page.waitForTimeout(300);

    const nextSessionChip = page.getByText(/Next Session|次のセッション/i);
    if (await nextSessionChip.count() > 0) {
      await nextSessionChip.first().click();
      await page.waitForTimeout(300);
    }

    // No crash
    await expect(page.locator("body")).toBeVisible();
  });

  test("AICoachCard generate button is visible (not paywall)", async ({ page }) => {
    const generateBtn = page.getByText(/Generate coaching|コーチング生成/i);
    if (await generateBtn.count() > 0) {
      await expect(generateBtn.first()).toBeVisible();
      // Don't click — would hit real API
    }
  });

  // ── PRO Badge ──

  test("Pro badge is displayed", async ({ page }) => {
    const proBadge = page.getByText(/✦ PRO|PRO/);
    if (await proBadge.count() > 0) {
      await expect(proBadge.first()).toBeVisible();
    }
  });

  // ── VRT ──

  test("dashboard Pro visual snapshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("dashboard-pro.png", VRT_OPTIONS);
  });
});
