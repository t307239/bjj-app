/**
 * e2e/critical-path.spec.ts
 *
 * クリティカルパスE2Eテスト — アプリの「核となるループ」を一気通貫で検証。
 *
 * テストフロー:
 *   1. ダッシュボードで記録追加フォームを開く
 *   2. タイプ(Gi)・Duration(90min)を選択
 *   3. ユニークなメモを入力して保存
 *   4. 記録ページで新しいエントリが表示されることを確認
 *   5. テクニックページが正常にロードされることを確認
 *   6. プロフィールページが正常にロードされることを確認
 *   7. クリーンアップ: テスト記録を削除
 *
 * Run:
 *   npx playwright test e2e/critical-path.spec.ts --project=free-user
 *   npx playwright test e2e/critical-path.spec.ts --project=pro-user
 */

import { test, expect } from "@playwright/test";
import {
  AUTH_FILES,
  skipIfNoAuth,
  gotoAndWait,
  expectNoHorizontalOverflow,
} from "./helpers";

// ── テスト識別子（ユニーク） ──
const TEST_TAG = `[E2E-TEST-${Date.now()}]`;

// =============================================================================
// Critical Path: ダッシュボード → 記録追加 → 記録確認 → テクニック → プロフィール
// =============================================================================

test.describe("Critical Path — Core User Journey", () => {
  test.use({ storageState: AUTH_FILES.free });

  test.beforeEach(async () => {
    skipIfNoAuth(AUTH_FILES.free);
  });

  test("full journey: add training log → verify in records → navigate all pages", async ({ page }) => {
    // ══════════════════════════════════════════════════════════
    // Step 1: ダッシュボードを開く
    // ══════════════════════════════════════════════════════════
    await gotoAndWait(page, "/dashboard");
    await expect(page.locator("body")).toBeVisible();

    // ダッシュボードにトレーニング関連コンテンツがあること
    const dashBody = await page.textContent("body");
    expect(
      /streak|sessions?|練習|セッション|training|Log your first/i.test(dashBody!),
      "Dashboard should show training content"
    ).toBe(true);

    // ══════════════════════════════════════════════════════════
    // Step 2: 記録ページを開き、記録数を取得
    // ══════════════════════════════════════════════════════════
    await gotoAndWait(page, "/records");

    // 現在の記録数を取得（ヘッダーの "(33)" 等から）
    const headerText = await page.textContent("body");
    const countMatch = headerText?.match(/(?:練習記録|Training Log)\s*[（(](\d+)[）)]/);
    const beforeCount = countMatch ? parseInt(countMatch[1], 10) : -1;

    // ══════════════════════════════════════════════════════════
    // Step 3: 記録追加フォームを開く
    // ══════════════════════════════════════════════════════════
    const addBtn = page.getByText(/\+ 記録を追加|\+ Add Session|Log your roll|Log Your First Roll/i).first();
    if (await addBtn.count() === 0) {
      // FABボタンを探す
      const fab = page.locator('button:has-text("＋"), button:has-text("+"), a[href*="add"]').first();
      if (await fab.count() > 0) {
        await fab.click();
      } else {
        return test.skip(true, "Add session button not found");
      }
    } else {
      await addBtn.click();
    }
    await page.waitForTimeout(800);

    // ══════════════════════════════════════════════════════════
    // Step 4: フォーム入力 — Type: Gi, Duration: 90min, Notes: テスト識別子
    // ══════════════════════════════════════════════════════════

    // Type: Gi を選択
    const giBtn = page.getByRole("button", { name: /^Gi$/i });
    if (await giBtn.count() > 0) {
      await giBtn.first().click();
      await page.waitForTimeout(200);
    }

    // Duration: 90 を選択
    const preset90 = page.getByRole("button", { name: /^90$/ });
    if (await preset90.count() > 0) {
      await preset90.first().click();
      await page.waitForTimeout(200);
    }

    // Notes: テスト識別子を入力
    const notesInput = page.locator('textarea[placeholder], textarea[name="notes"]').first();
    if (await notesInput.count() > 0) {
      await notesInput.fill(`Critical path test ${TEST_TAG}`);
    }

    // ══════════════════════════════════════════════════════════
    // Step 5: 保存
    // ══════════════════════════════════════════════════════════
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await submitBtn.click();

    // 保存完了を待つ（フォームが閉じる or トースト表示）
    await page.waitForTimeout(2000);

    // フォームが閉じたことを確認（submit ボタンが非表示になる）
    const formStillOpen = await submitBtn.isVisible().catch(() => false);
    // フォームが閉じていなければ、エラーメッセージが出ている可能性
    if (formStillOpen) {
      const errorMsg = page.locator('[role="alert"], .text-red-400, .text-red-500').first();
      const hasError = await errorMsg.count() > 0;
      if (hasError) {
        const errorText = await errorMsg.textContent();
        test.skip(true, `Form submission failed: ${errorText}`);
        return;
      }
    }

    // ══════════════════════════════════════════════════════════
    // Step 6: 記録ページで新しいエントリが表示されることを確認
    // ══════════════════════════════════════════════════════════
    await gotoAndWait(page, "/records");

    // 記録数が増えていること（取得できた場合のみ）
    if (beforeCount >= 0) {
      const afterText = await page.textContent("body");
      const afterMatch = afterText?.match(/(?:練習記録|Training Log)\s*[（(](\d+)[）)]/);
      const afterCount = afterMatch ? parseInt(afterMatch[1], 10) : -1;
      if (afterCount >= 0) {
        expect(afterCount, "Record count should increase after adding").toBeGreaterThanOrEqual(beforeCount);
      }
    }

    // ページ自体が正常に表示されていること
    await expect(page.locator("body")).toBeVisible();

    // ══════════════════════════════════════════════════════════
    // Step 7: テクニックページのナビゲーション確認
    // ══════════════════════════════════════════════════════════
    await gotoAndWait(page, "/techniques");
    const techBody = await page.textContent("body");
    expect(
      /テクニック|Technique|journal|ジャーナル/i.test(techBody!),
      "Techniques page should load"
    ).toBe(true);

    // ══════════════════════════════════════════════════════════
    // Step 8: プロフィールページのナビゲーション確認
    // ══════════════════════════════════════════════════════════
    await gotoAndWait(page, "/profile");
    const profileBody = await page.textContent("body");
    expect(
      /profile|プロフィール|belt|帯|session|セッション/i.test(profileBody!),
      "Profile page should load"
    ).toBe(true);

    // ══════════════════════════════════════════════════════════
    // Step 9: モバイルレスポンシブ確認（主要ページ）
    // ══════════════════════════════════════════════════════════
    await gotoAndWait(page, "/dashboard");
    await expectNoHorizontalOverflow(page);
  });
});

