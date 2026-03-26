import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const revalidate = 3600;

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────

const VALID_LANGS = ["en", "ja", "pt"] as const;
type Lang = (typeof VALID_LANGS)[number];

interface PageParams {
  lang: string;
  slug: string;
}

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
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

// ─────────────────────────────────────────
// TOC ヘルパー（サーバーサイド regex 処理）
// ─────────────────────────────────────────

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "") // strip inner HTML tags
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80);
}

/**
 * content_html 内の h2/h3 に id 属性を注入し、TOC 配列を返す。
 * id がすでに存在する場合はスキップ。
 */
function processHeadings(html: string): { html: string; toc: TocItem[] } {
  if (!html) return { html, toc: [] };

  const toc: TocItem[] = [];
  const usedIds = new Set<string>();

  const processed = html.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h[23]>/gi,
    (match, levelStr, attrs, content) => {
      // 既存 id があればそのまま返す
      if (/\bid\s*=/.test(attrs)) return match;

      const rawText = content.replace(/<[^>]+>/g, "").trim();
      if (!rawText) return match;

      let id = slugifyHeading(rawText);
      if (!id) return match;

      // 重複 id を回避
      if (usedIds.has(id)) {
        let n = 2;
        while (usedIds.has(`${id}-${n}`)) n++;
        id = `${id}-${n}`;
      }
      usedIds.add(id);

      const level = parseInt(levelStr, 10) as 2 | 3;
      toc.push({ id, text: rawText, level });

      return `<h${levelStr}${attrs} id="${id}">${content}</h${levelStr}>`;
    }
  );

  return { html: processed, toc };
}

// ─────────────────────────────────────────
// データ取得ヘルパー
// ─────────────────────────────────────────

async function getWikiPage(lang: string, slug: string) {
  const supabase = await createClient();

  const { data: pageData, error: pageError } = await supabase
    .from("wiki_pages")
    .select("id")
    .eq("slug", slug)
    .single();

  if (pageError || !pageData) return null;

  const { data, error } = await supabase
    .from("wiki_translations")
    .select("title, description, content_html, content_type")
    .eq("page_id", pageData.id)
    .eq("language_code", lang)
    .single();

  if (error || !data) return null;
  return data;
}

// 同ジャンル関連記事を最大4件取得
async function getRelatedPages(
  lang: string,
  contentType: string | null,
  currentSlug: string
) {
  if (!contentType) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("wiki_translations")
    .select("title, wiki_pages!inner(slug)")
    .eq("language_code", lang)
    .eq("content_type", contentType)
    .limit(5);

  if (error || !data) return [];

  return data
    .map((row) => {
      const wp = row.wiki_pages as { slug: string } | { slug: string }[] | null;
      const slug = Array.isArray(wp) ? wp[0]?.slug : wp?.slug;
      return slug ? { title: row.title, slug } : null;
    })
    .filter(
      (item): item is { title: string; slug: string } =>
        item !== null && item.slug !== currentSlug
    )
    .slice(0, 4);
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
  if (!page) return { title: "Not Found" };

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
    twitter: { card: "summary", title, description },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `https://bjj-app.net/wiki/en/${slug}`,
        ja: `https://bjj-app.net/wiki/ja/${slug}`,
        pt: `https://bjj-app.net/wiki/pt/${slug}`,
      },
    },
  };
}

// ─────────────────────────────────────────
// ContentTypeBadge
// ─────────────────────────────────────────

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
// OnThisPage — sticky TOC サイドバー
// ─────────────────────────────────────────

