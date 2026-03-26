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
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/login`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  // Wiki インデックスページ（言語別）
  for (const lang of VALID_LANGS) {
    entries.push({
      url: `${BASE_URL}/wiki/${lang}`,
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
