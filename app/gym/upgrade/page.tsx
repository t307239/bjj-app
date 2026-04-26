/**
 * /gym/upgrade — z178: B2B Gym Premium upgrade landing
 *
 * z177 PLG メール (`?ref=plg_email&gym_id=X`) からの着地ページ。
 *
 * Top app reference (Linear / Notion / Slack):
 *   - Hero: gym-specific data (member count, dojo name から social proof)
 *   - Value props grid (5 items, email と同期)
 *   - Pricing card with 14-day trial
 *   - Single primary CTA → /api/stripe/checkout {plan:"gym"}
 *   - Trust signal: "No credit card · cancel anytime"
 *
 * URL params:
 *   ?ref=plg_email | wiki | direct (attribution for analytics)
 *   ?gym_id=<uuid> (validation: must match user's owned gym, otherwise ignore)
 */

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import { detectServerLocale, makeT } from "@/lib/i18n";
import GymUpgradeCheckoutButton from "@/components/gym/GymUpgradeCheckoutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // layout.tsx の template "%s | BJJ App" が自動付与
  title: "Upgrade to Gym Pro",
  description:
    "Manage your dojo's training data, prevent student churn, and dispatch curriculum — all in BJJ App.",
  alternates: { canonical: "https://bjj-app.net/gym/upgrade" },
  openGraph: {
    type: "website",
    url: "https://bjj-app.net/gym/upgrade",
    siteName: "BJJ App",
    title: "Upgrade to Gym Pro | BJJ App",
    description:
      "Manage your dojo's training data, prevent student churn, and dispatch curriculum — all in BJJ App.",
  },
};

// ── Inline copy (避ける: messages.json への 30+ key 追加) ────────────────
const COPY = {
  ja: {
    heroTitleSolo: "Gym Pro にアップグレード",
    heroTitleWithGym: (n: number, name: string) =>
      `${name} の生徒 ${n} 人が記録中です`,
    heroSub: "$99/月 で道場全体を管理。指導の浸透・離脱防止・帯昇格をデータで支援。",
    heroSubWithGym: "Gym Pro で全員のダッシュボードを統合管理できます。",
    valueTitle: "Gym Pro でできること",
    values: [
      "📊 全生徒の練習頻度を一覧表示",
      "🚨 2 週間来ない生徒を自動アラート (離脱率 50% 改善実績)",
      "📚 今週のテーマを全員のダッシュボードに固定",
      "🎯 帯昇格が近い生徒を AI が提案",
      "🔒 個人メモは秘匿、統計のみ可視化",
      "📥 CSV で生徒を一括招待",
    ],
    pricingTitle: "Gym Pro",
    pricingPrice: "$99",
    pricingPer: "/月",
    pricingTrial: "14 日間 無料トライアル",
    cta: "14 日間 無料で試す →",
    trustNoCard: "クレジットカード不要",
    trustCancel: "いつでもキャンセル可",
    trustNoAuto: "個人プランへの自動切替なし",
    backLink: "← Gym ダッシュボードへ戻る",
    notOwnerTitle: "ジムオーナーアカウントが必要です",
    notOwnerSub: "Gym Pro のアップグレードは道場のオーナーのみ可能です。先にジムを作成してください。",
    notOwnerCta: "ジムを作成する →",
  },
  pt: {
    heroTitleSolo: "Faça upgrade para Gym Pro",
    heroTitleWithGym: (n: number, name: string) =>
      `${n} alunos da ${name} estão registrando`,
    heroSub:
      "$99/mês para gerenciar todo o dojo. Reforço de ensino, prevenção de evasão e promoções com dados.",
    heroSubWithGym: "Com Gym Pro, gerencie o dashboard de todos em um só lugar.",
    valueTitle: "O que o Gym Pro oferece",
    values: [
      "📊 Frequência de treino de todos os alunos",
      "🚨 Alerta automático quando aluno some 2 semanas (-50% evasão)",
      "📚 Fixe o tema da semana no dashboard de todos",
      "🎯 IA sugere alunos prontos para promoção",
      "🔒 Notas pessoais ficam privadas, só estatísticas visíveis",
      "📥 Convide alunos em massa via CSV",
    ],
    pricingTitle: "Gym Pro",
    pricingPrice: "$99",
    pricingPer: "/mês",
    pricingTrial: "Teste grátis 14 dias",
    cta: "Testar 14 dias grátis →",
    trustNoCard: "Sem cartão de crédito",
    trustCancel: "Cancele a qualquer momento",
    trustNoAuto: "Sem cobrança automática",
    backLink: "← Voltar ao dashboard do Gym",
    notOwnerTitle: "Conta de proprietário de gym necessária",
    notOwnerSub:
      "O upgrade do Gym Pro só está disponível para o proprietário do dojo. Crie um gym primeiro.",
    notOwnerCta: "Criar um gym →",
  },
  en: {
    heroTitleSolo: "Upgrade to Gym Pro",
    heroTitleWithGym: (n: number, name: string) =>
      `${n} students from ${name} are tracking`,
    heroSub:
      "$99/mo to manage your whole dojo. Pin teaching themes, prevent churn, time promotions with data.",
    heroSubWithGym:
      "With Gym Pro, manage every student's dashboard from one place.",
    valueTitle: "What you get with Gym Pro",
    values: [
      "📊 See every student's training frequency",
      "🚨 Auto-alert when a student vanishes 2+ weeks (-50% churn)",
      "📚 Pin this week's focus to every dashboard",
      "🎯 AI suggests students ready for promotion",
      "🔒 Personal notes stay private — only stats visible",
      "📥 Bulk-invite students via CSV",
    ],
    pricingTitle: "Gym Pro",
    pricingPrice: "$99",
    pricingPer: "/mo",
    pricingTrial: "14-day free trial",
    cta: "Start 14-day free trial →",
    trustNoCard: "No credit card",
    trustCancel: "Cancel anytime",
    trustNoAuto: "No auto-charge to personal plan",
    backLink: "← Back to Gym dashboard",
    notOwnerTitle: "Gym owner account required",
    notOwnerSub:
      "Gym Pro upgrade is only available for dojo owners. Please create a gym first.",
    notOwnerCta: "Create a gym →",
  },
} as const;

