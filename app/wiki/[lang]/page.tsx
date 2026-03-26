import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────
// 定数・型定義
// ─────────────────────────────────────────

const VALID_LANGS = ["en", "ja", "pt"] as const;
type Lang = (typeof VALID_LANGS)[number];

interface PageParams {
  lang: string;
}

type ContentType =
  | "Technique"
  | "Concept_Strategy"
  | "Rule"
  | "Athlete_Bio"
  | "Equipment_Gear"
  | "Conditioning_Nutrition"
  | "Drill";

interface ArticleRow {
  title: string;
  content_type: string | null;
  wiki_pages: { slug: string } | { slug: string }[] | null;
}

interface CategoryConfig {
  label: string;
  emoji: string;
  description: string;
  headerClass: string;
  badgeClass: string;
  dotClass: string;
}

// ─────────────────────────────────────────
// カテゴリ設定
// ─────────────────────────────────────────

const CATEGORY_CONFIG: Record<ContentType, CategoryConfig> = {
  Technique: {
    label: "Techniques",
    emoji: "🥋",
    description: "Submissions, sweeps, escapes, and positional techniques",
    headerClass: "text-blue-400",
    badgeClass: "bg-blue-900/40 text-blue-300 border border-blue-800",
    dotClass: "bg-blue-500",
  },
  Concept_Strategy: {
    label: "Concepts & Strategy",
    emoji: "🧠",
    description: "Game plans, philosophy, and strategic frameworks",
    headerClass: "text-violet-400",
    badgeClass: "bg-violet-900/40 text-violet-300 border border-violet-800",
    dotClass: "bg-violet-500",
  },
  Drill: {
    label: "Drills",
    emoji: "🔁",
    description: "Solo drills, partner drills, and warm-up routines",
    headerClass: "text-teal-400",
    badgeClass: "bg-teal-900/40 text-teal-300 border border-teal-800",
    dotClass: "bg-teal-500",
  },
  Rule: {
    label: "Rules & Scoring",
    emoji: "📋",
    description: "Competition rules, scoring systems, and regulations",
    headerClass: "text-amber-400",
    badgeClass: "bg-amber-900/40 text-amber-300 border border-amber-800",
    dotClass: "bg-amber-500",
  },
  Athlete_Bio: {
    label: "Athlete Bios",
    emoji: "🏆",
    description: "Profiles of legendary BJJ athletes and competitors",
    headerClass: "text-rose-400",
    badgeClass: "bg-rose-900/40 text-rose-300 border border-rose-800",
    dotClass: "bg-rose-500",
  },
  Equipment_Gear: {
    label: "Equipment & Gear",
    emoji: "🛒",
    description: "Gis, rash guards, training gear, and equipment reviews",
    headerClass: "text-orange-400",
    badgeClass: "bg-orange-900/40 text-orange-300 border border-orange-800",
    dotClass: "bg-orange-500",
  },
  Conditioning_Nutrition: {
    label: "Conditioning & Nutrition",
    emoji: "💪",
    description: "Strength training, cardio, diet, and recovery",
    headerClass: "text-green-400",
    badgeClass: "bg-green-900/40 text-green-300 border border-green-800",
    dotClass: "bg-green-500",
  },
};

// カテゴリの表示順
const CATEGORY_ORDER: ContentType[] = [
  "Technique",
  "Concept_Strategy",
  "Drill",
  "Rule",
  "Athlete_Bio",
  "Equipment_Gear",
  "Conditioning_Nutrition",
];

const LANG_LABELS: Record<string, string> = {
  en: "English",
  ja: "日本語",
  pt: "Português",
};

// ─────────────────────────────────────────
// データ取得
// ─────────────────────────────────────────

async function getWikiIndex(lang: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("wiki_translations")
    .select("title, content_type, wiki_pages!inner(slug)")
    .eq("language_code", lang)
    .order("title")
    .limit(2000);

  if (error || !data) return null;
  return data as unknown as ArticleRow[];
}

// ─────────────────────────────────────────
// generateMetadata
// ─────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!VALID_LANGS.includes(lang as Lang)) return { title: "Not Found" };

  const langLabel = LANG_LABELS[lang] ?? lang.toUpperCase();
  const title = `BJJ Wiki — ${langLabel}`;
  const description =
    "The complete Brazilian Jiu-Jitsu encyclopedia. Techniques, concepts, rules, athlete bios, drills, and more.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://bjj-app.net/wiki/${lang}`,
      type: "website",
      siteName: "BJJ Wiki",
    },
    alternates: {
      canonical: `https://bjj-app.net/wiki/${lang}`,
    },
  };
}

