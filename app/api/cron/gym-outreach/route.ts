/**
 * GET /api/cron/gym-outreach
 *
 * z177: B2B PLG 自動メール — トップアプリ参考設計
 *
 * 【ベンチマーク】
 *   - Slack: 10K message → "Your team is too active for Free"
 *   - Notion: Guest 3+ joined → "Your team is growing"
 *   - Linear: 250 issue limit → "Your team uses Linear seriously" + usage stats
 *   - Hevy: Coach 5 athletes → "Coach 5 athletes for $X/mo"
 *
 * 【共通パターン】
 *   1. usage threshold trigger (人数 / 活動量)
 *   2. recipient = admin (gym_owner)
 *   3. loss aversion + 社会的証明 ("あなたのジム生徒 N 人使用中")
 *   4. 14-day trial / no credit card で friction 低減
 *   5. idempotency: 30 日に 1 回まで
 *
 * 【BJJ App での実装】
 *   - Trigger: gym のアクティブメンバー数 ≥ MEMBER_THRESHOLD (初期 3)
 *   - Recipient: gym.owner_id → auth.users.email
 *   - Idempotency: gyms.outreach_sent_at が 30 日以内なら skip
 *   - 既に B2B 契約済 (gym.is_active = true) のジムは skip
 *   - Resend API 経由 (既存 weekly-email と同じ pattern)
 *
 * Schedule: 毎週月曜 11:00 UTC = 20:00 JST (vercel.json で設定)
 * Security: CRON_SECRET verification via verifyCronAuth (z169 fail-closed)
 */

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cronAuth";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { signUnsubscribeToken } from "@/lib/unsubscribeToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@bjj-app.net";

// ── Tuning constants ──────────────────────────────────────────────────────
// Threshold = 3: MAU 初期は低めに、社会的証明として最低限。Slack も初期は 5。
// 後で MAU 増加に合わせて調整可 (10, 20...)。
const MEMBER_THRESHOLD = 3;
// Resend 30 日 cooldown — 同じジムへ何度も送らない。
const COOLDOWN_DAYS = 30;

// ── Types ───────────────────────────────────────────────────────────────────

type GymRow = {
  id: string;
  name: string;
  owner_id: string;
  is_active: boolean;
  outreach_sent_at: string | null;
  member_count: number;
  owner_email: string | null;
  owner_locale: string | null;
};

// ── Email HTML builder (locale-aware) ──────────────────────────────────────

