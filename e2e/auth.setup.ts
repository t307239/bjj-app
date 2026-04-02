/**
 * e2e/auth.setup.ts
 *
 * Playwright globalSetup — 権限マトリックステスト用 storageState 自動生成。
 *
 * 処理内容:
 *   1. Supabase Admin API でテストユーザーを作成（存在しない場合のみ）
 *   2. Admin.generateLink() でマジックリンクを取得（メール送信なし）
 *   3. Playwright でリンクを踏んでセッション確立 → e2e/auth/*.json に保存
 *   4. Pro / GymOwner / GymMember の追加プロフィール設定
 *
 * 必要な環境変数 (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * 任意 (.env.local または CI secrets):
 *   E2E_FREE_EMAIL=e2e-free@test.bjj-app.net
 *   E2E_PRO_EMAIL=e2e-pro@test.bjj-app.net
 *   E2E_GYM_OWNER_EMAIL=e2e-gym-owner@test.bjj-app.net
 *   E2E_GYM_MEMBER_EMAIL=e2e-gym-member@test.bjj-app.net
 */

import { chromium, type FullConfig } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────
// .env.local 手動ロード（globalSetup は Next.js ランタイム外で動く）
// ─────────────────────────────────────────────────────────────────
function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}
loadEnvLocal();

// ─────────────────────────────────────────────────────────────────
// テストアカウント設定
// ─────────────────────────────────────────────────────────────────
const TEST_ACCOUNTS = {
  free:        process.env.E2E_FREE_EMAIL        ?? "e2e-free@test.bjj-app.net",
  pro:         process.env.E2E_PRO_EMAIL         ?? "e2e-pro@test.bjj-app.net",
  "gym-owner": process.env.E2E_GYM_OWNER_EMAIL   ?? "e2e-gymowner@test.bjj-app.net",
  "gym-member":process.env.E2E_GYM_MEMBER_EMAIL  ?? "e2e-gymmember@test.bjj-app.net",
} as const;

type Role = keyof typeof TEST_ACCOUNTS;

const TEST_GYM_NAME = "E2E Test Dojo";

// ─────────────────────────────────────────────────────────────────
// ユーザー確保（存在すれば取得、なければ作成）
// ─────────────────────────────────────────────────────────────────
async function ensureUser(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  // listUsers でメールアドレス検索
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);

  const existing = data.users.find((u) => u.email === email);
  if (existing) {
    console.log(`  └ user exists: ${email} (${existing.id})`);
    return existing.id;
  }

  // 新規作成
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { test_account: true },
  });
  if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
  console.log(`  └ user created: ${email} (${created.user.id})`);
  return created.user.id;
}

