import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

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
// カテゴリ設定 — UI_DESIGN.md準拠 SaaSスタイル
// ─────────────────────────────────────────

const CATEGORY_CONFIG: Record<ContentType, CategoryConfig> = {
  Technique: {
    label: "Techniques",
    emoji: "🥋",
    description: "Submissions, sweeps, escapes, and positional techniques",
    // Techniqueはエメラルド（B2C primary）に統一
    headerClass: "text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    dotClass: "bg-emerald-400/70",
  },
  Concept_Strategy: {
    label: "Concept & Strategy",
    emoji: "🧠",
    description: "Game plans, philosophy, and strategic frameworks",
    // 紫 = accent (#7c3aed) に整合
    headerClass: "text-violet-400",
    badgeClass: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    dotClass: "bg-violet-400/70",
  },
  Drill: {
    label: "Drills",
    emoji: "🔁",
    description: "Solo drills, partner drills, and warm-up routines",
    headerClass: "text-sky-400",
    badgeClass: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
    dotClass: "bg-sky-400/70",
  },
  Rule: {
    label: "Rules & Scoring",
    emoji: "📋",
    description: "Competition rules, scoring systems, and regulations",
    headerClass: "text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    dotClass: "bg-amber-400/70",
  },
  Athlete_Bio: {
    label: "Athlete Profiles",
    emoji: "🏆",
    description: "Profiles of legendary BJJ athletes and competitors",
    // accent2 (#e94560) に近いrose
    headerClass: "text-rose-400",
    badgeClass: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    dotClass: "bg-rose-400/70",
  },
  Equipment_Gear: {
    label: "Equipment & Gear",
    emoji: "🛒",
    description: "Gis, rash guards, training gear, and equipment reviews",
    // オレンジは原色感が強いのでslateに落ち着かせる
    headerClass: "text-slate-300",
    badgeClass: "bg-slate-500/10 text-slate-300 border border-slate-500/20",
    dotClass: "bg-slate-400/70",
  },
  Conditioning_Nutrition: {
    label: "Conditioning & Nutrition",
    emoji: "💪",
    description: "Strength training, cardio, diet, and recovery",
    headerClass: "text-teal-400",
    badgeClass: "bg-teal-500/10 text-teal-400 border border-teal-500/20",
    dotClass: "bg-teal-400/70",
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
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* ── ヘッダー — Linear/Vercel風 ── */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0f172a]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="https://bjj-app.net"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← BJJ App
            </a>
            <span className="text-white/20">/</span>
            <span className="text-sm font-semibold text-white">BJJ Wiki</span>
          </div>
          {/* 言語スイッチャー — capsuleスタイル */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-1">
            {VALID_LANGS.map((l) => (
              <a
                key={l}
                href={`/wiki/${l}`}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 ${
                  l === lang
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {l.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* ── ヒーローセクション — 極薄エメラルドグロウ ── */}
      <section className="relative border-b border-white/10 overflow-hidden">
        {/* 背景グロウ（BJJ App B2C primary = emerald） */}
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(16,185,129,0.12),transparent)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-3xl">🥋</span>
                <h1 className="text-3xl font-bold sm:text-4xl tracking-tight">
                  BJJ Wiki
                </h1>
              </div>
              <p className="text-gray-400 max-w-xl text-sm leading-relaxed">
                The complete Brazilian Jiu-Jitsu encyclopedia — techniques,
                concepts, rules, athlete bios, and more.
              </p>
            </div>
            {/* 記事カウント — glassmorphism */}
            <div className="rounded-xl bg-white/5 border border-white/10 px-6 py-4 text-center min-w-[120px] backdrop-blur-sm">
              <p className="text-2xl font-bold text-white tabular-nums">
                {totalCount.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-widest">
                articles
              </p>
            </div>
          </div>

          {/* カテゴリ概要バッジ — SaaSステータスバッジ風 */}
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((ct) => {
              const cfg = CATEGORY_CONFIG[ct];
              const count = grouped[ct]?.length ?? 0;
              if (count === 0) return null;
              return (
                <a
                  key={ct}
                  href={`#${ct}`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all hover:opacity-90 hover:-translate-y-px ${cfg.badgeClass}`}
                >
                  <span>{cfg.emoji}</span>
                  {cfg.label}
                  <span className="opacity-60">({count})</span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── メインコンテンツ — カテゴリ別セクション ── */}
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-14">
        {CATEGORY_ORDER.map((ct) => {
          const items = grouped[ct];
          if (!items || items.length === 0) return null;
          const cfg = CATEGORY_CONFIG[ct];

          return (
            <section key={ct} id={ct}>
              {/* セクションヘッダー */}
              <div className="mb-5 flex items-center gap-3 pb-3 border-b border-white/10">
                <span className="text-xl">{cfg.emoji}</span>
                <div>
                  <h2 className={`text-lg font-bold ${cfg.headerClass}`}>
                    {cfg.label}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5 uppercase tracking-widest">
                    {cfg.description}
                  </p>
                </div>
                <span className="ml-auto text-xs text-zinc-400 bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5 tabular-nums">
                  {items.length}
                </span>
              </div>

              {/* 記事グリッド */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {items.map(({ title, slug }) => (
                  <a
                    key={slug}
                    href={`/wiki/${lang}/${slug}`}
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all duration-150"
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
          <p className="text-xs text-zinc-400 text-center">
            {uncategorized} articles not yet categorized
          </p>
        )}
      </main>

      {/* ── フッター ── */}
      <footer className="mt-8 border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
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
            <a
              href="https://bjj-app.net"
              className="hover:text-zinc-300 transition-colors"
            >
              BJJ App →
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
