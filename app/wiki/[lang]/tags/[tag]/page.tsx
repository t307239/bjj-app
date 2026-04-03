import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const revalidate = 3600;

const VALID_LANGS = ["en", "ja", "pt"] as const;
type Lang = (typeof VALID_LANGS)[number];

interface TagPageParams {
  lang: string;
  tag: string;
}

// ─────────────────────────────────────────
// データ取得
// ─────────────────────────────────────────

async function getArticlesByTag(lang: string, tag: string) {
  const supabase = await createClient();

  // tags はスラグ形式（hyphens）で受け取るので空白に変換してilike検索
  const searchTerm = decodeURIComponent(tag).replace(/-/g, " ").trim();

  const { data, error } = await supabase
    .from("wiki_translations")
    .select("title, description, content_type, wiki_pages!inner(slug)")
    .eq("language_code", lang)
    .ilike("title", `%${searchTerm}%`)
    .limit(30);

  if (error || !data) return [];

  return data
    .map((row) => {
      const wp = row.wiki_pages as { slug: string } | { slug: string }[] | null;
      const slug = Array.isArray(wp) ? wp[0]?.slug : wp?.slug;
      return slug
        ? {
            title: row.title,
            description: row.description,
            contentType: row.content_type,
            slug,
          }
        : null;
    })
    .filter(
      (
        item
      ): item is {
        title: string;
        description: string | null;
        contentType: string | null;
        slug: string;
      } => item !== null
    );
}

// ─────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<TagPageParams>;
}): Promise<Metadata> {
  const { lang, tag } = await params;
  const displayTag = decodeURIComponent(tag).replace(/-/g, " ");
  return {
    title: `${displayTag} | BJJ Wiki`,
    description: `BJJ Wiki articles about ${displayTag}`,
    alternates: {
      languages: {
        en: `https://bjj-app.net/wiki/en/tags/${tag}`,
        ja: `https://bjj-app.net/wiki/ja/tags/${tag}`,
        pt: `https://bjj-app.net/wiki/pt/tags/${tag}`,
      },
    },
  };
}

// ─────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────

export default async function TagArchivePage({
  params,
}: {
  params: Promise<TagPageParams>;
}) {
  const { lang, tag } = await params;

  if (!VALID_LANGS.includes(lang as Lang)) notFound();

  const articles = await getArticlesByTag(lang, tag);
  const displayTag = decodeURIComponent(tag).replace(/-/g, " ");

  const labels: Record<Lang, { back: string; empty: string; articleCount: string }> = {
    en: { back: "BJJ Wiki", empty: "No articles found for this topic.", articleCount: "articles" },
    ja: { back: "BJJ Wiki", empty: "このトピックの記事が見つかりません。", articleCount: "記事" },
    pt: { back: "BJJ Wiki", empty: "Nenhum artigo encontrado para este tópico.", articleCount: "artigos" },
  };
  const l = labels[lang as Lang] ?? labels.en;

  return (
    <div className="min-h-[100dvh] bg-[#0f172a] text-white">
      {/* Sticky header / breadcrumb */}
      <header className="border-b border-white/10 bg-[#0f172a]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-2 text-sm">
          <Link
            href={`/wiki/${lang}`}
            className="text-slate-400 hover:text-white transition-colors"
          >
            {l.back}
          </Link>
          <span className="text-slate-500">/</span>
          <span className="text-pink-400 font-medium capitalize">{displayTag}</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10">
        {/* Page title */}
        <h1 className="text-3xl font-bold text-white mb-1 capitalize tracking-tight">
          {displayTag}
        </h1>
        <p className="text-slate-500 text-sm mb-8">
          {articles.length} {l.articleCount}
        </p>

        {/* Lang switcher */}
        <div className="inline-flex items-center bg-white/5 rounded-full p-1 gap-0.5 mb-8 border border-white/10">
          {VALID_LANGS.map((l) => (
            <Link
              key={l}
              href={`/wiki/${l}/tags/${tag}`}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                l === lang
                  ? "bg-slate-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {l.toUpperCase()}
            </Link>
          ))}
        </div>

        {/* Article grid */}
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🥋</div>
            <p className="text-slate-500">{l.empty}</p>
            <Link
              href={`/wiki/${lang}`}
              className="mt-6 inline-flex items-center gap-2 text-sm text-pink-400 hover:text-pink-300 transition-colors"
            >
              ← Browse all articles
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a) => (
              <Link
                key={a.slug}
                href={`/wiki/${lang}/${a.slug}`}
                className="group rounded-xl border border-white/10 bg-white/5 px-5 py-4 hover:border-white/20 hover:bg-white/[0.07] hover:-translate-y-0.5 transition-all duration-150"
              >
                <h2 className="text-sm font-semibold text-slate-200 group-hover:text-white line-clamp-2 transition-colors leading-snug mb-2">
                  {a.title}
                </h2>
                {a.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {a.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 mt-8">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p suppressHydrationWarning>© {new Date().getFullYear()} BJJ Wiki — All rights reserved.</p>
          <a href="https://bjj-app.net" className="hover:text-slate-400 transition-colors">
            BJJ App →
          </a>
        </div>
      </footer>
    </div>
  );
}