// ─────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────

export default async function WikiIndexPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { lang } = await params;

  if (!VALID_LANGS.includes(lang as Lang)) {
    notFound();
  }

  const articles = await getWikiIndex(lang);

  if (!articles) {
    notFound();
  }

  // カテゴリ別グルーピング
  const grouped: Record<string, Array<{ title: string; slug: string }>> = {};
  let uncategorized = 0;

  for (const row of articles) {
    const ct = row.content_type ?? "Technique";
    const wp = row.wiki_pages;
    const slug = Array.isArray(wp) ? wp[0]?.slug : wp?.slug;
    if (!slug) continue;
    if (!grouped[ct]) grouped[ct] = [];
    grouped[ct].push({ title: row.title, slug });
    if (!row.content_type) uncategorized++;
  }

  const totalCount = articles.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ヘッダー */}
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="https://bjj-app.net"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              ← BJJ App
            </a>
            <span className="text-zinc-600">/</span>
            <span className="text-sm font-semibold text-white">BJJ Wiki</span>
          </div>
          {/* 言語スイッチャー */}
          <div className="flex items-center gap-1">
            {VALID_LANGS.map((l) => (
              <a
                key={l}
                href={`/wiki/${l}`}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  l === lang
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {l.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-3xl">🥋</span>
                <h1 className="text-3xl font-bold sm:text-4xl">BJJ Wiki</h1>
              </div>
              <p className="text-zinc-400 max-w-xl text-base leading-relaxed">
                The complete Brazilian Jiu-Jitsu encyclopedia — techniques,
                concepts, rules, athlete bios, and more.
              </p>
            </div>
            <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 px-5 py-3 text-center min-w-[120px]">
              <p className="text-2xl font-bold text-white">{totalCount.toLocaleString()}</p>
              <p className="text-xs text-zinc-400 mt-0.5">articles</p>
            </div>
          </div>

          {/* カテゴリ概要チップ */}
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((ct) => {
              const cfg = CATEGORY_CONFIG[ct];
              const count = grouped[ct]?.length ?? 0;
              if (count === 0) return null;
              return (
                <a
                  key={ct}
                  href={`#${ct}`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${cfg.badgeClass}`}
                >
                  <span>{cfg.emoji}</span>
                  {cfg.label}
                  <span className="opacity-70">({count})</span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* メインコンテンツ — カテゴリ別セクション */}
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-14">
        {CATEGORY_ORDER.map((ct) => {
          const articles = grouped[ct];
          if (!articles || articles.length === 0) return null;
          const cfg = CATEGORY_CONFIG[ct];

          return (
            <section key={ct} id={ct}>
              {/* セクションヘッダー */}
              <div className="mb-5 flex items-center gap-3 pb-3 border-b border-zinc-800">
                <span className="text-2xl">{cfg.emoji}</span>
                <div>
                  <h2 className={`text-xl font-bold ${cfg.headerClass}`}>
                    {cfg.label}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">{cfg.description}</p>
                </div>
                <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 rounded-full px-2 py-0.5">
                  {articles.length}
                </span>
              </div>

              {/* 記事グリッド */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {articles.map(({ title, slug }) => (
                  <a
                    key={slug}
                    href={`/wiki/${lang}/${slug}`}
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-colors"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dotClass} group-hover:scale-125 transition-transform`}
                    />
                    <span className="line-clamp-1">{title}</span>
                  </a>
                ))}
              </div>
            </section>
          );
        })}

        {/* 未分類の場合の注記 */}
        {uncategorized > 0 && (
          <p className="text-xs text-zinc-600 text-center">
            {uncategorized} articles not yet categorized
          </p>
        )}
      </main>

      {/* フッター */}
      <footer className="mt-8 border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <p>© {new Date().getFullYear()} BJJ Wiki — All rights reserved.</p>
          <div className="flex items-center gap-4">
            {VALID_LANGS.map((l) => (
              <a
                key={l}
                href={`/wiki/${l}`}
                className={`transition-colors ${
                  l === lang ? "text-white font-medium" : "hover:text-zinc-300"
                }`}
              >
                {LANG_LABELS[l]}
              </a>
            ))}
            <a href="https://bjj-app.net" className="hover:text-zinc-300 transition-colors">
              BJJ App →
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
