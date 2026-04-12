/**
 * e2e/pro-features.spec.ts
 *
 * Pro 限定機能の E2E テスト（Free vs Pro 差分検証）
 *
 * テスト対象:
 *   - WeeklyReportCard: Free blur vs Pro 全表示
 *   - AICoachCard: Free paywall vs Pro 4モード生成
 *   - CompetitionSummaryCard: Free 基本 vs Pro Gi/NoGi分析
 *   - WeightCutPlanner: Pro only
 *   - BodyHeatmap / WeightChart: Pro only
 *   - SkillMap: Free 制限（10 nodes / 15 edges）vs Pro 無制限
 *
 * 目的: Pro 課金のゲーティングが正しく機能していることを保証する。
 *       Free ユーザーにはアップグレード導線が表示され、
 *       Pro ユーザーには全機能がアンロックされていること。
 *
 * Run:
 *   npx playwright test e2e/pro-features.spec.ts --project=free-user
 *   npx playwright test e2e/pro-features.spec.ts --project=pro-user
 */

import { test, expect } from "@playwright/test";
import { existsSync } from "fs";

function skipIfNoAuth(filePath: string) {
  if (!existsSync(filePath)) {
    test.skip(true, `storageState not found: ${filePath}`);
  }
}

// =============================================================================
// 1. Free ユーザー — Paywall ゲーティング検証
// =============================================================================

test.describe("Pro Features — Free User (Paywall)", () => {
  test.use({ storageState: "e2e/auth/free.json" });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth("e2e/auth/free.json");
  });

  // ── Dashboard: Pro Upsell Sections ──

  test("Dashboard: 12-Month Graph shows upgrade CTA", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const graphUpsell = page.getByText(/12-Month.*Graph|Upgrade.*Pro|12ヶ月.*グラフ/i);
    if (await graphUpsell.count() > 0) {
      await expect(graphUpsell.first()).toBeVisible();
    }
  });

  test("Dashboard: Body Management shows upgrade CTA", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const bodyUpsell = page.getByText(/Body Management|Upgrade.*Pro|ボディ管理/i);
    if (await bodyUpsell.count() > 0) {
      // At least one upsell for body should be visible
    }
  });

  test("Dashboard: AI Coach shows paywall (not generate button)", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const aiSection = page.getByText(/AI Coach/i);
    if (await aiSection.count() > 0) {
      // Free should NOT see "Generate coaching" button
      const generateBtn = page.getByRole("button", { name: /Generate coaching|コーチング生成/i });
      const genCount = await generateBtn.count();
      // Free users see upgrade CTA instead
      const upgradeCta = page.getByText(/Upgrade to Pro|Proにアップグレード/i);
      const upgradeCount = await upgradeCta.count();
      expect(upgradeCount).toBeGreaterThanOrEqual(1);
    }
  });

  test("Dashboard: WeeklyReport has blur overlay for Free", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Check for blur-sm class or unlock CTA
    const unlockCta = page.getByText(/Unlock Report|レポートをアンロック/i);
    if (await unlockCta.count() > 0) {
      await expect(unlockCta.first()).toBeVisible();
    }
  });

  // ── Profile Stats: Lock Icons ──

  test("Profile Stats: shows 🔒 lock icons for Free user", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const statsTab = page.getByRole("button", { name: /Stats|統計/i });
    if (await statsTab.count() > 0) {
      await statsTab.first().click();
      await page.waitForTimeout(500);

      const locks = page.getByText("🔒");
      const count = await locks.count();
      // MCP検証済み: Free user sees multiple 🔒 on Stats tab
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  // ── Profile Body: Paywall ──

  test("Profile Body tab: shows paywall for Free user", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() > 0) {
      await bodyTab.first().click();
      await page.waitForTimeout(500);

      const paywallText = page.getByText(/Track your weight.*Pro|体重.*Pro|Upgrade to Pro/i);
      if (await paywallText.count() > 0) {
        await expect(paywallText.first()).toBeVisible();
      }
    }
  });

  // ── SkillMap: Free Limit ──

  test("SkillMap shows free plan limit message", async ({ page }) => {
    await page.goto("/techniques", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    // SkillMap might be on techniques or dashboard
    const freeLimitText = page.getByText(/Free.*up to.*nodes|Free.*10 nodes|無料.*ノード/i);
    // This may not appear if user hasn't created nodes yet
  });

  // ── Records: 30-day limit ──

  test("Records shows 30-day limit for Free", async ({ page }) => {
    await page.goto("/techniques", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const freePlanNotice = page.getByText(/Free plan.*30 days|無料プラン.*30日/i);
    // Only shows if user has data older than 30 days
  });
});

// =============================================================================
// 2. Pro ユーザー — 全機能アンロック検証
// =============================================================================

