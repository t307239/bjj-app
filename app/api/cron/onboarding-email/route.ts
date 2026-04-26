/**
 * GET /api/cron/onboarding-email
 *
 * z186: Onboarding email sequence (Day 1/3/7/14) — Notion/Linear/Hevy 流。
 *
 * 【目的】 新規 signup 後の day-1 離脱を防ぐ structured drip campaign。
 *
 * 【Top app reference】
 *   - Notion: Day 0 welcome → Day 2 "How are you using?" → Day 7 templates → Day 14 Pro
 *   - Linear: Day 0 → Day 3 tips → Day 7 shortcuts → Day 14 team invite
 *   - Hevy: Day 0 first workout → Day 3 tips → Day 7 streak → Day 14 Pro
 *   - Duolingo: aggressive daily streak emails (we avoid this — annoying)
 *
 * 【BJJ App での 4 段階】
 *   Day 1:  "Log your first session" — まだログ 0 件のユーザー対象
 *   Day 3:  "Discover SkillMap & Heatmap" — feature discovery
 *   Day 7:  "Try Pro free for 14 days" — B2C upsell hint
 *   Day 14: "How are you finding BJJ App?" — NPS / feedback ask
 *
 * 【Idempotency】
 *   onboarding_emails_log (UNIQUE (user_id, day_marker)) で同じ user × 同じ day
 *   への重複送信を物理的に防ぐ。23505 (unique_violation) なら skip。
 *
 * 【Schedule】 daily 08:00 UTC (= 17:00 JST = 朝米国)
 * 【Auth】 verifyCronAuth (z169 fail-closed)
 */

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cronAuth";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { signUnsubscribeToken } from "@/lib/unsubscribeToken";
import { canSendEmail, recordEmailSent } from "@/lib/emailRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@bjj-app.net";

type DayMarker = "day1" | "day3" | "day7" | "day14";
type Locale = "ja" | "en" | "pt";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  locale: Locale;
  total_logs: number;
  is_pro: boolean;
}

