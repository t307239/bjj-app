/**
 * /tour — z213: Signup-less product tour for conversion.
 *
 * Top app reference (Linear /docs, Notion /templates, Cal.com /features):
 *   - Visitors hesitant to sign up can see exactly what value they'd get
 *   - 5 feature cards with concrete BJJ-flavored benefits
 *   - Single strong CTA at end (no decision paralysis)
 *   - 3 locale embedded (ja/en/pt) — no /tour traffic data yet to justify
 *     generateMetadata refactor
 *
 * 設計判断:
 *   - URL path: /tour (interactive な /demo を期待されるのを避ける)
 *   - screenshot 無し: 維持コスト ↑ + サーバ負荷 + 古くなる risk
 *     代わりに emoji + 具体的 BJJ value で訴求
 *   - 単一 CTA "Start tracking free" → /login (decision paralysis 回避)
 *   - Wiki / LP / Reddit から流入する visitor の signup 前 fallback
 */

import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { createClient } from "@/lib/supabase/server";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { safeJsonLd } from "@/lib/safeJsonLd";

// z204 同様: indie tagline 入り OG (mode=lp)
const TOUR_OG = "https://bjj-app.net/api/og?mode=lp&lang=en&belt=blue&count=1500&streak=14&months=14";

export const metadata: Metadata = {
  title: "Product Tour",
  description:
    "See what BJJ App tracks: training sessions, technique journal, heatmap streaks, skill map, and belt progression. Free forever.",
  alternates: { canonical: "https://bjj-app.net/tour" },
  openGraph: {
    type: "website",
    url: "https://bjj-app.net/tour",
    siteName: "BJJ App",
    title: "BJJ App — Product Tour",
    description: "Track every roll. Free, indie, no ads.",
    images: [{ url: TOUR_OG, width: 1200, height: 630, alt: "BJJ App Tour" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BJJ App — Product Tour",
    description: "Track every roll. Free, indie, no ads.",
    images: [TOUR_OG],
  },
};

type Feature = {
  emoji: string;
  title: string;
  bullets: readonly string[];
};

const COPY = {
  ja: {
    backToApp: "ホームに戻る",
    heroTitle: "登録前に、できることを見る",
    heroSub: "BJJ App でトラッキングできる 5 つの軸。すべて永久無料。",
    features: [
      {
        emoji: "📝",
        title: "練習記録 (10秒で完了)",
        bullets: [
          "Gi / No-Gi / ドリル / オープンマット を選んで保存",
          "練習相手・指導者・帯・体重・痛み箇所をオプション記録",
          "オフラインでも記録可、復帰時に自動 sync",
        ],
      },
      {
        emoji: "🔥",
        title: "ヒートマップ (Duolingo 風 streak)",
        bullets: [
          "365 日カレンダーで毎日の練習を一目で把握",
          "現在の連続日数 + 過去最長 streak を表示",
          "曜日別頻度グラフで「練習しない日」を可視化",
        ],
      },
      {
        emoji: "🗺",
        title: "スキルマップ (技術ツリー)",
        bullets: [
          "ガード/パス/サブミッション の習得度を可視化",
          "各技にメモ・YouTube link・難易度を保存",
          "弱点ポジションを SkillMap が自動 highlight",
        ],
      },
      {
        emoji: "📊",
        title: "週次レポート (数字でわかる成長)",
        bullets: [
          "週ごとの練習時間・セッション数・タイプ内訳",
          "前週比 +/- でモチベーション維持",
          "毎週月曜にメールでサマリ送信 (任意)",
        ],
      },
      {
        emoji: "🥋",
        title: "帯歴トラッキング",
        bullets: [
          "白→青→紫→茶→黒 の昇級日を保存",
          "各帯での経過月数を自動計算",
          "次の昇級まで何ヶ月か可視化",
        ],
      },
    ] as Feature[],
    ctaTitle: "始めるのは 30 秒",
    ctaSub: "クレジットカード不要。GitHub または Google でサインイン。",
    ctaPrimary: "無料で記録を始める →",
    ctaSecondary: "料金プランを見る",
    proofLine:
      "🥋 青帯による個人開発 · 🚫 広告なし · 📚 Wiki 1,500+ 無料ページ",
    proofChangelog: "今月の更新履歴を見る →",
  },
  pt: {
    backToApp: "Voltar ao início",
    heroTitle: "Veja o que dá pra fazer antes de cadastrar",
    heroSub: "5 eixos que o BJJ App rastreia. Tudo grátis, para sempre.",
    features: [
      {
        emoji: "📝",
        title: "Log de treino (10s)",
        bullets: [
          "Gi / No-Gi / drilling / open mat — selecione e salve",
          "Parceiro, instrutor, faixa, peso, dores: tudo opcional",
          "Funciona offline, sincroniza ao voltar online",
        ],
      },
      {
        emoji: "🔥",
        title: "Heatmap (sequência estilo Duolingo)",
        bullets: [
          "Calendário de 365 dias com cada treino",
          "Sequência atual + maior sequência histórica",
          "Gráfico por dia da semana revela seus dias parados",
        ],
      },
      {
        emoji: "🗺",
        title: "Skill Map (árvore técnica)",
        bullets: [
          "Visualize domínio em guarda / passagem / finalização",
          "Notas, link do YouTube e nível de dificuldade por técnica",
          "Posições fracas destacadas automaticamente",
        ],
      },
      {
        emoji: "📊",
        title: "Relatório semanal",
        bullets: [
          "Tempo, sessões e tipos por semana",
          "Comparação com a semana anterior (+/-)",
          "E-mail com resumo toda segunda (opcional)",
        ],
      },
      {
        emoji: "🥋",
        title: "Histórico de faixa",
        bullets: [
          "Datas de promoção branca→azul→roxa→marrom→preta",
          "Tempo automático em cada faixa",
          "Estimativa para a próxima promoção",
        ],
      },
    ] as Feature[],
    ctaTitle: "30 segundos para começar",
    ctaSub: "Sem cartão. Entre com GitHub ou Google.",
    ctaPrimary: "Começar a registrar grátis →",
    ctaSecondary: "Ver planos",
    proofLine:
      "🥋 Feito por faixa azul indie · 🚫 Sem anúncios · 📚 Wiki 1.500+ páginas grátis",
    proofChangelog: "Ver atualizações deste mês →",
  },
  en: {
    backToApp: "Back to home",
    heroTitle: "See what you can track before signing up",
    heroSub: "Five things BJJ App tracks. Free forever.",
    features: [
      {
        emoji: "📝",
        title: "Training log (10 seconds)",
        bullets: [
          "Pick Gi / No-Gi / drilling / open mat and save",
          "Optional partner, instructor, belt, weight, pain notes",
          "Works offline, syncs when back online",
        ],
      },
      {
        emoji: "🔥",
        title: "Heatmap (Duolingo-style streak)",
        bullets: [
          "365-day calendar showing every training day",
          "Current streak + longest streak ever",
          "Day-of-week graph reveals your slacking days",
        ],
      },
      {
        emoji: "🗺",
        title: "Skill Map (technique tree)",
        bullets: [
          "See your mastery across guard / passing / submissions",
          "Notes, YouTube links, and difficulty per technique",
          "Weak positions auto-highlighted",
        ],
      },
      {
        emoji: "📊",
        title: "Weekly report (numbers don't lie)",
        bullets: [
          "Time, session count, and type breakdown per week",
          "Week-over-week +/- comparison for motivation",
          "Optional Monday email summary",
        ],
      },
      {
        emoji: "🥋",
        title: "Belt progression",
        bullets: [
          "Save white→blue→purple→brown→black promotion dates",
          "Auto-calculated time at each belt",
          "Months-to-next-belt estimate",
        ],
      },
    ] as Feature[],
    ctaTitle: "30 seconds to start",
    ctaSub: "No credit card. Sign in with GitHub or Google.",
    ctaPrimary: "Start tracking for free →",
    ctaSecondary: "See pricing",
    proofLine:
      "🥋 Built by an indie blue belt · 🚫 No ads · 📚 1,500+ free wiki pages",
    proofChangelog: "See what we shipped this month →",
  },
} as const;

// JSON-LD: ItemList for the 5 features (SEO rich snippet eligibility)
const itemListJsonLd = (features: readonly Feature[]) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "BJJ App features",
  numberOfItems: features.length,
  itemListElement: features.map((f, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: f.title,
  })),
});