function OnThisPage({ items, lang }: { items: TocItem[]; lang: string }) {
  if (items.length === 0) return null;

  const label =
    lang === "ja"
      ? "このページの目次"
      : lang === "pt"
      ? "Nesta página"
      : "On this page";

  return (
    <nav aria-label={label}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <ul className="space-y-1.5 border-l border-zinc-800 pl-3">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? "pl-3" : ""}>
            <a
              href={`#${item.id}`}
              className="block text-sm text-zinc-400 hover:text-white transition-colors line-clamp-2 leading-snug"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ─────────────────────────────────────────
// CTA バナー
// ─────────────────────────────────────────

function WikiCtaBanner({ lang }: { lang: string }) {
  const messages: Record<Lang, { heading: string; sub: string; cta: string }> =
    {
      en: {
        heading: "Track Your BJJ Progress",
        sub: "Log sessions, monitor streaks & map your techniques — for free.",
        cta: "Start for Free →",
      },
      ja: {
        heading: "BJJの進捗をトラッキングしよう",
        sub: "練習ログ・連続記録・テクニックマップを無料で管理。",
        cta: "無料で始める →",
      },
      pt: {
        heading: "Acompanhe seu Progresso no BJJ",
        sub: "Registre sessões, monitore sequências e mapeie técnicas — de graça.",
        cta: "Começar Grátis →",
      },
    };

  const m = messages[lang as Lang] ?? messages.en;

  return (
    <div className="my-10 rounded-2xl bg-gradient-to-br from-blue-900/60 to-indigo-900/60 border border-blue-700/40 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
      <div className="shrink-0 text-5xl">🥋</div>
      <div className="flex-1 text-center sm:text-left">
        <p className="text-lg font-bold text-white mb-1">{m.heading}</p>
        <p className="text-sm text-zinc-300">{m.sub}</p>
      </div>
      <Link
        href="https://bjj-app.net/login"
        className="shrink-0 rounded-xl bg-blue-500 hover:bg-blue-400 transition-colors px-6 py-3 text-sm font-semibold text-white shadow-lg"
      >
        {m.cta}
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────
// 関連記事
// ─────────────────────────────────────────

function RelatedArticles({
  lang,
  articles,
  contentType,
}: {
  lang: string;
  articles: { title: string; slug: string }[];
  contentType: string | null;
}) {
  if (articles.length === 0) return null;

  const cfg = contentType ? BADGE_CONFIG[contentType as ContentType] : null;

  return (
    <div className="mt-10 pt-8 border-t border-zinc-800">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {cfg ? `${cfg.emoji} More ${cfg.label}` : "Related Articles"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/wiki/${lang}/${a.slug}`}
            className="group rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
          >
            <p className="text-sm text-zinc-200 group-hover:text-white line-clamp-2 transition-colors">
              {a.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// BackToTopLink
// ─────────────────────────────────────────

function BackToTopLink({ lang }: { lang: string }) {
  const label =
    lang === "ja"
      ? "↑ 上に戻る"
      : lang === "pt"
      ? "↑ Voltar ao topo"
      : "↑ Back to top";
  return (
    <a
      href="#"
      className="inline-block text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      {label}
    </a>
  );
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

  if (!VALID_LANGS.includes(lang as Lang)) notFound();

  const page = await getWikiPage(lang, slug);
  if (!page) notFound();

  const [related, { html: processedHtml, toc }] = await Promise.all([
    getRelatedPages(lang, page.content_type, slug),
    Promise.resolve(processHeadings(page.content_html ?? "")),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ナビゲーションヘッダー */}
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center gap-2 overflow-hidden">
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

      {/* 2カラムレイアウト: メイン + sticky TOC */}
      <div className="mx-auto max-w-7xl px-4 py-10 lg:flex lg:gap-12">
        {/* ── メインコンテンツ ── */}
        <main className="flex-1 min-w-0">
          <article>
            <div className="mb-4">
              <ContentTypeBadge contentType={page.content_type} />
            </div>

            <h1 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
              {page.title}
            </h1>

            {page.description && (
              <p className="mb-8 text-lg text-zinc-400 leading-relaxed border-l-4 border-pink-500 pl-4">
                {page.description}
              </p>
            )}

            {/* Wiki コンテンツ */}
            <div
              className="
                prose prose-invert prose-zinc max-w-none
                prose-headings:text-white prose-headings:font-bold
                prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
                prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
                prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:mb-4
                prose-a:text-pink-400 prose-a:no-underline hover:prose-a:text-pink-300 hover:prose-a:underline
                prose-strong:text-white prose-strong:font-semibold
                prose-ul:text-zinc-300 prose-ol:text-zinc-300
                prose-li:my-1
                prose-img:rounded-lg prose-img:my-6
                prose-hr:border-zinc-700
                prose-blockquote:border-zinc-600 prose-blockquote:text-zinc-400
                prose-code:text-pink-300 prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded
                prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700
                prose-table:text-zinc-300
                prose-th:text-zinc-200 prose-th:border-zinc-700
                prose-td:border-zinc-700
              "
              dangerouslySetInnerHTML={{ __html: processedHtml }}
            />
          </article>

          {/* CTA バナー */}
          <WikiCtaBanner lang={lang} />

          {/* 関連記事 */}
          <RelatedArticles
            lang={lang}
            articles={related}
            contentType={page.content_type}
          />

          {/* 言語スイッチャー + Back to Top */}
          <div className="mt-10 pt-8 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
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
            <BackToTopLink lang={lang} />
          </div>
        </main>

        {/* ── sticky TOC サイドバー（lg以上で表示）── */}
        {toc.length > 0 && (
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
              <OnThisPage items={toc} lang={lang} />
            </div>
          </aside>
        )}
      </div>

      {/* フッター */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
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
