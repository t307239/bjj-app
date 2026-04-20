import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E テスト設定
 *
 * 実行方法:
 *   npx playwright test              # 全テスト
 *   npx playwright test --ui         # UIモード
 *   npx playwright test --headed     # ブラウザ表示
 *   npx playwright test e2e/lp.spec.ts  # 特定ファイル
 *
 * 権限マトリックステスト:
 *   npx playwright test e2e/roles-matrix.spec.ts           # 全プロジェクト
 *   npx playwright test e2e/roles-matrix.spec.ts --project=free-user
 *
 * storageState セットアップ:
 *   globalSetup (e2e/auth.setup.ts) が自動で e2e/auth/*.json を生成する。
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY が必要。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: "html",
  timeout: 60_000,

  /* auth.setup.ts で storageState JSON を自動生成 */
  globalSetup: "./e2e/auth.setup.ts",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // ── ゲスト（認証なし）── デフォルトテスト用
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
      // 認証必須のspecはゲストで実行しない
      testIgnore: /dashboard-auth|records-auth|profile-auth|pro-features|techniques-auth|skillmap|settings|critical-path\.spec/,
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        storageState: { cookies: [], origins: [] },
      },
      testIgnore: /dashboard-auth|records-auth|profile-auth|pro-features|techniques-auth|skillmap|settings|critical-path\.spec/,
    },

    // ── 認証済み権限マトリックス用プロジェクト ──────────────────────────────
    // auth.setup.ts が生成した storageState を使う。
    // JSON が存在しない場合（setup 失敗時など）は Playwright がエラーを出す。
    {
      name: "free-user",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/auth/free.json",
      },
      // 認証済みテストファイルのみ実行
      testMatch: /roles-matrix\.spec\.ts|dashboard-auth\.spec\.ts|records-auth\.spec\.ts|profile-auth\.spec\.ts|pro-features\.spec\.ts|techniques-auth\.spec\.ts|skillmap\.spec\.ts|settings\.spec\.ts|critical-path\.spec\.ts/,
    },
    {
      name: "pro-user",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/auth/pro.json",
      },
      testMatch: /roles-matrix\.spec\.ts|dashboard-auth\.spec\.ts|records-auth\.spec\.ts|profile-auth\.spec\.ts|pro-features\.spec\.ts|techniques-auth\.spec\.ts|skillmap\.spec\.ts|settings\.spec\.ts|critical-path\.spec\.ts/,
    },
    {
      name: "gym-owner",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/auth/gym-owner.json",
      },
      testMatch: /roles-matrix\.spec\.ts|pro-features\.spec\.ts/,
    },
    {
      name: "gym-member",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/auth/gym-member.json",
      },
      testMatch: /roles-matrix\.spec\.ts|pro-features\.spec\.ts/,
    },
  ],

  /* Dev server auto-start (comment out if testing against production) */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
