import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 保護されたルートはログイン必須（/dashboardはゲストモードOKなので除外）
  // /admin: ページ側でも ADMIN_EMAIL チェックするが多層防御としてここでも認証要求
  const protectedPaths = ["/techniques", "/profile", "/gym/dashboard", "/admin"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  // ログイン済みならログインページをスキップ
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // §21 Observability: レスポンスタイム計測ヘッダー（p95監視用）
  supabaseResponse.headers.set("X-Response-Time", `${Date.now() - startTime}ms`);
  supabaseResponse.headers.set("Server-Timing", `middleware;dur=${Date.now() - startTime}`);
  return supabaseResponse;
}

export const config = {
  // Why(Vercel Fluid Active CPU 削減): 旧 matcher は全リクエスト(公開SEOページ
  // /, /pricing, /compare, /tour, /changelog, /help, /legal/* 等)で走り、
  // クローラー巡回のたびに supabase.auth.getUser()(Supabase へのネットワーク往復
  // = Node CPU)を無駄に発火させ無料枠を浪費していた。
  // middleware が実際に必要なのは (a)未認証 redirect する保護ルート、
  // (b)認証済→/dashboard へ飛ばす /login、(c)セッショントークン refresh が要る
  // 認証エリアのみ。公開ページは認証不要なので除外して getUser() を起こさない。
  // セキュリティヘッダーは next.config.ts の headers() が全ルートに付与するため
  // ここを絞っても影響しない。
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/records/:path*",
    "/settings/:path*",
    "/techniques/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/gym/dashboard/:path*",
    "/invite/:path*",
    "/account-deleted",
    "/unsubscribe",
  ],
};
