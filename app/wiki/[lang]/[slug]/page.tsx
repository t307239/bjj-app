import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ScrollProgressBar from "./ScrollProgressBar";
import BackToTopButton from "./BackToTopButton";
import MobileCtaBar from "./MobileCtaBar";
import WikiContentEnhancer from "./WikiContentEnhancer";
import TocScrollSpy from "./TocScrollSpy";
import FeedbackWidget from "./FeedbackWidget";
import ShareButton from "./ShareButton";
import ConfettiEffect from "./ConfettiEffect";
import ReadPersistence from "./ReadPersistence";
import EasterEgg from "./EasterEgg";

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
// ヘルパー
// ─────────────────────────────────────────

/** #24: 読了時間を計算（200 wpm 基準） */
function calcReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80);
}

/**
 * content_html 内の h2/h3 に id 属性を注入し、TOC 配列を返す。
 * 最初の <h1> を除去（Next.js 側でタイトルを render するため）。
 * id がすでに存在する場合はスキップ。
 */
function processHeadings(html: string): { html: string; toc: TocItem[] } {
  if (!html) return { html, toc: [] };

  // 最初の <h1> を除去
  const withoutH1 = html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, "");

  const toc: TocItem[] = [];
  const usedIds = new Set<string>();

  const processed = withoutH1.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h[23]>/gi,
    (match, levelStr, attrs, content) => {
      if (/\bid\s*=/.test(attrs)) return match;

      const rawText = content.replace(/<[^>]+>/g, "").trim();
      if (!rawText) return match;

      let id = slugifyHeading(rawText);
      if (!id) return match;

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
    .select("title, description, content_html, content_type, updated_at")
    .eq("page_id", pageData.id)
    .eq("language_code", lang)
    .single();

  if (error || !data) return null;

  // video_url は別クエリで取得。
  // Supabase migration 未実行時はカラムが存在せずエラーになるが、
  // supabase-js は {data: null, error} を返すだけなので安全にフォールバック可能。
  // migration 実行済み後は正常に取得できる。
  const { data: videoData } = await supabase
    .from("wiki_pages")
    .select("video_url")
    .eq("id", pageData.id)
    .single();
  const videoUrl = (videoData as { video_url?: string | null } | null)?.video_url ?? null;

  return { ...data, video_url: videoUrl };
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
    twitter: { card: "summary_large_image", title, description },
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
// OnThisPage — sticky TOC サイドバー (#6)
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
    <nav aria-label={label} className="toc-nav">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <ul className="space-y-1 border-l border-white/10 pl-3">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? "pl-3" : ""}>
            <a
              href={`#${item.id}`}
              className="block text-[12px] leading-snug text-slate-500 hover:text-slate-200 transition-colors line-clamp-2 py-0.5"
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
// Mobile TOC Accordion (#13)
// ─────────────────────────────────────────

