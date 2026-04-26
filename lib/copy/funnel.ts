/**
 * lib/copy/funnel.ts — z190: 集客マネタイズ funnel コピー一元化
 *
 * 【背景】 z176/z177/z178/z184/z186 で同じ value props を 5 ファイルに
 * hand-craft してた → 一箇所更新時の同期忘れ多発。
 *
 * 【方針】 Top app reference (Stripe / Linear copy lib pattern):
 *   - 1 source of truth per (audience × value prop)
 *   - locale-aware (ja/pt/en)
 *   - 細かいフレーズは現場で組み立て、value-prop 配列のみ共有
 *
 * 【利用側】
 *   import { GYM_VALUE_PROPS } from "@/lib/copy/funnel";
 *   const props = GYM_VALUE_PROPS[locale];
 *
 * 【保守ルール】
 *   - 新規 page / email で gym/pro value props を書く時は MUST 本ファイルから import
 *   - 6 propsの内容変更は本ファイル 1 箇所だけ → 全 5 surface 自動同期
 *   - lint Pattern 12 (DUPLICATE_VALUE_PROP) で hard-code 検出 → fail
 */

export type Locale = "ja" | "en" | "pt";

// ── B2B Gym Pro value props (z177 email + z178 page + z184 pricing で共通) ─
export const GYM_VALUE_PROPS: Record<Locale, readonly string[]> = {
  ja: [
    "📊 全生徒の練習頻度を一覧表示",
    "🚨 2 週間来ない生徒を自動アラート (離脱率 50% 改善実績)",
    "📚 今週のテーマを全員のダッシュボードに固定",
    "🎯 帯昇格が近い生徒を AI が提案",
    "🔒 個人メモは秘匿、統計のみ可視化",
    "📥 CSV で生徒を一括招待",
  ],
  en: [
    "📊 See every student's training frequency",
    "🚨 Auto-alert when a student vanishes 2+ weeks (-50% churn)",
    "📚 Pin this week's focus to every dashboard",
    "🎯 AI suggests students ready for promotion",
    "🔒 Personal notes stay private — only stats visible",
    "📥 Bulk-invite students via CSV",
  ],
  pt: [
    "📊 Frequência de treino de todos os alunos",
    "🚨 Alerta automático quando aluno some 2 semanas (-50% evasão)",
    "📚 Fixe o tema da semana no dashboard de todos",
    "🎯 IA sugere alunos prontos para promoção",
    "🔒 Notas pessoais ficam privadas, só estatísticas visíveis",
    "📥 Convide alunos em massa via CSV",
  ],
};

// ── Trial badge (gym + B2C 共通) ────────────────────────────────────────
export const TRIAL_BADGE: Record<Locale, string> = {
  ja: "🎁 14 日間 無料 · クレジットカード不要",
  en: "🎁 14-day free trial · No credit card required",
  pt: "🎁 14 dias grátis · Sem cartão de crédito",
};

// ── Trust signals (footer with trust trio) ──────────────────────────────
export const TRUST_SIGNALS: Record<Locale, readonly string[]> = {
  ja: [
    "クレジットカード不要",
    "いつでもキャンセル可",
    "個人プランへの自動切替なし",
  ],
  en: [
    "No credit card",
    "Cancel anytime",
    "No auto-charge to personal plan",
  ],
  pt: [
    "Sem cartão de crédito",
    "Cancele a qualquer momento",
    "Sem cobrança automática",
  ],
};

// ── Gym tier metadata (price/cta — locale-aware label only) ────────────
export const GYM_TIER = {
  price: "$99",
  perMonth: { ja: "/月", en: "/mo", pt: "/mês" } as Record<Locale, string>,
  trialCta: {
    ja: "14 日間 無料で試す →",
    en: "Start 14-day free trial →",
    pt: "Testar 14 dias grátis →",
  } as Record<Locale, string>,
};

// ── B2C Pro tier metadata ──────────────────────────────────────────────
export const PRO_TIER = {
  monthlyPrice: "$9.99",
  annualPrice: "$79.99",
  perMonth: { ja: "/月", en: "/mo", pt: "/mês" } as Record<Locale, string>,
};

/** Helper: locale-safe lookup with fallback. */
export function pickLocale<T>(map: Record<Locale, T>, locale: string): T {
  if (locale === "ja") return map.ja;
  if (locale === "pt") return map.pt;
  return map.en;
}