export default async function TourPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const locale = await detectServerLocale();
  const t = makeT(locale);
  const c = COPY[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    t("dashboard.defaultAthleteName");
  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  let isPro = false;
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", user.id)
      .single();
    isPro = prof?.is_pro ?? false;
  }

  const ctaPrimaryHref = user ? "/dashboard" : "/login?ref=tour";

  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd(c.features)) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        {/* Back */}
        <Link
          href={user ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors mb-8"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {c.backToApp}
        </Link>

        {/* Hero */}
        <section className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            {c.heroTitle}
          </h1>
          <p className="text-base text-zinc-400">{c.heroSub}</p>
        </section>

        {/* 5 feature cards */}
        <section className="space-y-5">
          {c.features.map((f, i) => (
            <article
              key={i}
              className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.06] rounded-2xl px-5 py-5"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl flex-shrink-0">{f.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-white mb-2">
                    {f.title}
                  </h2>
                  <ul className="space-y-1.5">
                    {f.bullets.map((b, j) => (
                      <li
                        key={j}
                        className="text-sm text-zinc-300 leading-relaxed flex items-start gap-2"
                      >
                        <span className="text-emerald-400 flex-shrink-0 mt-0.5">·</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Indie proof line + changelog evidence link */}
        <section className="mt-12 text-center">
          <p className="text-sm text-zinc-400 mb-2">{c.proofLine}</p>
          <Link
            href="/changelog"
            className="inline-block text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {c.proofChangelog}
          </Link>
        </section>

        {/* Single primary CTA */}
        <section className="mt-12 bg-zinc-900/40 border border-emerald-500/30 rounded-2xl p-6 text-center">
          <h2 className="text-lg font-semibold text-white mb-1">
            {c.ctaTitle}
          </h2>
          <p className="text-sm text-zinc-400 mb-5">{c.ctaSub}</p>
          <Link
            href={ctaPrimaryHref}
            className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-7 rounded-full transition-colors"
          >
            {c.ctaPrimary}
          </Link>
          <div className="mt-4">
            <Link
              href="/pricing"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              {c.ctaSecondary}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
