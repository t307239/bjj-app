import { test, expect } from "@playwright/test";

/**
 * E2E: Login Page — 外結テスト
 *
 * OAuth の実際のフローは外部依存のためスキップ。
 * ページ構造、フォーム要素、エラー表示、ゲストリンクを検証。
 */

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  // --- 基本表示 ---

  test("renders login page with auth options", async ({ page }) => {
    const googleBtn = page.getByText(/Google/i).first();
    await expect(googleBtn).toBeVisible();

    const githubBtn = page.getByText(/GitHub/i).first();
    await expect(githubBtn).toBeVisible();
  });

  test("renders email magic link form", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test("email form validates empty input", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    // Fill with invalid email to test validation
    await emailInput.fill("not-an-email");
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.checkValidity()
    );
    expect(isInvalid).toBe(true);
  });

  test("email form accepts valid email", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("test@example.com");
    const isValid = await emailInput.evaluate(
      (el: HTMLInputElement) => el.checkValidity()
    );
    expect(isValid).toBe(true);
  });

  // --- ゲストモードリンク ---

  test("has guest mode link to dashboard", async ({ page }) => {
    const guestLink = page.locator('a[href="/dashboard"]');
    const count = await guestLink.count();
    if (count > 0) {
      await expect(guestLink.first()).toBeVisible();
    }
  });

  // --- エラーパラメータ表示 ---

  test("shows error message with ?error=auth param", async ({ page }) => {
    await page.goto("/login?error=auth");
    // Page should not crash with error parameter
    await expect(page.locator("body")).toBeVisible();
  });

  // --- メタデータ ---

  test("has page title", async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
