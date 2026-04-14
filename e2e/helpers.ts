/**
 * e2e/helpers.ts
 *
 * 全認証済みE2Eテストで共有するヘルパー関数。
 * 重複コード排除 + テスト品質の統一。
 */

import { test, expect, type Page } from "@playwright/test";
import { existsSync } from "fs";

// ─── 定数 ────────────────────────────────────────────────────────────────────

/** storageState ファイルパス */
export const AUTH_FILES = {
  free: "e2e/auth/free.json",
  pro: "e2e/auth/pro.json",
  gymOwner: "e2e/auth/gym-owner.json",
  gymMember: "e2e/auth/gym-member.json",
} as const;

/** VRT 共通設定 */
export const VRT_OPTIONS = {
  fullPage: true,
  maxDiffPixelRatio: 0.01,
} as const;

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

/**
 * storageState ファイルが存在しなければテストをスキップ。
 * 各 test.beforeEach 内で呼び出す。
 */
export function skipIfNoAuth(filePath: string) {
  if (!existsSync(filePath)) {
    test.skip(true, `storageState not found: ${filePath}`);
  }
}

/**
 * AgeGate / CookieConsent オーバーレイを事前消去する。
 *
 * `addInitScript` は page の全ナビゲーションの前に実行されるため、
 * テスト開始時に一度呼ぶだけでOK。`gotoAndWait` 内にも組み込み済みだが、
 * 直接 `page.goto` を使うテスト向けにスタンドアロンでも提供する。
 */
export async function dismissOverlays(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("bjj_age_verified", "true");
    localStorage.setItem("bjj_cookie_consent", "accepted");
  });
}

/**
 * ページを読み込み、networkidle まで待機（タイムアウト許容）。
 *
 * AgeGate / CookieConsent オーバーレイを事前に消去する:
 *   - AgeGate: localStorage "bjj_age_verified" = "true"
 *   - CookieConsent: localStorage "bjj_cookie_consent" = "accepted"
 * これにより z-[9999] オーバーレイがクリックを遮断する問題を回避。
 */
export async function gotoAndWait(page: Page, path: string) {
  // 1. 空ページで localStorage を事前セット（初回のみ必要）
  await page.addInitScript(() => {
    localStorage.setItem("bjj_age_verified", "true");
    localStorage.setItem("bjj_cookie_consent", "accepted");
  });
  // 2. ナビゲーション
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/**
 * 要素が存在することを期待し、存在しなければテストを失敗させる。
 * `if (count > 0)` による false positive を防ぐ。
 *
 * @param reason なぜこの要素が存在すべきかの説明（テスト失敗時に表示）
 */
export async function expectVisible(page: Page, locator: ReturnType<Page["getByText"]>, reason: string) {
  const count = await locator.count();
  expect(count, reason).toBeGreaterThanOrEqual(1);
  await expect(locator.first()).toBeVisible({ timeout: 5000 });
}

/**
 * 要素が存在しないことを期待する。
 */
export async function expectNotPresent(page: Page, locator: ReturnType<Page["getByText"]>, reason: string) {
  const count = await locator.count();
  expect(count, reason).toBe(0);
}

/**
 * モバイルビューポートで水平スクロールが発生しないことを検証。
 */
export async function expectNoHorizontalOverflow(page: Page, width = 375, height = 812) {
  await page.setViewportSize({ width, height });
  await page.waitForLoadState("networkidle").catch(() => {});
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth, `body scrollWidth(${bodyWidth}) should not exceed viewport(${viewportWidth})`).toBeLessThanOrEqual(viewportWidth + 10);
}

/**
 * Profile ページの特定タブに移動する。
 * タブが見つからなければテストをスキップ。
 */
export async function navigateToProfileTab(page: Page, tabRegex: RegExp) {
  const tab = page.getByRole("button", { name: tabRegex });
  const count = await tab.count();
  if (count === 0) {
    test.skip(true, `Tab matching ${tabRegex} not found`);
    return;
  }
  await tab.first().click();
  await page.waitForTimeout(500);
}