// ── Locale-aware copy ─────────────────────────────────────────────────────
const COPY = {
  ja: {
    day1: {
      subject: "🥋 BJJ App へようこそ — 最初の練習を記録しましょう",
      title: "最初の練習を記録するだけで、すべてが始まります",
      lead: "練習後、技や反省を 10 秒で記録するだけ。明日の自分が今日の自分に感謝します。",
      cta: "最初の練習を記録 →",
      ctaUrl: "https://bjj-app.net/records?welcome=1",
      footer: "このメールは BJJ App 登録時にお送りしています。配信停止は設定から。",
    },
    day3: {
      subject: "🎯 BJJ App の便利機能 — Skill Map と Heatmap",
      title: "あなたの BJJ 成長を可視化する 2 つのツール",
      lead: "Skill Map で技の習得度を一目で確認。 Heatmap で連続記録を伸ばすモチベーションに。両方無料です。",
      cta: "Skill Map を見る →",
      ctaUrl: "https://bjj-app.net/techniques/skillmap",
      footer: "配信停止は設定から。",
    },
    day7: {
      subject: "⚡ Pro で BJJ 成長をさらに加速 — 14日間 無料",
      title: "高度な分析で、あなたの弱点が見える",
      lead: "Pro なら AI コーチ、12ヶ月グラフ、ボディマネジメント、無制限スキルマップが使えます。14日間無料、クレカ不要。",
      cta: "Pro を 14 日間 無料で試す →",
      ctaUrl: "https://bjj-app.net/pricing?ref=onboarding_d7",
      footer: "配信停止は設定から。",
    },
    day14: {
      subject: "📝 BJJ App の使い心地を教えてください",
      title: "あなたの率直な感想を聞かせてください",
      lead: "BJJ App を使ってみてどうでしたか?良かった点・改善してほしい点、何でもお聞かせください。 開発者(柔術プレイヤー本人)が読みます。",
      cta: "返信で感想を送る →",
      ctaUrl: "mailto:307239t777@gmail.com?subject=BJJ%20App%20Feedback",
      footer: "配信停止は設定から。",
    },
  },
  en: {
    day1: {
      subject: "🥋 Welcome to BJJ App — Log your first session",
      title: "Log your first session and everything starts",
      lead: "Just 10 seconds after class to log your roll. Tomorrow's you will thank today's you.",
      cta: "Log your first session →",
      ctaUrl: "https://bjj-app.net/records?welcome=1",
      footer: "Sent because you signed up for BJJ App. Unsubscribe in settings.",
    },
    day3: {
      subject: "🎯 BJJ App tools — Skill Map and Heatmap",
      title: "Two tools to visualize your BJJ growth",
      lead: "Skill Map shows technique mastery at a glance. Heatmap motivates you to keep the streak alive. Both free.",
      cta: "Open Skill Map →",
      ctaUrl: "https://bjj-app.net/techniques/skillmap",
      footer: "Unsubscribe in settings.",
    },
    day7: {
      subject: "⚡ Accelerate growth with Pro — 14 days free",
      title: "Advanced analytics expose your weak side",
      lead: "Pro unlocks AI coach, 12-month graphs, body management, and unlimited skill map. 14 days free, no credit card.",
      cta: "Try Pro free for 14 days →",
      ctaUrl: "https://bjj-app.net/pricing?ref=onboarding_d7",
      footer: "Unsubscribe in settings.",
    },
    day14: {
      subject: "📝 How is BJJ App working for you?",
      title: "Tell me what you really think",
      lead: "How has BJJ App been? What's working? What's missing? The developer (a blue belt) reads every reply.",
      cta: "Reply with feedback →",
      ctaUrl: "mailto:307239t777@gmail.com?subject=BJJ%20App%20Feedback",
      footer: "Unsubscribe in settings.",
    },
  },
  pt: {
    day1: {
      subject: "🥋 Bem-vindo ao BJJ App — Registre sua primeira sessão",
      title: "Registre sua primeira sessão e tudo começa",
      lead: "Só 10 segundos depois da aula para registrar sua rola. O você de amanhã agradece o você de hoje.",
      cta: "Registrar primeira sessão →",
      ctaUrl: "https://bjj-app.net/records?welcome=1",
      footer: "Enviado porque você se cadastrou no BJJ App. Cancelar inscrição nas configurações.",
    },
    day3: {
      subject: "🎯 Ferramentas BJJ App — Skill Map e Heatmap",
      title: "Duas ferramentas para visualizar seu crescimento no BJJ",
      lead: "Skill Map mostra domínio de técnicas em um só olhar. Heatmap te motiva a manter a sequência. Ambos grátis.",
      cta: "Abrir Skill Map →",
      ctaUrl: "https://bjj-app.net/techniques/skillmap",
      footer: "Cancelar inscrição nas configurações.",
    },
    day7: {
      subject: "⚡ Acelere seu crescimento com o Pro — 14 dias grátis",
      title: "Análise avançada expõe seu lado fraco",
      lead: "Pro libera AI coach, gráficos de 12 meses, gestão corporal e skill map ilimitado. 14 dias grátis, sem cartão.",
      cta: "Testar Pro 14 dias grátis →",
      ctaUrl: "https://bjj-app.net/pricing?ref=onboarding_d7",
      footer: "Cancelar inscrição nas configurações.",
    },
    day14: {
      subject: "📝 Como está sendo sua experiência com o BJJ App?",
      title: "Me conte o que você realmente acha",
      lead: "Como tem sido o BJJ App? O que funciona? O que falta? O desenvolvedor (faixa azul) lê cada resposta.",
      cta: "Responder com feedback →",
      ctaUrl: "mailto:307239t777@gmail.com?subject=BJJ%20App%20Feedback",
      footer: "Cancelar inscrição nas configurações.",
    },
  },
} as const;

function buildEmailHtml(
  user: UserRow,
  marker: DayMarker,
): { subject: string; html: string; unsubscribeUrl: string } {
  const c = COPY[user.locale][marker];
  // z187: 1-click unsubscribe link (HMAC-signed token, 1 year TTL)
  const unsubToken = signUnsubscribeToken(user.id);
  const unsubscribeUrl = `https://bjj-app.net/api/unsubscribe?token=${unsubToken}`;
  const unsubLabel =
    user.locale === "ja" ? "配信停止"
    : user.locale === "pt" ? "Cancelar inscrição"
    : "Unsubscribe";

  const html = `<!DOCTYPE html>
<html lang="${user.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;line-height:1.3;margin:0 0 18px;color:#10b981">${c.title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#e2e8f0;margin:0 0 24px">${c.lead}</p>
    <a href="${c.ctaUrl}" style="display:block;text-align:center;background:#10b981;color:#fff;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:14px">${c.cta}</a>
    <p style="font-size:11px;color:#64748b;text-align:center;margin:24px 0 8px">${c.footer}</p>
    <p style="font-size:11px;color:#64748b;text-align:center;margin:0"><a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline">${unsubLabel}</a></p>
  </div>
</body>
</html>`;

  return { subject: c.subject, html, unsubscribeUrl };
}

