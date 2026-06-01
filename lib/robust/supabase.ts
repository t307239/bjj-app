// ROBUST 専用 Supabase クライアント
// gym-member-hub プロジェクト（bjj-app とは別）に接続する
import { createBrowserClient } from "@supabase/ssr";
import { createClient as createServerClientBase } from "@supabase/supabase-js";

const ROBUST_URL      = process.env.NEXT_PUBLIC_ROBUST_SUPABASE_URL!;
const ROBUST_ANON_KEY = process.env.NEXT_PUBLIC_ROBUST_SUPABASE_ANON_KEY!;
const ROBUST_SERVICE_KEY = process.env.ROBUST_SUPABASE_SERVICE_ROLE_KEY!;

/** クライアントサイド用 */
export function createRobustClient() {
  return createBrowserClient(ROBUST_URL, ROBUST_ANON_KEY);
}

/** サーバーサイド用（API routes / Server Components） */
export function createRobustServerClient() {
  return createServerClientBase(ROBUST_URL, ROBUST_ANON_KEY);
}

/** サービスロール用（webhook など RLS をバイパスする必要がある箇所のみ） */
export function createRobustAdminClient() {
  // auth: webhook — Stripe署名検証で代替
  return createServerClientBase(ROBUST_URL, ROBUST_SERVICE_KEY);
}
