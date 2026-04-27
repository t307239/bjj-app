/**
 * trialReminderEmail — z194 (F-3): Stripe trial_will_end → email builder
 *
 * Stripe webhook `customer.subscription.trial_will_end` は trial 終了 3日前に
 * 自動 fire される。本 helper が email HTML を組み立て、webhook handler 側で
 * Resend 経由 send する。
 *
 * Top app reference (Notion / Linear / Stripe / Hevy):
 *   - 件名に残日数を明示 ("3 days left")
 *   - 本文で「失うもの」(loss aversion) と「継続するメリット」両方提示
 *   - CTA は Stripe Customer Portal (cancel / payment update が 1-click)
 *   - 自分のアカウント設定への戻り口も明示
 *
 * z187 unsubscribe との関係: trial_will_end は **service email** (transactional)
 * 扱いだが UX 上 footer に opt-out 提示はしておく。CAN-SPAM 上は必須ではない
 * (transactional 例外) が、信頼向上のため統一。
 */
import { signUnsubscribeToken } from "@/lib/unsubscribeToken";

export type Locale = "ja" | "en" | "pt";

interface TrialReminderInput {
  userId: string;
  email: string;
  locale: Locale;
  trialEndDate: Date;
  manageUrl: string; // Stripe Customer Portal URL
}

const COPY = {
  ja: {
    subject: "🎁 BJJ App Pro トライアル残り 3日間",
    title: "トライアルが 3日後に終了します",
    lead: "BJJ App Pro の 14日無料トライアルは {date} に終了し、自動的に $9.99/月の課金が始まります。継続する場合は何もしなくて OK。キャンセルしたい場合は以下から1分で操作できます。",
    keepingTitle: "Pro で得られるもの",
    keeping: [
      "📊 12ヶ月分の練習グラフと弱点分析",
      "🎯 AI コーチからの個別アドバイス",
      "🗺 無制限スキルマップ + ボディマネジメント",
      "🛡 連続記録の自動保護",
    ],
    losingTitle: "キャンセルした場合",
    losing: "Free プランに戻り、過去の記録 / テクニックジャーナル / 月次グラフは引き続き利用できます。Pro 機能のみ無効化されます。",
    ctaManage: "サブスクリプションを管理 →",
    ctaContinue: "Pro を継続する場合は何もしなくて OK。",
    footer: "サービスメールのため配信停止できませんが、マーケティングメールは設定から停止できます。",
    unsubLabel: "マーケティングメール配信停止",
  },
  en: {
    subject: "🎁 Your BJJ App Pro trial ends in 3 days",
    title: "Your free trial ends in 3 days",
    lead: "Your 14-day free trial of BJJ App Pro ends on {date} and you'll be charged $9.99/month automatically. To continue, do nothing. To cancel, manage it below in under a minute.",
    keepingTitle: "What you keep with Pro",
    keeping: [
      "📊 12-month training graphs and weak-side analysis",
      "🎯 Personalized AI coach feedback",
      "🗺 Unlimited skill map + body management",
      "🛡 Auto-protect your training streak",
    ],
    losingTitle: "If you cancel",
    losing: "You'll return to the Free plan. Your training logs, technique journal, and monthly graphs stay accessible — only Pro features become unavailable.",
    ctaManage: "Manage subscription →",
    ctaContinue: "To stay on Pro, no action needed.",
    footer: "Transactional service email — manage marketing emails in settings.",
    unsubLabel: "Manage marketing email preferences",
  },
  pt: {
    subject: "🎁 Seu teste do BJJ App Pro termina em 3 dias",
    title: "Seu teste gratuito termina em 3 dias",
    lead: "Seu teste gratuito de 14 dias do BJJ App Pro termina em {date} e você será cobrado $9,99/mês automaticamente. Para continuar, não faça nada. Para cancelar, gerencie abaixo em menos de um minuto.",
    keepingTitle: "O que você mantém com o Pro",
    keeping: [
      "📊 Gráficos de treino de 12 meses e análise de pontos fracos",
      "🎯 Feedback personalizado do coach AI",
      "🗺 Skill map ilimitado + gestão corporal",
      "🛡 Proteção automática da sua sequência",
    ],
    losingTitle: "Se você cancelar",
    losing: "Você volta para o plano Free. Seus logs de treino, journal de técnicas e gráficos mensais continuam acessíveis — apenas recursos Pro ficam indisponíveis.",
    ctaManage: "Gerenciar assinatura →",
    ctaContinue: "Para continuar no Pro, nenhuma ação necessária.",
    footer: "E-mail de serviço transacional — gerencie e-mails de marketing nas configurações.",
    unsubLabel: "Gerenciar preferências de e-mail de marketing",
  },
} as const;

function fmtDate(d: Date, locale: Locale): string {
  const intlLocale = locale === "ja" ? "ja-JP" : locale === "pt" ? "pt-BR" : "en-US";
  try {
    return new Intl.DateTimeFormat(intlLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function buildTrialReminderEmail(input: TrialReminderInput): {
  subject: string;
  html: string;
} {
  const c = COPY[input.locale];
  const dateStr = fmtDate(input.trialEndDate, input.locale);
  const lead = c.lead.replace("{date}", dateStr);

  // z187: settings page link (アプリ内 marketing email toggle)
  const unsubToken = signUnsubscribeToken(input.userId);
  const unsubscribeUrl = `https://bjj-app.net/api/unsubscribe?token=${unsubToken}`;

  const keepingHtml = c.keeping
    .map(
      (k) =>
        `<li style="margin:6px 0;color:#c8e6c9;font-size:14px;list-style:none;padding-left:0">${k}</li>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${input.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;line-height:1.3;margin:0 0 18px;color:#10b981">${c.title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#e2e8f0;margin:0 0 24px">${lead}</p>

    <div style="background:#1e293b;border-radius:12px;padding:18px 22px;margin:0 0 16px">
      <div style="font-weight:700;color:#a5d6a7;font-size:14px;margin-bottom:8px">${c.keepingTitle}</div>
      <ul style="margin:0;padding:0">${keepingHtml}</ul>
    </div>

    <p style="font-size:13px;color:#94a3b8;margin:0 0 24px;line-height:1.5">
      <strong style="color:#cbd5e1">${c.losingTitle}</strong><br>${c.losing}
    </p>

    <a href="${input.manageUrl}" style="display:block;text-align:center;background:#10b981;color:#fff;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:14px">${c.ctaManage}</a>

    <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0 0 24px">${c.ctaContinue}</p>

    <p style="font-size:11px;color:#64748b;text-align:center;margin:24px 0 8px">${c.footer}</p>
    <p style="font-size:11px;color:#64748b;text-align:center;margin:0"><a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline">${c.unsubLabel}</a></p>
  </div>
</body>
</html>`;

  return { subject: c.subject, html };
}
