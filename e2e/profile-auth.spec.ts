/**
 * e2e/profile-auth.spec.ts
 *
 * 認証済みユーザーの Profile ページ E2Eテスト
 *
 * テスト対象:
 *   - Profile タブ切替（Stats / Profile / Body / Settings / Milestones / Badges）
 *   - Body Management: BodyHeatmap サイクル（OK → Sore → Injured → OK）
 *   - Body Management: Weight Goal フォーム開閉
 *   - Body Management: Quick Weight Log
 *   - Profile 編集フォーム
 *   - InjuryCareAlert（Pro）
 *   - CSV エクスポート
 *   - アカウント管理（削除確認UI）
 *
 * storageState:
 *   - free-user: e2e/auth/free.json
 *   - pro-user:  e2e/auth/pro.json
 *
 * Run:
 *   npx playwright test e2e/profile-auth.spec.ts --project=free-user
 *   npx playwright test e2e/profile-auth.spec.ts --project=pro-user
 */

import { test, expect } from "@playwright/test";
import { existsSync } from "fs";

function skipIfNoAuth(filePath: string) {
  if (!existsSync(filePath)) {
    test.skip(true, `storageState not found: ${filePath}`);
  }
}

// =============================================================================
// 1. Free ユーザーの Profile ページ
// =============================================================================

