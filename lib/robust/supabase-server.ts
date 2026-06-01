// ROBUST サーバー専用 Supabase クライアント
// API Routes / Server Components からのみインポート可
// Why: "next/headers" の cookies() はサーバーサイドのみで動作するため、
//      Client Component と同一ファイルに置けない
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ROBUST_URL, ROBUST_ANON_KEY } from "./supabase";

/**
 * cookie-aware サーバーサイドクライアント
 * auth.getUser() がリクエストのセッションクッキーを正しく読み取れる
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
