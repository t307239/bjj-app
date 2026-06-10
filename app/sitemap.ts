import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

export const revalidate = 3600;

// ─────────────────────────────────────────
// 動的サイトマップ生成
// ─────────────────────────────────────────

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // z260i: 全 static entry に lastModified を統一で付与
  // 旧: root のみ lastModified、他 11 entry は missing → Google sitemap 監査で
  // 「lastmod missing」warning + freshness signal 弱体化。
  // Deploy 時刻を全 entry に共有 (cron revalidate=3600 で 1h 単位で更新)
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/gym`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/help`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // z206: z184 (/pricing) / z203 (/changelog) 追加時の sitemap 漏れ修正
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,  // conversion page、優先度高
    },
    {
      url: `${BASE_URL}/changelog`,
      lastModified: now,
      changeFrequency: "weekly",  // 月初更新方針 (z203 commit msg)
      priority: 0.8,  // indie 活発さ証明、SEO 寄与あり
    },
    {
      url: `${BASE_URL}/tour`,
      lastModified: now,
      changeFrequency: "monthly",  // 機能追加時のみ更新
      priority: 0.9,  // signup 前 conversion gateway、優先度高 (z213)
    },
    {
      url: `${BASE_URL}/compare`,
      lastModified: now,
      changeFrequency: "monthly",  // 競合比較は数月ごと更新
      priority: 0.8,  // SEO「bjj app vs」捕捉 (z221)
    },
    // z255dd: /legal/dpa は robots: { index: true, follow: true } で indexable な
    // GDPR DPA page だが sitemap 漏れていた orphan を fix
    {
      url: `${BASE_URL}/legal/dpa`,
      lastModified: now,
      changeFrequency: "yearly",  // legal text、年単位で更新
      priority: 0.3,  // compliance 用 page、SEO 重要度低
    },
    // z255oo: /contact お問い合わせ / バグ報告 form
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    // terms, privacy, tokushoho は robots noindex のためサイトマップから除外
  ];

  // Why: bjj-app.net/wiki/* は静的 wiki.bjj-app.net と同一内容のクロスドメイン重複。
  //      各ページの canonical を静的サイトへ向けて SEO 信号を集約したため、
  //      非 canonical な bjj-app 側 wiki URL は sitemap に載せない。
  //      旧実装は Supabase から最大 20,000 記事 URL を advertise し、Google の
  //      「discovered/crawled-not-indexed」を 771+ 件発生させていた（クロール予算の浪費）。
  //      Wiki の SEO sitemap は wiki.bjj-app.net 側で別途提供される。

  return entries;
}