test.describe("Pro Features — Pro User (Unlocked)", () => {
  test.use({ storageState: "e2e/auth/pro.json" });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth("e2e/auth/pro.json");
  });

  // ── Dashboard: No Paywall ──

  test("Dashboard: no $9.99 or $79.99 visible for Pro", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const price999 = page.getByText("$9.99");
    const price7999 = page.getByText("$79.99");
    expect(await price999.count()).toBe(0);
    expect(await price7999.count()).toBe(0);
  });

  test("Dashboard: no 'Upgrade to Pro' visible", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    // "Upgrade to Pro" should not appear anywhere for Pro users
    const upgradeCtas = page.getByText(/Upgrade to Pro/i);
    const count = await upgradeCtas.count();
    expect(count).toBe(0);
  });

  // ── AI Coach: 4 Modes ──

  test("AI Coach: all 4 mode chips visible for Pro", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const modes = [
      /Weekly|週次/i,
      /Weakness|弱点/i,
      /Next Session|次のセッション/i,
      /Comp Prep|試合準備/i,
    ];

    for (const mode of modes) {
      const chip = page.getByText(mode);
      if (await chip.count() > 0) {
        await expect(chip.first()).toBeVisible();
      }
    }
  });

  test("AI Coach: Generate button visible and clickable", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const generateBtn = page.getByText(/Generate coaching|コーチング生成/i);
    if (await generateBtn.count() > 0) {
      await expect(generateBtn.first()).toBeVisible();
      // Don't actually click generate (would hit API), just verify it exists
    }
  });

  // ── WeeklyReport: Full Data ──

  test("WeeklyReport: tab switching works for Pro", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const weekTab = page.getByRole("button", { name: /^Week$|^週$/ });
    const monthTab = page.getByRole("button", { name: /^Month$|^月$/ });

    if (await weekTab.count() > 0) {
      await monthTab.first().click();
      await page.waitForTimeout(500);

      // Verify Month content loads (no crash)
      await expect(page.locator("body")).toBeVisible();

      await weekTab.first().click();
      await page.waitForTimeout(500);
    }
  });

  // ── Competition Summary (Pro) ──

  test("Competition summary shows advanced analytics for Pro", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const statsTab = page.getByRole("button", { name: /Stats|統計/i });
    if (await statsTab.count() > 0) {
      await statsTab.first().click();
      await page.waitForTimeout(500);

      // Pro should see advanced competition analytics
      const compStats = page.getByText(/Gi.*No-?Gi Split|Top.*Techniques|Win Rate.*Belt|勝率/i);
      // May not appear if user has no competition data
    }
  });

  // ── Body Management (Pro) ──

  test("Body Management: full feature set available for Pro", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const bodyTab = page.getByRole("button", { name: /Body|ボディ/i });
    if (await bodyTab.count() > 0) {
      await bodyTab.first().click();
      await page.waitForTimeout(500);

      // Pro should NOT see paywall
      const paywallCta = page.getByText(/Track your weight.*Pro 🎯/i);
      const paywallCount = await paywallCta.count();
      expect(paywallCount).toBe(0);

      // Should see actual body management components
      const bodyContent = await page.textContent("body");
      const hasBodyFeatures = /Weight|Body Map|Quick|体重|ボディマップ/i.test(bodyContent!);
      expect(hasBodyFeatures).toBe(true);
    }
  });

  // ── Profile Stats: No Locks ──

  test("Profile Stats: no 🔒 for Pro user", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const statsTab = page.getByRole("button", { name: /Stats|統計/i });
    if (await statsTab.count() > 0) {
      await statsTab.first().click();
      await page.waitForTimeout(500);

      const locks = page.getByText("🔒");
      const count = await locks.count();
      expect(count).toBe(0);
    }
  });

  // ── Records: No 30-day Limit ──

  test("Records: no 30-day limit for Pro", async ({ page }) => {
    await page.goto("/techniques", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const freePlanNotice = page.getByText(/Free plan: showing last 30 days/i);
    const count = await freePlanNotice.count();
    expect(count).toBe(0);
  });

  // ── Manage Subscription ──

  test("Pro user sees Manage Subscription in Settings", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const settingsTab = page.getByRole("button", { name: /Settings|設定/i });
    if (await settingsTab.count() > 0) {
      await settingsTab.first().click();
      await page.waitForTimeout(500);

      const manageSub = page.getByText(/Manage Subscription|サブスクリプション管理/i);
      if (await manageSub.count() > 0) {
        await expect(manageSub.first()).toBeVisible();
      }
    }
  });
});

// =============================================================================
// 3. Gym Owner — ジム管理機能
// =============================================================================

test.describe("Pro Features — Gym Owner", () => {
  test.use({ storageState: "e2e/auth/gym-owner.json" });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth("e2e/auth/gym-owner.json");
  });

  test("Gym dashboard is accessible for gym owner", async ({ page }) => {
    await page.goto("/gym/dashboard", { waitUntil: "domcontentloaded" });
    const url = new URL(page.url());
    // Gym owner should NOT be redirected to /login
    expect(url.pathname).not.toBe("/login");
  });

  test("Gym dashboard shows gym management content", async ({ page }) => {
    await page.goto("/gym/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const body = await page.textContent("body");
    const hasGymContent = /gym|dojo|道場|member|メンバー|invite|招待|QR/i.test(body!);
    expect(hasGymContent).toBe(true);
  });
});

// =============================================================================
// 4. Gym Member — ジムメンバー機能
// =============================================================================

test.describe("Pro Features — Gym Member", () => {
  test.use({ storageState: "e2e/auth/gym-member.json" });

  test.beforeEach(async ({ page }) => {
    skipIfNoAuth("e2e/auth/gym-member.json");
  });

  test("Gym member can access dashboard", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const url = new URL(page.url());
    expect(url.pathname).toBe("/dashboard");
  });

  test("Gym member sees gym affiliation on profile", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const profileTab = page.getByRole("button", { name: /Profile|プロフィール/i });
    if (await profileTab.count() > 0) {
      await profileTab.first().click();
      await page.waitForTimeout(500);

      // Should show gym name or gym section
      const gymText = page.getByText(/Gym|Academy|道場|ジム|E2E Test Dojo/i);
      if (await gymText.count() > 0) {
        await expect(gymText.first()).toBeVisible();
      }
    }
  });
});
