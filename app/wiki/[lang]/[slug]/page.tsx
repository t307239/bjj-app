import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────

const VALID_LANGS = ["en", "ja", "pt"] as const;
type Lang = (typeof VALID_LANGS)[number];

interface PageParams {
  lang: string;
  slug: string;
}

// ─────────────────────────────────────────
// データ取得ヘルパー
// ─────────────────────────────────────────

async function getWikiPage(lang: string, slug: string) {
  const supabase = await createClient();

  // Step 1: slug → page_id を解決
  const { data: pageData, error: pageError } = await supabase
    .from("wiki_pages")
    .select("id")
    .eq("slug", slug)
    .single();

  if (pageError || !pageData) return null;

  // Step 2: 該当言語の翻訳を取得
  const { data, error } = await supabase
    .from("wiki_translations")
    .select("title, description, content_html")
    .eq("page_id", pageData.id)
    .eq("language_code", lang)
    .single();

  if (error || !data) return null;
  return data;
}

// ─────────────────────────────────────────
// generateMetadata
// ─────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { lang, slug } = await params;

  if (!VALID_LANGS.includes(lang as Lang)) {
    return { title: "Not Found" };
  }

  const page = await getWikiPage(lang, slug);

  if (!page) {
    return { title: "Not Found" };
  }

  const title = page.title;
  const description = page.description ?? "";
  const canonicalUrl = `https://wiki.bjj-app.net/${lang}/${slug}.html`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      siteName: "BJJ Wiki",
      locale: lang === "ja" ? "ja_JP" : lang === "pt" ? "pt_BR" : "en_US",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

// ─────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────

export default async function WikiPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { lang, slug } = await params;

  // 言語バリデーション
  if (!VALID_LANGS.includes(lang as Lang)) {
    notFound();
  }

  const page = await getWikiPage(lang, slug);

  if (!page) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ナビゲーションヘッダー */}
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center gap-4">
          <a
            href={`https://wiki.bjj-app.net/${lang}/`}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ← BJJ Wiki
          </a>
          <span className="text-zinc-600">/</span>
          <span className="text-sm text-zinc-300 truncate">{page.title}</span>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="mx-auto max-w-4xl px-4 py-10">
        <article>
          <h1 className="mb-6 text-3xl font-bold text-white sm:text-4xl">
            {page.title}
          </h1>

          {page.description && (
            <p className="mb-8 text-lg text-zinc-400 leading-relaxed border-l-4 border-blue-500 pl-4">
              {page.description}
            </p>
          )}

          {/* Wiki コンテンツ — prose スタイルで HTML をレンダリング */}
          <div
            className="
              prose prose-invert prose-zinc max-w-none
              prose-headings:text-white prose-headings:font-bold
              prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:mb-4
              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:text-blue-300 hover:prose-a:underline
              prose-strong:text-white prose-strong:font-semibold
              prose-ul:text-zinc-300 prose-ol:text-zinc-300
              prose-li:my-1
              prose-img:rounded-lg prose-img:my-6
              prose-hr:border-zinc-700
              prose-blockquote:border-zinc-600 prose-blockquote:text-zinc-400
              prose-code:text-blue-300 prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded
              prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700
              prose-table:text-zinc-300
              prose-th:text-zinc-200 prose-th:border-zinc-700
              prose-td:border-zinc-700
            "
            dangerouslySetInnerHTML={{ __html: page.content_html ?? "" }}
          />
        </article>
      </main>

      {/* フッター */}
      <footer className="mt-16 border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-4xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <p>© {new Date().getFullYear()} BJJ Wiki — All rights reserved.</p>
          <a
            href="https://bjj-app.net"
            className="hover:text-zinc-300 transition-colors"
          >
            BJJ App →
          </a>
        </div>
      </footer>
    </div>
  );
}
