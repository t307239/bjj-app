/**
 * /changelog — z203: Public changelog (indie credibility + SEO + dependability)
 *
 * Top app reference (Linear / Plausible / Cal.com / Resend):
 *   - Public-facing list of recent user-facing improvements
 *   - Builds trust ("they actively ship") for indie projects
 *   - SEO content ("BJJ App new features 2026")
 *   - 補完: z202 で「shutdown 不安」を消した FAQ の証拠として「実際に動いてる」
 *
 * 注意: dev-internal な refactor / bug fix は載せない。user 視点のみ。
 * 月次更新方針: 月初に当月分追加 (手動 curation で品質維持)。
 */

import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { createClient } from "@/lib/supabase/server";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { safeJsonLd } from "@/lib/safeJsonLd";

// z204: indie signal の OG image (Reddit/community 共有時に「Built by blue belt」表示)
const CHANGELOG_OG = "https://bjj-app.net/api/og?mode=reddit&lang=en&belt=blue&count=1500&streak=14&months=14";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Recent updates and shipped features for BJJ App. Built indie, shipping every week.",
  alternates: { canonical: "https://bjj-app.net/changelog" },
  openGraph: {
    type: "website",
    url: "https://bjj-app.net/changelog",
    siteName: "BJJ App",
    title: "BJJ App Changelog — what we shipped",
    description: "Indie BJJ project. Recent updates and new features.",
    images: [{ url: CHANGELOG_OG, width: 1200, height: 630, alt: "BJJ App Changelog" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BJJ App Changelog — what we shipped",
    description: "Indie BJJ project. Recent updates and new features.",
    images: [CHANGELOG_OG],
  },
};

type Entry = {
  emoji: string;
  title: string;
  desc: string;
};

type MonthBlock = {
  date: string; // human-readable, e.g. "April 2026"
  items: Entry[];
};

const COPY = {
  ja: {
    heroTitle: "最近のアップデート",
    heroSub: "個人開発で毎週何かしら出荷しています。",
    monthsHeading: "月別アップデート",
    backToApp: "アプリに戻る",
    suggestTitle: "欲しい機能はありますか?",
    suggestSub: "メールでフィードバックを直接受け付けています。",
    suggestCta: "提案を送る →",
    months: [
      {
        date: "2026年 4月",
        items: [
          { emoji: "🎓", title: "オンボーディングメール (Day 1/3/7/14)", desc: "新規登録後、初週の習慣化を後押しする 4 通のステップメール。" },
          { emoji: "✉️", title: "ワンクリック配信停止 + 設定画面で詳細管理", desc: "CAN-SPAM / GDPR / RFC 8058 準拠。マーケティングメールはアカウント設定からも個別 ON/OFF。" },
          { emoji: "⏰", title: "Pro トライアル終了 3日前のリマインドメール", desc: "課金開始前に「継続する/しない」を 1 分で判断できる。" },
          { emoji: "💰", title: "/pricing ページを独立化 (3 tier)", desc: "Free / Pro $9.99 / Gym $99 を 1 画面で比較。FAQ + JSON-LD で SEO もカバー。" },
          { emoji: "🇧🇷", title: "ポルトガル語 (PT-BR) 完全対応", desc: "Wiki / アプリ全画面で PT-BR が安定動作。日付/単位も適切に locale 化。" },
          { emoji: "📱", title: "モバイルでの Wiki → アプリ導線改善", desc: "320-480px で踏める CTA 配置とコピーを Top app pattern で再設計。" },
          { emoji: "🛡️", title: "誠実な料金表記に統一", desc: "誤解を招く可能性のあった数値表現を削除し、本当の指標 (Wiki 1,500 ページ等) のみに。" },
          { emoji: "🤝", title: "/pricing に信頼系 FAQ を 4 件追加", desc: "「データ販売しない」「VC 資金なし」「CSV エクスポート可」「終了時の対応」。" },
          { emoji: "📚", title: "Wiki に AI 生成の FAQ + 難易度ラベル追加 (進行中)", desc: "1,500+ ページに、技ごとの「よくある質問」と難易度バッジを順次注入中。" },
          { emoji: "🎬", title: "Wiki 各ページに動画埋め込み (進行中)", desc: "YouTube から技ごとの解説動画を毎日 50 件ずつ自動注入。" },
        ],
      },
    ] as MonthBlock[],
  },
  pt: {
    heroTitle: "Atualizações recentes",
    heroSub: "Projeto indie. Toda semana sai algo novo.",
    monthsHeading: "Histórico mensal",
    backToApp: "Voltar para o app",
    suggestTitle: "Tem ideia de recurso?",
    suggestSub: "Recebemos feedback direto por e-mail.",
    suggestCta: "Enviar sugestão →",
    months: [
      {
        date: "Abril 2026",
        items: [
          { emoji: "🎓", title: "E-mails de onboarding (Dia 1/3/7/14)", desc: "Sequência de 4 e-mails para criar o hábito na primeira semana." },
          { emoji: "✉️", title: "Cancelamento em 1 clique + controle nas configurações", desc: "CAN-SPAM / GDPR / RFC 8058. E-mails de marketing podem ser gerenciados individualmente." },
          { emoji: "⏰", title: "Lembrete 3 dias antes do fim do teste Pro", desc: "Decida em menos de 1 minuto se continua ou cancela." },
          { emoji: "💰", title: "/pricing como página própria (3 planos)", desc: "Free / Pro $9,99 / Gym $99 lado a lado. FAQ + JSON-LD para SEO." },
          { emoji: "🇧🇷", title: "Português (PT-BR) completo", desc: "Wiki e app inteiros funcionando em PT-BR, com datas e unidades adequadas." },
          { emoji: "📱", title: "CTA do Wiki para o app melhorado no mobile", desc: "Posicionamento e copy redesenhados (320-480px) seguindo padrão de top apps." },
          { emoji: "🛡️", title: "Preço com mensagens honestas", desc: "Removemos números que poderiam confundir. Mantivemos só métricas reais (1.500+ páginas wiki)." },
          { emoji: "🤝", title: "+4 FAQs de confiança em /pricing", desc: "\"Vendem meus dados?\", \"VC?\", \"Posso exportar?\", \"E se encerrar?\"." },
          { emoji: "📚", title: "Wiki com FAQ + nível de dificuldade gerados por IA (em progresso)", desc: "1.500+ páginas recebendo perguntas frequentes e selo de dificuldade por técnica." },
          { emoji: "🎬", title: "Wiki com vídeos embedados (em progresso)", desc: "50 vídeos do YouTube por dia injetados automaticamente em cada técnica." },
        ],
      },
    ] as MonthBlock[],
  },
  en: {
    heroTitle: "Recent updates",
    heroSub: "Indie project. Something ships every week.",
    monthsHeading: "By month",
    backToApp: "Back to app",
    suggestTitle: "Have a feature request?",
    suggestSub: "We take feedback directly by email.",
    suggestCta: "Send a suggestion →",
    months: [
      {
        date: "April 2026",
        items: [
          { emoji: "🎓", title: "Onboarding emails (Day 1/3/7/14)", desc: "A 4-step email sequence to help you build the habit in your first week." },
          { emoji: "✉️", title: "1-click unsubscribe + per-type controls in Settings", desc: "CAN-SPAM / GDPR / RFC 8058 compliant. Marketing emails can be toggled individually." },
          { emoji: "⏰", title: "Pro trial reminder 3 days before charge", desc: "Decide in under a minute whether to continue or cancel." },
          { emoji: "💰", title: "Standalone /pricing page (3 tiers)", desc: "Free / Pro $9.99 / Gym $99 side by side, with FAQ + JSON-LD for SEO." },
          { emoji: "🇧🇷", title: "Full Portuguese (PT-BR) coverage", desc: "Wiki and app in PT-BR, with locale-aware dates and units." },
          { emoji: "📱", title: "Improved Wiki → app CTA on mobile", desc: "Placement and copy redesigned (320-480px) following top-app patterns." },
          { emoji: "🛡️", title: "Honest pricing copy", desc: "Removed potentially misleading numbers. Kept only real metrics (1,500+ wiki pages)." },
          { emoji: "🤝", title: "+4 trust FAQs on /pricing", desc: "\"Will you sell my data?\", \"VC-funded?\", \"Can I export?\", \"What if you shut down?\"." },
          { emoji: "📚", title: "AI-generated FAQ + difficulty on Wiki pages (in progress)", desc: "Adding per-technique FAQs and difficulty badges to 1,500+ pages." },
          { emoji: "🎬", title: "Embedded videos on Wiki (in progress)", desc: "50 YouTube technique videos auto-injected per day." },
        ],
      },
    ] as MonthBlock[],
  },
} as const;

const itemListJsonLd = (months: readonly MonthBlock[]) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "BJJ App changelog",
  itemListOrder: "https://schema.org/ItemListOrderDescending",
  numberOfItems: months.reduce((acc, m) => acc + m.items.length, 0),
  itemListElement: months.flatMap((m) =>
    m.items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.title,
    })),
  ),
});

