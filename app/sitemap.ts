import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

const VALID_LANGS = ["en", "ja", "pt"] as const;

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

  // Wiki インデックスページ（言語別）
  for (const lang of VALID_LANGS) {
    entries.push({
      url: `${BASE_URL}/wiki/${lang}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Wiki 記事ページ（Supabase から取得）
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("wiki_translations")
      .select("language_code, updated_at, wiki_pages!inner(slug)")
      .in("language_code", [...VALID_LANGS])
      .limit(20000);

    if (!error && data) {
      for (const row of data) {
        const wp = row.wiki_pages as
          | { slug: string }
          | { slug: string }[]
          | null;
        const slug = Array.isArray(wp) ? wp[0]?.slug : wp?.slug;
        if (!slug) continue;

        const lastModified = row.updated_at
          ? new Date(row.updated_at)
          : undefined;

        entries.push({
          url: `${BASE_URL}/wiki/${row.language_code}/${slug}`,
          lastModified,
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }
  } catch {
    // Supabase 取得失敗時は静的エントリのみ返す
  }

  return entries;
}
