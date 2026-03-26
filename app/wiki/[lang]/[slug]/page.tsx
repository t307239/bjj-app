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
// content_type バッジ設定
// ─────────────────────────────────────────

type ContentType =
  | "Technique"
  | "Concept_Strategy"
  | "Rule"
  | "Athlete_Bio"
  | "Equipment_Gear"
  | "Conditioning_Nutrition"
  | "Drill";

const BADGE_CONFIG: Record<
  ContentType,
  { label: string; className: string; emoji: string }
> = {
  Technique: {
    label: "Technique",
    emoji: "🥋",
    className: "bg-blue-900/50 text-blue-300 border border-blue-700",
  },
  Concept_Strategy: {
    label: "Concept & Strategy",
    emoji: "🧠",
    className: "bg-violet-900/50 text-violet-300 border border-violet-700",
  },
  Rule: {
    label: "Rules",
    emoji: "📋",
    className: "bg-amber-900/50 text-amber-300 border border-amber-700",
  },
  Athlete_Bio: {
    label: "Athlete Bio",
    emoji: "🏆",
    className: "bg-rose-900/50 text-rose-300 border border-rose-700",
  },
  Equipment_Gear: {
    label: "Equipment & Gear",
    emoji: "🛒",
    className: "bg-orange-900/50 text-orange-300 border border-orange-700",
  },
  Conditioning_Nutrition: {
    label: "Conditioning & Nutrition",
    emoji: "💪",
    className: "bg-green-900/50 text-green-300 border border-green-700",
  },
  Drill: {
    label: "Drill",
    emoji: "🔁",
    className: "bg-teal-900/50 text-teal-300 border border-teal-700",
  },
};

function ContentTypeBadge({ contentType }: { contentType: string | null }) {
  if (!contentType) return null;
  const cfg = BADGE_CONFIG[contentType as ContentType];
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cfg.className}`}
    >
      <span>{cfg.emoji}</span>
      {cfg.label}
    </span>
  );
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

  // Step 2: 該当言語の翻訳を取得（content_type 追加）
  const { data, error } = await supabase
    .from("wiki_translations")
    .select("title, description, content_html, content_type")
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
  const canonicalUrl = `https://bjj-app.net/wiki/${lang}/${slug}`;

  return {
    title: `${title} | BJJ Wiki`,
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
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center gap-2 overflow-hidden">
          <a
            href={`/wiki/${lang}`}
            className="text-sm text-zinc-400 hover:text-white transition-colors whitespace-nowrap"
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
          {/* content_type バッジ */}
          <div className="mb-4">
            <ContentTypeBadge contentType={page.content_type} />
          </div>

          <h1 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
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

        {/* 言語スイッチャー */}
        <div className="mt-12 pt-8 border-t border-zinc-800 flex items-center gap-2 text-sm text-zinc-500">
          <span>Read in:</span>
          {VALID_LANGS.map((l) => (
            <a
              key={l}
              href={`/wiki/${l}/${slug}`}
              className={`px-2 py-1 rounded transition-colors ${
                l === lang
                  ? "bg-zinc-700 text-white font-medium"
                  : "hover:text-zinc-300"
              }`}
            >
              {l.toUpperCase()}
            </a>
          ))}
        </div>
      </main>

      {/* フッター */}
      <footer className="mt-8 border-t border-zinc-800 py-8">
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