export default async function ChangelogPage() {
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

  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd(c.months)) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        {/* Back */}
        <Link
          href={user ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors mb-8"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {c.backToApp}
        </Link>

        {/* Hero */}
        <section className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            {c.heroTitle}
          </h1>
          <p className="text-base text-zinc-400">{c.heroSub}</p>
        </section>

        {/* Month blocks */}
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">
          {c.monthsHeading}
        </h2>
        <div className="space-y-12">
          {c.months.map((m) => (
            <section key={m.date}>
              <h3 className="text-base font-semibold text-emerald-400 mb-4">
                {m.date}
              </h3>
              <ul className="space-y-3">
                {m.items.map((it, i) => (
                  <li
                    key={i}
                    className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-xl px-4 py-3"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="text-xl flex-shrink-0">{it.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-semibold leading-snug">
                          {it.title}
                        </div>
                        <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                          {it.desc}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Suggestion CTA */}
        <section className="mt-16 bg-zinc-900/40 border border-white/10 rounded-xl p-6 text-center">
          <p className="text-base text-white font-semibold mb-1">{c.suggestTitle}</p>
          <p className="text-sm text-zinc-400 mb-4">{c.suggestSub}</p>
          <a
            href="mailto:307239t777@gmail.com?subject=BJJ%20App%20feature%20request"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {c.suggestCta}
          </a>
        </section>
      </main>
    </div>
  );
}