// ── Day from created_at ────────────────────────────────────────────────────
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function markerFromDays(days: number): DayMarker | null {
  // Allow ±1 day grace per stage (cron may run early/late)
  if (days >= 1 && days <= 2) return "day1";
  if (days >= 3 && days <= 4) return "day3";
  if (days >= 7 && days <= 8) return "day7";
  if (days >= 14 && days <= 15) return "day14";
  return null;
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const auth = verifyCronAuth(req);
  if (!auth.ok) return auth.response;

  if (!RESEND_API_KEY) {
    logger.warn("onboarding-email: RESEND_API_KEY not set, skipping");
    return NextResponse.json({ ok: true, skipped: true, reason: "no_api_key" });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Fetch users created in last 16 days (covers up to day14 + grace)
  const cutoff = new Date(Date.now() - 16 * 86400000).toISOString();

  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (authErr || !authData) {
    logger.error("onboarding-email.list_users_failed", {}, authErr as Error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const recentUsers = authData.users.filter(
    (u) => u.email && u.created_at >= cutoff,
  );

  if (recentUsers.length === 0) {
    return NextResponse.json({ ok: true, candidates: 0, sent: 0 });
  }

  // 2. Bulk fetch profiles + log counts
  // z187: email_marketing_opted_out=true は除外
  const userIds = recentUsers.map((u) => u.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, locale, is_pro, email_marketing_opted_out")
    .in("id", userIds)
    .is("deleted_at", null)
    .eq("email_marketing_opted_out", false);
  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  const { data: logCounts } = await supabase
    .from("training_logs")
    .select("user_id")
    .in("user_id", userIds);
  const logCountMap = new Map<string, number>();
  for (const log of logCounts ?? []) {
    logCountMap.set(log.user_id, (logCountMap.get(log.user_id) ?? 0) + 1);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of recentUsers) {
    if (!u.email) {
      skipped++;
      continue;
    }
    const profile = profileMap.get(u.id);
    if (!profile) {
      skipped++;
      continue;
    }
    const totalLogs = logCountMap.get(u.id) ?? 0;
    const days = daysSince(u.created_at);
    const marker = markerFromDays(days);
    if (!marker) {
      skipped++;
      continue;
    }

    // Day 1 only sends if user has NOT yet logged any session
    if (marker === "day1" && totalLogs > 0) {
      skipped++;
      continue;
    }
    // Day 7 only sends if user is NOT already Pro
    if (marker === "day7" && profile.is_pro) {
      skipped++;
      continue;
    }

    const userRow: UserRow = {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      locale: ((profile.locale ?? "en") as Locale),
      total_logs: totalLogs,
      is_pro: profile.is_pro ?? false,
    };

    // z189: 24h frequency cap (全 cron 横断、spam ban 防止)
    const allowed = await canSendEmail(supabase, u.id, `onboarding_${marker}`);
    if (!allowed) {
      logger.info("onboarding-email.skipped_rate_limit", { userId: u.id, marker });
      skipped++;
      continue;
    }

    // Idempotency check via INSERT — relies on UNIQUE (user_id, day_marker)
    const { error: insertErr } = await supabase
      .from("onboarding_emails_log")
      .insert({
        user_id: u.id,
        day_marker: marker,
        email: u.email,
        locale: userRow.locale,
      });

    if (insertErr) {
      if (insertErr.code === "23505") {
        // Already sent for this (user, day) — skip silently
        skipped++;
        continue;
      }
      logger.error(
        "onboarding-email.idempotency_insert_failed",
        { userId: u.id, marker },
        insertErr as Error,
      );
      failed++;
      continue;
    }

    // Send via Resend
    const { subject, html, unsubscribeUrl } = buildEmailHtml(userRow, marker);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: u.email,
          subject,
          html,
          // z187: RFC 8058 List-Unsubscribe + List-Unsubscribe-Post headers
          // (Gmail/Yahoo bulk sender requirement, 2024-)
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          tags: [
            { name: "type", value: "onboarding_sequence" },
            { name: "day", value: marker },
          ],
        }),
      });
      if (!res.ok) {
        failed++;
        logger.error(
          "onboarding-email.send_failed",
          { userId: u.id, marker, statusCode: res.status },
          new Error(`Resend HTTP ${res.status}`),
        );
        // Roll back the idempotency record so a future retry can send.
        await supabase
          .from("onboarding_emails_log")
          .delete()
          .eq("user_id", u.id)
          .eq("day_marker", marker);
        continue;
      }
      sent++;
      // z189: 全 cron 横断 frequency cap 用に記録
      await recordEmailSent(supabase, u.id, `onboarding_${marker}`, u.email, {
        locale: userRow.locale,
      });
      logger.info("onboarding-email.sent", {
        userId: u.id,
        marker,
        locale: userRow.locale,
      });
    } catch (err) {
      failed++;
      logger.error(
        "onboarding-email.send_threw",
        { userId: u.id, marker },
        err instanceof Error ? err : new Error(String(err)),
      );
      // Roll back idempotency on transient error
      await supabase
        .from("onboarding_emails_log")
        .delete()
        .eq("user_id", u.id)
        .eq("day_marker", marker);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: recentUsers.length,
    sent,
    skipped,
    failed,
  });
}