// ─────────────────────────────────────────────────────────────────
// ロール別プロフィール設定
// ─────────────────────────────────────────────────────────────────
async function configureRole(
  admin: SupabaseClient,
  userId: string,
  role: Role,
): Promise<void> {
  if (role === "pro") {
    const { error } = await admin
      .from("profiles")
      .update({ is_pro: true, stripe_customer_id: "cus_e2e_test_pro" })
      .eq("id", userId);
    if (error) console.warn(`  ⚠️  profiles update (pro): ${error.message}`);
    else console.log(`  └ is_pro=true set`);
  }

  if (role === "gym-owner") {
    // テスト道場を取得 or 作成
    const gymId = await ensureTestGym(admin, userId);
    const { error } = await admin
      .from("profiles")
      .update({ is_gym_owner: true, gym_id: gymId })
      .eq("id", userId);
    if (error) console.warn(`  ⚠️  profiles update (gym-owner): ${error.message}`);
    else console.log(`  └ is_gym_owner=true, gym_id=${gymId} set`);
  }

  if (role === "gym-member") {
    // テスト道場を検索して gym_id をセット（道場長が先に作成済みの想定）
    const { data: gyms } = await admin
      .from("gyms")
      .select("id")
      .eq("name", TEST_GYM_NAME)
      .eq("is_active", true)
      .limit(1);
    if (gyms && gyms.length > 0) {
      const { error } = await admin
        .from("profiles")
        .update({ gym_id: gyms[0].id, is_gym_owner: false })
        .eq("id", userId);
      if (error) console.warn(`  ⚠️  profiles update (gym-member): ${error.message}`);
      else console.log(`  └ gym_id=${gyms[0].id} set (gym-member)`);
    } else {
      console.warn(`  ⚠️  テスト道場が見つからず gym-member の gym_id 未設定`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// テスト道場の確保
// ─────────────────────────────────────────────────────────────────
async function ensureTestGym(
  admin: SupabaseClient,
  ownerId: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("gyms")
    .select("id")
    .eq("name", TEST_GYM_NAME)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`  └ gym exists: ${existing[0].id}`);
    return existing[0].id;
  }

  const { data: created, error } = await admin
    .from("gyms")
    .insert({
      name: TEST_GYM_NAME,
      owner_id: ownerId,
      invite_code: `e2e-${Date.now()}`,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`gym insert failed: ${error.message}`);
  console.log(`  └ gym created: ${created.id}`);
  return created.id;
}

// ─────────────────────────────────────────────────────────────────
// マジックリンク発行 → ブラウザでセッション確立 → storageState 保存
//
// Supabase プロジェクトが Implicit Flow（OTP/magiclink が
// #access_token=... 形式でリダイレクト）を使っている場合、
// サーバーサイドの /auth/callback は hash fragment を読めないため
// PKCE exchangeCode はスキップされる。
//
// 対策: ハッシュからトークンを抽出 → context.addCookies() で
// @supabase/ssr が期待する sb-{projectRef}-auth-token を注入する。
// ─────────────────────────────────────────────────────────────────
async function captureSession(
  admin: SupabaseClient,
  email: string,
  role: Role,
  authDir: string,
  baseURL: string,
): Promise<boolean> {
  const outputPath = path.join(authDir, `${role}.json`);

  // マジックリンク生成（メール送信なし — Admin API 使用）
  // redirectTo はアクセス可能なページならどこでも良い。
  // Implicit flow: Supabase が #access_token=... をハッシュに付けてリダイレクト。
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseURL}/dashboard` },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error(`  ❌ generateLink failed: ${linkErr?.message}`);
    return false;
  }

  const magicLink = linkData.properties.action_link;

  // Playwright でマジックリンクを踏んでトークンを取得
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    // ページロードを待つ（URL は問わない）
    await page.goto(magicLink, { waitUntil: "load", timeout: 30_000 });
    // Supabase JS クライアントがハッシュを処理する時間を確保
    await page.waitForTimeout(1500);

    const currentUrl = page.url();
    console.log(`  └ redirected to: ${currentUrl.split("#")[0]}`);

    // ── ハッシュからトークンを抽出 ───────────────────────────────
    const hashPart = currentUrl.includes("#") ? currentUrl.split("#")[1] : "";
    const hashParams = new URLSearchParams(hashPart);
    const accessToken  = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const expiresIn    = parseInt(hashParams.get("expires_in") ?? "3600", 10);
    const expiresAt    = parseInt(
      hashParams.get("expires_at") ?? String(Math.floor(Date.now() / 1000) + expiresIn),
      10,
    );

    if (!accessToken || !refreshToken) {
      console.error(
        `  ❌ トークンがハッシュに見つかりません。\n` +
        `     URL: ${currentUrl}\n` +
        `     Supabase プロジェクトの Auth 設定で「Implicit flow」が有効になっているか確認してください。`,
      );
      return false;
    }

    // ── JWT ペイロードからユーザーIDを取得 ──────────────────────
    let userId: string;
    try {
      const payload = JSON.parse(
        Buffer.from(accessToken.split(".")[1], "base64url").toString("utf-8"),
      );
      userId = payload.sub as string;
    } catch {
      console.error(`  ❌ JWT パース失敗`);
      return false;
    }

    // ── Admin API でユーザー情報を取得 ──────────────────────────
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
    if (userErr || !userData?.user) {
      console.error(`  ❌ getUserById failed: ${userErr?.message}`);
      return false;
    }

    // ── @supabase/ssr が期待するセッション JSON を構築 ──────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const projectRef  = new URL(supabaseUrl).hostname.split(".")[0]; // "ryevkjaoppyibkjijfjk"
    const cookieName  = `sb-${projectRef}-auth-token`;

    const sessionPayload = {
      access_token:  accessToken,
      token_type:    "bearer",
      expires_in:    expiresIn,
      expires_at:    expiresAt,
      refresh_token: refreshToken,
      user:          userData.user,
    };

    // ── Cookie を注入 ────────────────────────────────────────────
    await context.addCookies([
      {
        name:     cookieName,
        value:    encodeURIComponent(JSON.stringify(sessionPayload)),
        domain:   "localhost",
        path:     "/",
        httpOnly: false,
        secure:   false,
        sameSite: "Lax",
        expires:  expiresAt,
      },
    ]);
    console.log(`  └ cookie injected: ${cookieName}`);

    // ── セッション動作確認: /dashboard へ遷移 ──────────────────
    await page.goto(`${baseURL}/dashboard`, { timeout: 15_000 });
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // ── storageState 保存 ────────────────────────────────────────
    await context.storageState({ path: outputPath });
    console.log(`  └ ✅ storageState saved → ${outputPath}`);
    return true;
  } catch (err) {
    console.error(`  ❌ session capture failed: ${err}`);
    try { console.error(`  └ current URL: ${page.url()}`); } catch {}
    return false;
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────
// グローバルセットアップ エントリーポイント
// ─────────────────────────────────────────────────────────────────
async function globalSetup(config: FullConfig): Promise<void> {
  const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "⚠️  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定のため " +
      "auth setup をスキップします（認証済みテストは .skip 扱い）"
    );
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authDir = path.join(process.cwd(), "e2e", "auth");
  fs.mkdirSync(authDir, { recursive: true });

  // baseURL は playwright.config.ts の use.baseURL を参照
  const baseURL =
    (config.projects[0]?.use as { baseURL?: string })?.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://localhost:3000";

  const roles: Role[] = ["free", "pro", "gym-owner", "gym-member"];

  for (const role of roles) {
    const email = TEST_ACCOUNTS[role];
    console.log(`\n📦 [${role}] ${email}`);

    try {
      const userId = await ensureUser(admin, email);
      await configureRole(admin, userId, role);
      await captureSession(admin, email, role, authDir, baseURL);
    } catch (err) {
      console.error(`  ❌ setup failed for [${role}]:`, err);
      // 個別ロールの失敗は全体を止めない
    }
  }

  console.log("\n✅ auth setup complete\n");
}

export default globalSetup;
