/**
 * lib/env.ts — サーバー側の環境変数バリデーション
 *
 * NEXT_PUBLIC_* 変数はビルド時に埋め込まれるため ! assertion で問題ない。
 * サーバー専用シークレット（STRIPE_SECRET_KEY 等）は実行時に欠けると
 * 暗号的な 500 クラッシュを起こすため、このモジュールで明示的に検証する。
 *
 * 使い方:
 *   import { requireServerEnv } from "@/lib/env";
 *   const key = requireServerEnv("STRIPE_SECRET_KEY");
 */

/**
 * 指定された環境変数を取得する。値が存在しない場合は明確なエラーメッセージで throw する。
 * 本番で「undefined is not a function」系の暗号エラーを防ぐ。
 */
export function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] Missing required server environment variable: "${name}". ` +
      `Check Vercel dashboard → Settings → Environment Variables.`
    );
  }
  return value;
}

/**
 * よく使うシークレットのショートカット。
 * 呼び出し時に値を評価する（関数にしているのは import サイクル回避 + モジュール評価タイミング制御のため）
 */
export const serverEnv = {
  supabaseServiceRoleKey: () => requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  stripeSecretKey:        () => requireServerEnv("STRIPE_SECRET_KEY"),
  stripeWebhookSecret:    () => requireServerEnv("STRIPE_WEBHOOK_SECRET"),
  vapidPrivateKey:        () => requireServerEnv("VAPID_PRIVATE_KEY"),
  adminEmail:             () => process.env.ADMIN_EMAIL ?? "",
} as const;
