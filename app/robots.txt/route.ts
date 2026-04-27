import { NextResponse } from "next/server";

/**
 * Dynamic robots.txt — z212 で public/robots.txt を撤廃し dynamic 一本化。
 *
 * 設計 (z212):
 *   - /api/ は public/robots.txt にあったが dynamic 側に欠落していた = crawl
 *     可能な状態だった → 復元 (real bug fix)。
 *   - 既存 /dashboard /techniques /profile /auth に追加で /admin /settings
 *     /records /gym /invite /unsubscribe /account-deleted を明示 disallow
 *     (auth 必須 / token 必須 / post-action page で indexing 価値なし)
 *   - sitemap.ts と整合する形で「公開対象」のみ Allow として残る
 *
 * 注意: privacy / terms / legal は indexing したい (法的開示 page) のでここに
 * 載せない。sitemap.ts の旧コメント「robots noindex」は実装と齟齬のため
 * 参考情報として無視。実際の robots 動作はこの file が source of truth。
 */
export async function GET() {
  const content = `User-agent: *
Disallow: /api/
Disallow: /auth
Disallow: /dashboard
Disallow: /techniques
Disallow: /profile
Disallow: /admin
Disallow: /settings
Disallow: /records
Disallow: /gym
Disallow: /invite
Disallow: /unsubscribe
Disallow: /account-deleted
Allow: /

Sitemap: ${process.env.NEXT_PUBLIC_SITE_URL || "https://bjj-app.net"}/sitemap.xml
`;
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain" },
  });
}