export default async function GymUpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; gym_id?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/gym/upgrade");

  const sp = await searchParams;
  const _refSource = sp.ref ?? "direct";  // for telemetry; logged client-side

  const locale = await detectServerLocale();
  const t = makeT(locale);
  const c = COPY[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];

  // Look up the user's gym (must be owner)
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, is_pro, gym_id, is_gym_owner")
    .eq("id", user.id)
    .single();

  const displayName =
    ownerProfile?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    t("dashboard.defaultAthleteName");
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // Not a gym owner: show fallback CTA → /gym (where they can create one)
  if (!ownerProfile?.is_gym_owner || !ownerProfile.gym_id) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950">
        <NavBar
          displayName={displayName}
          avatarUrl={avatarUrl}
          isPro={ownerProfile?.is_pro ?? false}
        />
        <main className="max-w-2xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-white mb-3">{c.notOwnerTitle}</h1>
          <p className="text-zinc-400 mb-6">{c.notOwnerSub}</p>
          <a
            href="/gym"
            className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold"
          >
            {c.notOwnerCta}
          </a>
        </main>
      </div>
    );
  }

  // Resolve gym info (member count for hero social proof)
  const { data: gym } = await supabase
    .from("gyms")
    .select("id, name, is_active")
    .eq("id", ownerProfile.gym_id)
    .eq("owner_id", user.id)
    .single();

  // Already on Gym Pro? Redirect to dashboard.
  if (gym?.is_active) {
    redirect("/gym/dashboard?already_active=1");
  }

  const { count: memberCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", ownerProfile.gym_id)
    .is("deleted_at", null);

  const showSocialProof = (memberCount ?? 0) >= 3;
  const heroTitle =
    showSocialProof && gym
      ? c.heroTitleWithGym(memberCount ?? 0, gym.name)
      : c.heroTitleSolo;
  const heroSub = showSocialProof ? c.heroSubWithGym : c.heroSub;

  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      <NavBar
        displayName={displayName}
        avatarUrl={avatarUrl}
        isPro={ownerProfile.is_pro}
      />
      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        {/* Hero */}
        <section className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            {heroTitle}
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 max-w-xl mx-auto">{heroSub}</p>
        </section>

        {/* Value props */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-zinc-300 mb-5 text-center">
            {c.valueTitle}
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {c.values.map((v, i) => (
              <li
                key={i}
                className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-xl px-4 py-3 text-sm text-zinc-200"
              >
                {v}
              </li>
            ))}
          </ul>
        </section>

        {/* Pricing card + CTA */}
        <section className="bg-gradient-to-br from-emerald-950/40 to-zinc-900/60 ring-1 ring-emerald-500/30 rounded-2xl p-7 sm:p-9 max-w-md mx-auto text-center">
          <div className="text-emerald-400 font-semibold text-sm tracking-widest uppercase mb-2">
            {c.pricingTitle}
          </div>
          <div className="flex items-baseline justify-center gap-1 mb-1">
            <span className="text-5xl font-bold text-white tabular-nums">
              {c.pricingPrice}
            </span>
            <span className="text-zinc-400 text-lg whitespace-nowrap">
              {c.pricingPer}
            </span>
          </div>
          <div className="text-emerald-300 text-sm mb-6">🎁 {c.pricingTrial}</div>

          <GymUpgradeCheckoutButton ctaLabel={c.cta} refSource={_refSource} />

          <div className="mt-5 text-xs text-zinc-500 space-y-1">
            <div>✓ {c.trustNoCard}</div>
            <div>✓ {c.trustCancel}</div>
            <div>✓ {c.trustNoAuto}</div>
          </div>
        </section>

        <div className="text-center mt-10">
          <a href="/gym/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">
            {c.backLink}
          </a>
        </div>
      </main>
    </div>
  );
}