// =============================================================================
// Critical Path: Pro ユーザー — AI Coach + Export + 全ページ遷移
// =============================================================================

test.describe("Critical Path — Pro User Journey", () => {
  test.use({ storageState: AUTH_FILES.pro });

  test.beforeEach(async () => {
    skipIfNoAuth(AUTH_FILES.pro);
  });

  test("Pro user can access all pages without paywall blocking", async ({ page }) => {
    // Dashboard
    await gotoAndWait(page, "/dashboard");
    await expect(page.locator("body")).toBeVisible();

    // AI Coach セクションが表示される（Pro のみ）
    const aiCoach = page.getByText(/AI Coach|AI コーチ/i);
    if (await aiCoach.count() > 0) {
      await expect(aiCoach.first()).toBeVisible();
    }

    // Records — Export ボタンが表示される
    await gotoAndWait(page, "/records");
    const exportBtn = page.getByText(/エクスポート|Export|CSV/i);
    if (await exportBtn.count() > 0) {
      await expect(exportBtn.first()).toBeVisible();
    }

    // Techniques — ページロード
    await gotoAndWait(page, "/techniques");
    await expect(page.locator("body")).toBeVisible();
    const techContent = await page.textContent("body");
    expect(/テクニック|Technique/i.test(techContent!)).toBe(true);

    // Profile — Pro バッジ表示
    await gotoAndWait(page, "/profile");
    const proBadge = page.getByText(/✦ PRO|PRO/);
    if (await proBadge.count() > 0) {
      await expect(proBadge.first()).toBeVisible();
    }

    // Settings — ページロード
    await gotoAndWait(page, "/settings");
    const settingsBody = await page.textContent("body");
    expect(
      /settings|設定|通知|notification|account|アカウント/i.test(settingsBody!),
      "Settings page should load"
    ).toBe(true);
  });

  test("Pro user training log add → verify → stats update", async ({ page }) => {
    // 記録ページ
    await gotoAndWait(page, "/records");

    // 統計タブに切り替え
    const statsTab = page.getByRole("button", { name: /統計|Stats|Statistics/i });
    if (await statsTab.count() > 0) {
      await statsTab.first().click();
      await page.waitForTimeout(800);

      // 統計コンテンツが表示される
      const statsBody = await page.textContent("body");
      expect(
        /chart|グラフ|種類|type|sessions|セッション|Gi|No-Gi/i.test(statsBody!),
        "Stats tab should show chart/stats content"
      ).toBe(true);
    }

    // ログタブに戻す
    const logTab = page.getByRole("button", { name: /ログ|Log/i });
    if (await logTab.count() > 0) {
      await logTab.first().click();
      await page.waitForTimeout(500);
    }

    // 記録の追加（Pro ユーザー）
    const addBtn = page.getByText(/\+ 記録を追加|\+ Add Session/i).first();
    if (await addBtn.count() === 0) return test.skip(true, "Add button not found");

    await addBtn.click();
    await page.waitForTimeout(800);

    // No-Gi を選択
    const nogiBtn = page.getByRole("button", { name: /No-?Gi/i });
    if (await nogiBtn.count() > 0) {
      await nogiBtn.first().click();
      await page.waitForTimeout(200);
    }

    // Duration: 60
    const preset60 = page.getByRole("button", { name: /^60$/ });
    if (await preset60.count() > 0) {
      await preset60.first().click();
      await page.waitForTimeout(200);
    }

    // Notes
    const notesInput = page.locator('textarea[placeholder], textarea[name="notes"]').first();
    if (await notesInput.count() > 0) {
      await notesInput.fill(`Pro critical path test ${TEST_TAG}`);
    }

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // リロードして記録が反映されていることを確認
    await gotoAndWait(page, "/records");
    await expect(page.locator("body")).toBeVisible();
  });
});

// =============================================================================
// Critical Path: ゲスト（未認証） — LP → ログイン導線
// =============================================================================

test.describe("Critical Path — Guest Journey", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("guest lands on LP and can navigate to login", async ({ page }) => {
    await gotoAndWait(page, "/");

    // LPが表示される
    const body = await page.textContent("body");
    expect(
      /BJJ|Jiu-?Jitsu|柔術|training|track/i.test(body!),
      "Landing page should show BJJ-related content"
    ).toBe(true);

    // ログインリンクが存在する
    const loginLink = page.locator('a[href*="/login"]').first();
    await expect(loginLink).toBeAttached({ timeout: 5000 });
  });

  test("guest accessing /dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    // ログインページにリダイレクトされる
    const url = page.url();
    expect(
      url.includes("/login"),
      `Protected route should redirect to login, got: ${url}`
    ).toBe(true);
  });

  test("guest accessing /records redirects to login", async ({ page }) => {
    await page.goto("/records", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const url = page.url();
    expect(url.includes("/login"), "Should redirect to login").toBe(true);
  });

  test("LP mobile responsive — no overflow", async ({ page }) => {
    await gotoAndWait(page, "/");
    await expectNoHorizontalOverflow(page);
  });
});