function MobileTocAccordion({ items, lang }: { items: TocItem[]; lang: string }) {
  if (items.length === 0) return null;

  const label =
    lang === "ja"
      ? "目次"
      : lang === "pt"
      ? "Índice"
      : "Contents";

  return (
    <details className="lg:hidden mb-6 rounded-xl border border-slate-700/50 bg-slate-800/30 group">
      <summary className="px-4 py-3 text-sm font-medium text-slate-300 cursor-pointer list-none flex items-center justify-between select-none">
        <span className="flex items-center gap-2">
          <span className="text-slate-500 text-base">☰</span>
          {label}
        </span>
        <svg
          className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="px-4 pb-4 pt-1">
        <ul className="space-y-1 border-l border-slate-700 pl-3">
          {items.map((item) => (
            <li key={item.id} className={item.level === 3 ? "pl-3" : ""}>
              <a
                href={`#${item.id}`}
                className="block text-xs text-slate-400 hover:text-white transition-colors py-0.5 leading-snug"
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

// ─────────────────────────────────────────
// Related Video セクション (#UGC)
// Technique / Drill ページ専用。
// - video_url あり: YouTube 埋め込み
// - video_url なし: UGC "Submit Link" CTA
// ─────────────────────────────────────────

const VIDEO_CONTENT_TYPES = new Set(["Technique", "Drill"]);

/** content_html に YouTube iframe が既に含まれているか */
function hasVideoInContent(html: string): boolean {
  return /youtube\.com\/embed|youtu\.be/i.test(html);
}

function RelatedVideoSection({
  videoUrl,
  contentType,
  contentHtml,
  slug,
  lang,
}: {
  videoUrl: string | null;
  contentType: string | null;
  contentHtml: string;
  slug: string;
  lang: string;
}) {
  // Technique / Drill 以外は表示しない
  if (!contentType || !VIDEO_CONTENT_TYPES.has(contentType)) return null;
  // 本文に既にYouTube iframeがあれば重複を避ける
  if (hasVideoInContent(contentHtml)) return null;

  const headingLabel =
    lang === "ja"
      ? "関連動画"
      : lang === "pt"
      ? "Vídeo Relacionado"
      : "Related Video";

  const ugcLabel =
    lang === "ja"
      ? "このテクニックに合う動画を知っていますか？"
      : lang === "pt"
      ? "Conhece um bom vídeo para esta técnica?"
      : "Know a good video for this technique?";

  const ugcCta =
    lang === "ja"
      ? "動画リンクを送る →"
      : lang === "pt"
      ? "Enviar link de vídeo →"
      : "Submit a video link →";

  return (
    <div className="mt-12 pt-8 border-t border-white/10">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        🎬 {headingLabel}
      </p>

      {videoUrl ? (
        /* ── YouTube 埋め込み ── */
        <div className="relative w-full rounded-xl overflow-hidden border border-white/10 shadow-xl bg-black/30">
          <div style={{ paddingBottom: "56.25%", position: "relative" }}>
            <iframe
              src={videoUrl}
              title={headingLabel}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: 0,
              }}
            />
          </div>
        </div>
      ) : (
        /* ── UGC フォールバック CTA ── */
        <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
          <span className="text-2xl shrink-0 mt-0.5">🎬</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-300 mb-3">{ugcLabel}</p>
            <Link
              href={`https://bjj-app.net/wiki/submit-video?slug=${slug}&lang=${lang}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 px-4 py-2 text-sm font-medium text-pink-400 hover:text-pink-300 transition-colors"
            >
              {ugcCta}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// CTA バナー（glassmorphism）
// ─────────────────────────────────────────

function WikiCtaBanner({ lang }: { lang: string }) {
  const content: Record<
    Lang,
    { heading: string; sub: string; features: string[]; cta: string; sub2: string }
  > = {
    en: {
      heading: "Take Your BJJ to the Next Level",
      sub: "The free app built for serious grapplers.",
      features: [
        "📋 Log every training session",
        "🔥 Build & protect your streak",
        "🗺️ Map your technique progress",
        "🏋️ Track weight & conditioning",
      ],
      cta: "Start Free — No Credit Card",
      sub2: "Join 1,000+ grapplers already tracking",
    },
    ja: {
      heading: "BJJを次のレベルへ",
      sub: "本気の練習者のための無料アプリ。",
      features: [
        "📋 練習セッションを記録",
        "🔥 連続記録を積み上げる",
        "🗺️ テクニックの習得状況を可視化",
        "🏋️ 体重・コンディションを管理",
      ],
      cta: "無料で始める（クレカ不要）",
      sub2: "すでに1,000人以上が利用中",
    },
    pt: {
      heading: "Leve seu BJJ ao Próximo Nível",
      sub: "O app gratuito feito para grapplers sérios.",
      features: [
        "📋 Registre cada sessão de treino",
        "🔥 Construa e proteja sua sequência",
        "🗺️ Mapeie seu progresso técnico",
        "🏋️ Acompanhe peso e condicionamento",
      ],
      cta: "Começar Grátis — Sem Cartão",
      sub2: "Mais de 1.000 atletas já treinando",
    },
  };

  const c = content[lang as Lang] ?? content.en;

  return (
    <div className="my-12 rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 overflow-hidden shadow-2xl shadow-black/40">
      {/* ヘッダーバー */}
      <div className="bg-gradient-to-r from-pink-600/20 to-purple-700/20 border-b border-slate-700/50 px-6 py-3 flex items-center gap-2">
        <span className="text-xl">🥋</span>
        <span className="text-xs font-semibold text-pink-400 uppercase tracking-widest">
          BJJ App
        </span>
      </div>

      <div className="px-6 py-7 sm:px-8 sm:py-8">
        <div className="sm:flex sm:items-start sm:gap-8">
          {/* テキスト */}
          <div className="flex-1 mb-6 sm:mb-0">
            <h3 className="text-xl font-bold text-white mb-1 tracking-tight">{c.heading}</h3>
            <p className="text-sm text-slate-400 mb-5">{c.sub}</p>
            <ul className="space-y-2">
              {c.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <span className="shrink-0 text-base">{f.slice(0, 2)}</span>
                  <span>{f.slice(2).trim()}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTAボタン（グロウエフェクト付き）*/}
          <div className="flex flex-col items-center sm:items-end gap-3 shrink-0">
            <Link
              href="https://bjj-app.net/login"
              className="inline-flex items-center justify-center rounded-xl bg-pink-600 hover:bg-pink-500 active:bg-pink-700 transition-all px-7 py-3.5 text-sm font-bold text-white shadow-lg hover:shadow-[0_0_24px_rgba(236,72,153,0.45)] whitespace-nowrap"
            >
              {c.cta}
            </Link>
            <p className="text-xs text-slate-500 text-center">{c.sub2}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 関連記事 カードグリッド (#8)
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
    <div className="mt-10 pt-8 border-t border-white/10">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {cfg ? `${cfg.emoji} More ${cfg.label}` : "Related Articles"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/wiki/${lang}/${a.slug}`}
            className="group rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3.5 hover:border-slate-600 hover:bg-slate-800/70 hover:-translate-y-0.5 transition-all duration-150"
          >
            <p className="text-sm text-slate-300 group-hover:text-white line-clamp-2 transition-colors leading-snug">
              {a.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
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

  // #24: 読了時間
  const readingTime = calcReadingTime(processedHtml);

  // #24: 更新日フォーマット
  const updatedAt = page.updated_at
    ? new Date(page.updated_at).toLocaleDateString(
        lang === "ja" ? "ja-JP" : lang === "pt" ? "pt-BR" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      )
    : null;

  // CTA コンテンツ（MobileCtaBar 用）
  const ctaLabels: Record<Lang, string> = {
    en: "Start Free — No Credit Card",
    ja: "無料で始める（クレカ不要）",
    pt: "Começar Grátis — Sem Cartão",
  };
  const ctaLabel = ctaLabels[lang as Lang] ?? ctaLabels.en;

  // #19: Breadcrumb JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "BJJ Wiki",
        item: `https://bjj-app.net/wiki/${lang}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: BADGE_CONFIG[page.content_type as ContentType]?.label ?? page.content_type ?? "Article",
        item: `https://bjj-app.net/wiki/${lang}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: page.title,
        item: `https://bjj-app.net/wiki/${lang}/${slug}`,
      },
    ],
  };

  // #19: Article JSON-LD
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.title,
    description: page.description ?? "",
    url: `https://bjj-app.net/wiki/${lang}/${slug}`,
    inLanguage: lang,
    publisher: {
      "@type": "Organization",
      name: "BJJ Wiki",
      url: "https://bjj-app.net",
    },
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* #19: JSON-LD 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* #16: スクロール進捗バー（クライアント）*/}
      <ScrollProgressBar />

      {/* パンくずリスト */}
      <header className="border-b border-white/10 bg-[#0f172a]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-2 text-sm">
          <a
            href={`/wiki/${lang}`}
            className="text-slate-400 hover:text-white transition-colors"
          >
            BJJ Wiki
          </a>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 truncate max-w-[200px] sm:max-w-none">
            {BADGE_CONFIG[page.content_type as ContentType]?.label ??
              page.content_type}
          </span>
        </div>
      </header>

      {/* 2カラムレイアウト */}
      <div className="mx-auto max-w-7xl px-4 py-10 lg:flex lg:gap-14">
        {/* ── メインコンテンツ ── */}
        <main className="flex-1 min-w-0">
          <article>
            {/* バッジ */}
            <div className="mb-4">
              <ContentTypeBadge contentType={page.content_type} />
            </div>

            {/* タイトル */}
            <h1 className="mb-3 text-3xl font-bold text-white sm:text-4xl leading-tight tracking-tight">
              {page.title}
            </h1>

            {/* #24: 読了時間 + 更新日 + #47: Author */}
            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-slate-500">
              {/* #47: Author badge */}
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-[9px] font-bold text-white select-none">
                  BJJ
                </span>
                <span>BJJ App Team</span>
              </span>
              <span className="text-slate-700">·</span>
              <span>⏱️ {readingTime} min read</span>
              {updatedAt && (
                <>
                  <span className="text-slate-700">·</span>
                  <span>🔄 {updatedAt}</span>
                </>
              )}
              {/* #32: Share button */}
              <span className="ml-auto">
                <ShareButton
                  title={page.title}
                  url={`https://bjj-app.net/wiki/${lang}/${slug}`}
                  lang={lang}
                />
              </span>
            </div>

            {/* #11: 言語スイッチャー（セグメントカプセル）*/}
            <div className="inline-flex items-center bg-slate-800/80 rounded-full p-1 gap-0.5 mb-6 border border-slate-700/50">
              {VALID_LANGS.map((l) => (
                <a
                  key={l}
                  href={`/wiki/${l}/${slug}`}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                    l === lang
                      ? "bg-slate-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {l.toUpperCase()}
                </a>
              ))}
            </div>

            {/* #13: モバイル TOC アコーディオン */}
            <MobileTocAccordion items={toc} lang={lang} />

            {/* description */}
            {page.description && (
              <p className="mb-8 text-base text-slate-400 leading-relaxed border-l-4 border-pink-500/60 pl-4 not-italic bg-slate-800/20 rounded-r-lg py-3 pr-3">
                {page.description}
              </p>
            )}

            {/* Wiki コンテンツ */}
            <div
              className="
                wiki-content
                prose prose-invert prose-slate max-w-none
                prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
                prose-h2:text-xl prose-h2:mt-12 prose-h2:mb-6
                prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-slate-200
                prose-p:text-slate-300 prose-p:leading-[1.85] prose-p:mb-5
                prose-a:text-pink-400 prose-a:no-underline hover:prose-a:text-pink-300 hover:prose-a:underline
                prose-strong:text-white prose-strong:font-semibold
                prose-ul:text-slate-300 prose-ol:text-slate-300
                prose-li:my-1.5 prose-li:text-slate-300
                prose-img:rounded-xl prose-img:my-6 prose-img:shadow-xl prose-img:border prose-img:border-slate-700/50
                prose-hr:border-slate-700/50
                prose-blockquote:border-pink-400 prose-blockquote:border-l-4 prose-blockquote:not-italic prose-blockquote:text-slate-400 prose-blockquote:bg-slate-800/30 prose-blockquote:rounded-r-lg prose-blockquote:py-3
                prose-code:text-pink-300 prose-code:bg-slate-800/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm
                prose-pre:bg-slate-800/80 prose-pre:border prose-pre:border-slate-700/50 prose-pre:rounded-xl
                prose-table:text-slate-300
                prose-th:text-slate-200 prose-th:border-slate-700/50
                prose-td:border-slate-700/50
              "
              dangerouslySetInnerHTML={{ __html: processedHtml }}
            />
          </article>

          {/* #UGC: Related Video セクション（Technique/Drill のみ）*/}
          <RelatedVideoSection
            videoUrl={page.video_url ?? null}
            contentType={page.content_type}
            contentHtml={processedHtml}
            slug={slug}
            lang={lang}
          />

          {/* #31: フィードバックウィジェット */}
          <FeedbackWidget lang={lang} />

          {/* CTA バナー（#34 confetti trigger マーカー付き）*/}
          <div data-confetti-trigger>
            <WikiCtaBanner lang={lang} />
          </div>

          {/* 関連記事 */}
          <RelatedArticles
            lang={lang}
            articles={related}
            contentType={page.content_type}
          />

          {/* #10: フッター上部スペーサー（Back to top 削除 — #21 floating btn に移譲）*/}
          <div className="mt-12" />
        </main>

        {/* ── sticky TOC サイドバー（lg以上）── */}
        {toc.length > 0 && (
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-hide">
              <OnThisPage items={toc} lang={lang} />
            </div>
          </aside>
        )}
      </div>

      {/* #10: フッター（クリーンアップ）*/}
      <footer className="border-t border-white/10 py-8 mt-4">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <p>© {new Date().getFullYear()} BJJ Wiki — All rights reserved.</p>
          <a
            href="https://bjj-app.net"
            className="hover:text-slate-400 transition-colors"
          >
            BJJ App →
          </a>
        </div>
      </footer>

      {/* #21: スクロール対応 Back to Top ボタン（クライアント）*/}
      <BackToTopButton lang={lang} />

      {/* #23: モバイル スティッキー CTA バー（クライアント）*/}
      <MobileCtaBar href="https://bjj-app.net/login" cta={ctaLabel} />

      {/* ── クライアントサイド拡張コンポーネント群 ── */}
      {/* #27/#29/#30: 内部リンク・見出しアンカー・ライトボックス */}
      <WikiContentEnhancer />
      {/* #28: TOC スクロールスパイ */}
      <TocScrollSpy items={toc} />
      {/* #34: 読了時の紙吹雪エフェクト */}
      <ConfettiEffect />
      {/* #45: 読書位置の永続化 */}
      <ReadPersistence slug={slug} />
      {/* #50: コナミコード イースターエッグ */}
      <EasterEgg />
    </div>
  );
}
