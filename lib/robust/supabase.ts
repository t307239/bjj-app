// ROBUST 専用 Supabase クライアント
// gym-member-hub プロジェクト（bjj-app とは別）に接続する
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient as createServerClientBase } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const ROBUST_URL      = process.env.NEXT_PUBLIC_ROBUST_SUPABASE_URL!;
const ROBUST_ANON_KEY = process.env.NEXT_PUBLIC_ROBUST_SUPABASE_ANON_KEY!;
const ROBUST_SERVICE_KEY = process.env.ROBUST_SUPABASE_SERVICE_ROLE_KEY!;

/** クライアントサイド用 */
export function createRobustClient() {
  return createBrowserClient(ROBUST_URL, ROBUST_ANON_KEY);
}

/**
 * サーバーサイド用（API routes / Server Components）
 * Why: cookie-aware にすることで auth.getUser() がリクエストの
 *      セッションクッキーを読み取れる（@supabase/ssr パターン）
 */
export async function createRobustServerClient() {
  const cookieStore = await cookies();
  return createServerClient(ROBUST_URL, ROBUST_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        } catch {
          // silent: ok — Server Component では set 不可、無視
        }
      },
    },
  });
}

/** サーバーサイド用（後方互換 alias） */
export async function createRobustServerClientSync() {
  return createRobustServerClient();
}

/** サービスロール用（webhook など RLS をバイパスする必要がある箇所のみ） */
export function createRobustAdminClient() {
  // auth: webhook — Stripe署名検証で代替
  return createServerClientBase(ROBUST_URL, ROBUST_SERVICE_KEY);
}