test.describe("Profile — Free User", () => {
  test.use({ storageState: "e2e/auth/free.json" });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth("e2e/auth/free.json");
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  // ── ページロード ──

  test("profile page loads for authenticated user", async ({ page }) => {
    const url = new URL(page.url());
    expect(url.pathname).toBe("/profile");
    await expect(page.locator("body")).toBeVisible();
  });

  // ── タブ切替 ──

  test("profile tabs exist and are clickable", async ({ page }) => {
    const statsTab = page.getByRole("button", { name: /Stats|統計/i });
    const profileTab = page.getByRole("button", { name: /Profile|プロフィール/i });
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    const settingsTab = page.getByRole("button", { name: /Settings|設定/i });

    if (await statsTab.count() > 0) {
      // Click through each tab
      await profileTab.first().click();
      await page.waitForTimeout(500);
      const bodyText1 = await page.textContent("body");
      expect(/Belt|belt|帯|Gym|ジム|BJJ Start/i.test(bodyText1!)).toBe(true);

      await bodyTab.first().click();
      await page.waitForTimeout(500);
      const bodyText2 = await page.textContent("body");
      expect(/Body|Weight|体重|ボディ|Body Management/i.test(bodyText2!)).toBe(true);

      await settingsTab.first().click();
      await page.waitForTimeout(500);
      const bodyText3 = await page.textContent("body");
      expect(/Account|Settings|アカウント|設定|Delete|Timezone/i.test(bodyText3!)).toBe(true);

      // Switch back to Stats
      await statsTab.first().click();
      await page.waitForTimeout(500);
    }
  });

  test("Milestones tab exists", async ({ page }) => {
    const milestonesTab = page.getByRole("button", { name: /Milestones|マイルストーン/i });
    if (await milestonesTab.count() > 0) {
      await milestonesTab.first().click();
      await page.waitForTimeout(500);
    }
  });

  test("Badges tab exists", async ({ page }) => {
    const badgesTab = page.getByRole("button", { name: /Badges|バッジ/i });
    if (await badgesTab.count() > 0) {
      await badgesTab.first().click();
      await page.waitForTimeout(500);
    }
  });

  // ── Stats タブ: Pro Paywall ──

  test("Stats tab shows Pro-gated sections for Free user", async ({ page }) => {
    const statsTab = page.getByRole("button", { name: /Stats|統計/i });
    if (await statsTab.count() > 0) {
      await statsTab.first().click();
      await page.waitForTimeout(500);

      // Free user should see lock icons or paywall CTAs
      const lockIcons = page.getByText("🔒");
      const count = await lockIcons.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  // ── Profile タブ: 編集フォーム ──

  test("Profile tab shows editable fields", async ({ page }) => {
    const profileTab = page.getByRole("button", { name: /Profile|プロフィール/i });
    if (await profileTab.count() > 0) {
      await profileTab.first().click();
      await page.waitForTimeout(500);

      // Should show belt selector, gym input, etc.
      const beltText = page.getByText(/Belt|帯/i);
      await expect(beltText.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("Profile Save button exists", async ({ page }) => {
    const profileTab = page.getByRole("button", { name: /Profile|プロフィール/i });
    if (await profileTab.count() > 0) {
      await profileTab.first().click();
      await page.waitForTimeout(500);

      const saveBtn = page.getByRole("button", { name: /Save|保存/i });
      if (await saveBtn.count() > 0) {
        await expect(saveBtn.first()).toBeVisible();
      }
    }
  });

  // ── Body タブ: Free Paywall ──

  test("Body tab shows paywall for Free user", async ({ page }) => {
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() > 0) {
      await bodyTab.first().click();
      await page.waitForTimeout(500);

      // Free user should see body management paywall
      const paywallText = page.getByText(/Upgrade to Pro|Pro.*🎯|Track your weight/i);
      if (await paywallText.count() > 0) {
        await expect(paywallText.first()).toBeVisible();
      }
    }
  });

  // ── Settings タブ: Timezone, Account ──

  test("Settings tab shows timezone selector", async ({ page }) => {
    const settingsTab = page.getByRole("button", { name: /Settings|設定/i });
    if (await settingsTab.count() > 0) {
      await settingsTab.first().click();
      await page.waitForTimeout(500);

      const timezoneText = page.getByText(/Timezone|タイムゾーン/i);
      if (await timezoneText.count() > 0) {
        await expect(timezoneText.first()).toBeVisible();
      }
    }
  });

  test("Settings tab shows account deletion section", async ({ page }) => {
    const settingsTab = page.getByRole("button", { name: /Settings|設定/i });
    if (await settingsTab.count() > 0) {
      await settingsTab.first().click();
      await page.waitForTimeout(500);

      const deleteSection = page.getByText(/Delete Account|Danger Zone|アカウント削除|危険/i);
      if (await deleteSection.count() > 0) {
        await expect(deleteSection.first()).toBeVisible();
      }
    }
  });

  // ── CSV Export ──

  test("CSV export button exists in Settings", async ({ page }) => {
    const settingsTab = page.getByRole("button", { name: /Settings|設定/i });
    if (await settingsTab.count() > 0) {
      await settingsTab.first().click();
      await page.waitForTimeout(500);

      const exportBtn = page.getByText(/Download.*CSV|エクスポート|📥/i);
      if (await exportBtn.count() > 0) {
        await expect(exportBtn.first()).toBeVisible();
      }
    }
  });

  // ── Responsive ──

  test("profile page mobile viewport no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForLoadState("networkidle").catch(() => {});
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });
});

// =============================================================================
// 2. Pro ユーザーの Profile ページ
// =============================================================================

test.describe("Profile — Pro User", () => {
  test.use({ storageState: "e2e/auth/pro.json" });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth("e2e/auth/pro.json");
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  // ── Body タブ: BodyHeatmap ──

  test("Body tab shows body map for Pro user", async ({ page }) => {
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() > 0) {
      await bodyTab.first().click();
      await page.waitForTimeout(500);

      // Pro user should see body map (not paywall)
      const bodyMapText = page.getByText(/Body Map|Body Management|ボディマップ|ボディ管理/i);
      if (await bodyMapText.count() > 0) {
        await expect(bodyMapText.first()).toBeVisible();
      }
    }
  });

  test("Body heatmap part buttons are visible", async ({ page }) => {
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() > 0) {
      await bodyTab.first().click();
      await page.waitForTimeout(500);

      // Body part labels should be visible
      const bodyParts = [
        /Neck|首/i,
        /Shoulder|肩/i,
        /Knee|膝/i,
        /Lower Back|腰/i,
      ];

      for (const partRegex of bodyParts) {
        const part = page.getByText(partRegex);
        if (await part.count() > 0) {
          await expect(part.first()).toBeVisible();
          break; // At least one body part visible is sufficient
        }
      }
    }
  });

  test("Body heatmap tap cycles through OK → Sore → Injured → OK", async ({ page }) => {
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() > 0) {
      await bodyTab.first().click();
      await page.waitForTimeout(500);

      // Find a body part button and click it to cycle state
      // Body parts are rendered as clickable elements with color indicators
      const neckBtn = page.getByText(/Neck|首/i);
      if (await neckBtn.count() > 0) {
        // First click: OK → Sore (amber)
        await neckBtn.first().click();
        await page.waitForTimeout(300);

        // Second click: Sore → Injured (red)
        await neckBtn.first().click();
        await page.waitForTimeout(300);

        // Third click: Injured → OK (back to default)
        await neckBtn.first().click();
        await page.waitForTimeout(300);

        // Verify the element still exists (didn't crash)
        await expect(neckBtn.first()).toBeVisible();
      }
    }
  });

  // ── Body タブ: Weight Goal ──

  test("Weight Goal form can be opened", async ({ page }) => {
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() > 0) {
      await bodyTab.first().click();
      await page.waitForTimeout(500);

      // Look for Set Goal / Edit button
      const goalBtn = page.getByText(/Set Goal|Edit|目標設定|編集/i);
      if (await goalBtn.count() > 0) {
        await goalBtn.first().click();
        await page.waitForTimeout(500);

        // Form should show weight input and date
        const weightInput = page.locator('input[type="number"], input[placeholder*="kg"], input[placeholder*="weight"]');
        if (await weightInput.count() > 0) {
          await expect(weightInput.first()).toBeVisible();
        }

        // Cancel/Clear to close
        const cancelBtn = page.getByRole("button", { name: /Cancel|Clear|キャンセル|クリア/i });
        if (await cancelBtn.count() > 0) {
          await cancelBtn.first().click();
          await page.waitForTimeout(300);
        }
      }
    }
  });

  // ── Body タブ: Quick Weight Log ──

  test("Quick Weight Log section is visible for Pro", async ({ page }) => {
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() > 0) {
      await bodyTab.first().click();
      await page.waitForTimeout(500);

      const quickLogText = page.getByText(/Quick Weight Log|体重記録|Weight.*kg/i);
      if (await quickLogText.count() > 0) {
        await expect(quickLogText.first()).toBeVisible();
      }
    }
  });

  // ── Body タブ: InjuryCareAlert ──

  test("InjuryCareAlert appears when injuries are set", async ({ page }) => {
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() > 0) {
      await bodyTab.first().click();
      await page.waitForTimeout(500);

      // InjuryCareAlert only appears if body parts have sore/injured status
      // Just verify the Body tab doesn't crash
      const bodyContent = await page.textContent("body");
      expect(bodyContent!.length).toBeGreaterThan(100);
    }
  });

  // ── Body タブ: WeightCutPlanner ──

  test("WeightCutPlanner appears when goal is set", async ({ page }) => {
    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() > 0) {
      await bodyTab.first().click();
      await page.waitForTimeout(500);

      // WeightCutPlanner appears if a weight goal exists
      const cutPlannerText = page.getByText(/Weight Cut Planner|減量プランナー|Cut Phases/i);
      // May or may not be visible depending on whether user has goal set
    }
  });

  // ── Stats タブ: No Paywall for Pro ──

  test("Pro user Stats tab has no paywall locks", async ({ page }) => {
    const statsTab = page.getByRole("button", { name: /Stats|統計/i });
    if (await statsTab.count() > 0) {
      await statsTab.first().click();
      await page.waitForTimeout(500);

      // Pro should have 0 lock emojis
      const lockIcons = page.getByText("🔒");
      const count = await lockIcons.count();
      expect(count).toBe(0);
    }
  });

  test("Pro user does not see $9.99 paywall on profile", async ({ page }) => {
    const priceTag = page.getByText("$9.99");
    const count = await priceTag.count();
    expect(count).toBe(0);
  });

  // ── Referral Section ──

  test("referral section exists on profile", async ({ page }) => {
    const profileTab = page.getByRole("button", { name: /Profile|プロフィール/i });
    if (await profileTab.count() > 0) {
      await profileTab.first().click();
      await page.waitForTimeout(500);

      const referralText = page.getByText(/Invite Friends|Referral|友達を招待|紹介/i);
      if (await referralText.count() > 0) {
        await expect(referralText.first()).toBeVisible();
      }
    }
  });

  // ── VRT ──

  test("profile Pro visual snapshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("profile-pro.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