function buildEmailHtml(gym: GymRow): { subject: string; html: string; unsubscribeUrl: string } {
  const isJa = (gym.owner_locale ?? "en") === "ja";
  const isPt = (gym.owner_locale ?? "en") === "pt";

  const trialUrl = `https://bjj-app.net/gym/upgrade?ref=plg_email&gym_id=${gym.id}`;

  let subject: string;
  let title: string;
  let lead: string;
  let valueProps: string[];
  let ctaLabel: string;
  let footer: string;

  if (isJa) {
    subject = `🥋 ${gym.name} の生徒 ${gym.member_count} 人が BJJ App を使用中`;
    title = `${gym.member_count} 人があなたのジムから記録を開始しました`;
    lead = `${gym.name} の生徒 ${gym.member_count} 人が BJJ App でトレーニングを記録しています。\n\nGym Premium ($99/月) なら、彼らの練習頻度・離脱リスク・帯昇格タイミングを一目で把握できます。`;
    valueProps = [
      "📊 全生徒の練習頻度を一覧表示",
      "🚨 2 週間来ない生徒を自動アラート (離脱率 50% 改善実績)",
      "📚 今週のテーマを全員のダッシュボードに固定",
      "🎯 帯昇格が近い生徒を AI が提案",
      "🔒 個人メモは秘匿、統計のみ可視化",
    ];
    ctaLabel = "14 日間 無料で試す →";
    footer = "クレジットカード不要 · いつでもキャンセル可 · 個人プランへの自動切替なし";
  } else if (isPt) {
    subject = `🥋 ${gym.member_count} alunos da ${gym.name} estão usando BJJ App`;
    title = `${gym.member_count} alunos do seu dojo começaram a registrar treinos`;
    lead = `${gym.member_count} alunos da ${gym.name} estão registrando treinos no BJJ App.\n\nCom Gym Premium ($99/mês), você vê a frequência, risco de evasão e momento de promoção de cada aluno.`;
    valueProps = [
      "📊 Frequência de treino de todos os alunos",
      "🚨 Alerta automático quando aluno some 2 semanas (-50% evasão)",
      "📚 Fixe o tema da semana no dashboard de todos",
      "🎯 IA sugere alunos prontos para promoção",
      "🔒 Notas pessoais ficam privadas, só estatísticas visíveis",
    ];
    ctaLabel = "Testar 14 dias grátis →";
    footer = "Sem cartão de crédito · Cancele a qualquer momento · Sem cobrança automática";
  } else {
    subject = `🥋 ${gym.member_count} students from ${gym.name} are tracking on BJJ App`;
    title = `${gym.member_count} students from your dojo started logging training`;
    lead = `${gym.member_count} students from ${gym.name} are logging training on BJJ App.\n\nWith Gym Premium ($99/mo), see frequency, churn risk, and promotion timing for every student.`;
    valueProps = [
      "📊 See every student's training frequency",
      "🚨 Auto-alert when a student vanishes 2+ weeks (-50% churn)",
      "📚 Pin this week's focus to every dashboard",
      "🎯 AI suggests students ready for promotion",
      "🔒 Personal notes stay private — only stats visible",
    ];
    ctaLabel = "Start 14-day free trial →";
    footer = "No credit card · Cancel anytime · No auto-charge";
  }

  const valueHtml = valueProps
    .map(
      (v) =>
        `<li style="margin:6px 0;color:#c8e6c9;font-size:14px;list-style:none;padding-left:0">${v}</li>`,
    )
    .join("");

  // z187: 1-click unsubscribe link
  const unsubToken = signUnsubscribeToken(gym.owner_id);
  const unsubscribeUrl = `https://bjj-app.net/api/unsubscribe?token=${unsubToken}`;
  const unsubLabel = isJa ? "配信停止" : isPt ? "Cancelar inscrição" : "Unsubscribe";

  const html = `<!DOCTYPE html>
<html lang="${gym.owner_locale ?? "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 18px;color:#10b981;line-height:1.3">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#e2e8f0;white-space:pre-line;margin:0 0 24px">${lead}</p>
    <ul style="background:#1e293b;border-radius:12px;padding:18px 22px;margin:0 0 28px">${valueHtml}</ul>
    <a href="${trialUrl}" style="display:block;text-align:center;background:#10b981;color:#fff;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:14px">${ctaLabel}</a>
    <p style="font-size:12px;color:#64748b;text-align:center;margin:0 0 8px">${footer}</p>
    <p style="font-size:11px;color:#64748b;text-align:center;margin:0"><a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline">${unsubLabel}</a></p>
  </div>
</body>
</html>`;

  return { subject, html, unsubscribeUrl };
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // z169: fail-closed CRON_SECRET
  const auth = verifyCronAuth(req);
  if (!auth.ok) return auth.response;

  if (!RESEND_API_KEY) {
    logger.warn("gym-outreach: RESEND_API_KEY not set, skipping");
    return NextResponse.json({ ok: true, skipped: true, reason: "no_api_key" });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Find gyms eligible for outreach:
  //    - is_active = false (not yet on Gym Premium)
  //    - member_count >= MEMBER_THRESHOLD
  //    - outreach_sent_at NULL OR > COOLDOWN_DAYS ago
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString();

  const { data: gymsRaw, error: gymsErr } = await supabase
    .from("gyms")
    .select("id, name, owner_id, is_active, outreach_sent_at")
    .eq("is_active", false)
    .or(`outreach_sent_at.is.null,outreach_sent_at.lt.${cooldownCutoff}`);

  if (gymsErr) {
    logger.error("gym-outreach.gyms_query_failed", {}, gymsErr as Error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!gymsRaw || gymsRaw.length === 0) {
    return NextResponse.json({ ok: true, eligible: 0, sent: 0 });
  }

  // 2. For each candidate gym, count active members + fetch owner email/locale
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const gym of gymsRaw) {
    // Member count (excluding deleted users)
    const { count: memberCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gym.id)
      .is("deleted_at", null);

    if ((memberCount ?? 0) < MEMBER_THRESHOLD) {
      skipped++;
      continue;
    }

    // Owner email + locale
    const { data: { user: ownerUser } } = await supabase.auth.admin.getUserById(gym.owner_id);
    if (!ownerUser?.email) {
      logger.warn("gym-outreach.no_owner_email", { gymId: gym.id });
      skipped++;
      continue;
    }
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("locale, email_marketing_opted_out")
      .eq("id", gym.owner_id)
      .single();

    // z187: opted-out user は send skip
    if (ownerProfile?.email_marketing_opted_out) {
      logger.info("gym-outreach.skipped_opted_out", { gymId: gym.id });
      skipped++;
      continue;
    }

    const gymRow: GymRow = {
      id: gym.id,
      name: gym.name,
      owner_id: gym.owner_id,
      is_active: gym.is_active,
      outreach_sent_at: gym.outreach_sent_at,
      member_count: memberCount ?? 0,
      owner_email: ownerUser.email,
      owner_locale: ownerProfile?.locale ?? "en",
    };

    const { subject, html, unsubscribeUrl } = buildEmailHtml(gymRow);

    // Send via Resend
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: ownerUser.email,
          subject,
          html,
          // z187: RFC 8058 (Gmail/Yahoo bulk sender 2024 要件)
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          tags: [
            { name: "type", value: "gym_outreach_plg" },
            { name: "gym_id", value: gym.id },
          ],
        }),
      });
      if (!res.ok) {
        failed++;
        logger.error(
          "gym-outreach.send_failed",
          { gymId: gym.id, statusCode: res.status },
          new Error(`Resend HTTP ${res.status}`),
        );
        continue;
      }
      sent++;
      // Mark as sent (idempotency for next 30 days)
      await supabase
        .from("gyms")
        .update({ outreach_sent_at: new Date().toISOString() })
        .eq("id", gym.id);
      logger.info("gym-outreach.sent", {
        gymId: gym.id,
        memberCount,
        locale: gymRow.owner_locale,
      });
    } catch (err) {
      failed++;
      logger.error(
        "gym-outreach.send_threw",
        { gymId: gym.id },
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: gymsRaw.length,
    sent,
    skipped,
    failed,
  });
}
