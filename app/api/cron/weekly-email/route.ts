/**
 * GET /api/cron/weekly-email
 *
 * Called weekly by Vercel Cron (every Monday 10:00 UTC = 19:00 JST).
 * Sends a personalized weekly training summary email to users who:
 *   1. Have an email address (Supabase Auth)
 *   2. Trained at least once in the past 7 days
 *   3. Haven't opted out (notification_preferences.weekly_email !== false)
 *
 * Uses Resend API directly via fetch (no SDK dependency).
 *
 * Security: CRON_SECRET verification (Vercel injects Authorization header).
 */

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cronAuth";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@bjj-app.net";

// ── Auth ────────────────────────────────────────────────────────────────────

`;
}

// ── Types ───────────────────────────────────────────────────────────────────

type WeeklySummary = {
  userId: string;
  email: string;
  totalSessions: number;
  totalMinutes: number;
  types: Record<string, number>;
  streak: number;
  locale: string;
};

// ── Email HTML builder ──────────────────────────────────────────────────────

function buildEmailHtml(summary: WeeklySummary): string {
  const isJa = summary.locale === "ja";

  const typeSummary = Object.entries(summary.types)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  const title = isJa ? "今週のトレーニングサマリー 🥋" : "Your Weekly Training Summary 🥋";
  const sessionsLabel = isJa ? "セッション" : "sessions";
  const minutesLabel = isJa ? "分" : "min";
  const streakLabel = isJa ? "連続記録" : "streak";
  const typesLabel = isJa ? "タイプ別" : "By type";
  const ctaText = isJa ? "ダッシュボードを見る →" : "View Dashboard →";
  const footerText = isJa
    ? "この通知を停止するにはアプリの設定で「週報メール」をオフにしてください。"
    : "To unsubscribe, turn off weekly email in your app settings.";

  return `<!DOCTYPE html>
<html lang="${summary.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;margin:0 0 24px;color:#10b981">${title}</h1>
    <div style="background:#1e293b;border-radius:12px;padding:24px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <div style="text-align:center;flex:1">
          <div style="font-size:32px;font-weight:700;color:#fff">${summary.totalSessions}</div>
          <div style="font-size:13px;color:#94a3b8">${sessionsLabel}</div>
        </div>
        <div style="text-align:center;flex:1">
          <div style="font-size:32px;font-weight:700;color:#10b981">${summary.totalMinutes}</div>
          <div style="font-size:13px;color:#94a3b8">${minutesLabel}</div>
        </div>
        <div style="text-align:center;flex:1">
          <div style="font-size:32px;font-weight:700;color:#f59e0b">${summary.streak}</div>
          <div style="font-size:13px;color:#94a3b8">${streakLabel}</div>
        </div>
      </div>
      <div style="font-size:13px;color:#94a3b8">${typesLabel}: ${typeSummary}</div>
    </div>
    <a href="https://bjj-app.net/dashboard" style="display:block;text-align:center;background:#10b981;color:#fff;padding:14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${ctaText}</a>
    <p style="font-size:11px;color:#64748b;text-align:center;margin-top:24px">${footerText}</p>
  </div>
</body>
</html>`;
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // z169: fail-closed CRON_SECRET
  const __cronAuth = verifyCronAuth(req);
  if (!__cronAuth.ok) return __cronAuth.response;

  if (!RESEND_API_KEY) {
    logger.warn("weekly-email: RESEND_API_KEY not set, skipping");
    return NextResponse.json({ ok: true, skipped: true, reason: "no_api_key" });
  }

  const log = logger.child({ scope: "cron/weekly-email" });
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Get users with training in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: logs, error: logsErr } = await supabase
    .from("training_logs")
    .select("user_id, date, duration_min, type")
    .gte("date", sevenDaysAgo);

  if (logsErr) {
    log.error("Failed to fetch training logs", { error: logsErr.message });
    return NextResponse.json({ error: logsErr.message }, { status: 500 });
  }

  if (!logs || logs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_active_users" });
  }

  // 2. Group by user
  const userMap = new Map<string, { sessions: number; minutes: number; types: Record<string, number>; dates: Set<string> }>();
  for (const row of logs) {
    const u = userMap.get(row.user_id) ?? { sessions: 0, minutes: 0, types: {}, dates: new Set() };
    u.sessions++;
    u.minutes += row.duration_min ?? 0;
    u.types[row.type] = (u.types[row.type] ?? 0) + 1;
    u.dates.add(row.date);
    userMap.set(row.user_id, u);
  }

  // 3. Get user emails and locale from auth + profiles
  const userIds = Array.from(userMap.keys());
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) {
    log.error("Failed to list auth users", { error: authErr.message });
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  const emailMap = new Map<string, string>();
  for (const u of authData.users) {
    if (u.email && userIds.includes(u.id)) {
      emailMap.set(u.id, u.email);
    }
  }

  // 4. Check notification preferences (opt-out)
  const { data: pushSubs } = await supabase
    .from("push_subscriptions")
    .select("user_id, notification_preferences")
    .in("user_id", userIds);

  const optedOut = new Set<string>();
  if (pushSubs) {
    for (const sub of pushSubs) {
      const prefs = sub.notification_preferences as Record<string, boolean> | null;
      if (prefs?.weekly_email === false) {
        optedOut.add(sub.user_id);
      }
    }
  }

  // 5. Calculate streaks and send emails
  let sent = 0;
  let failed = 0;

  for (const [userId, stats] of userMap) {
    const email = emailMap.get(userId);
    if (!email || optedOut.has(userId)) continue;

    // Simple streak: consecutive days ending today or yesterday
    const sortedDates = Array.from(stats.dates).sort().reverse();
    let streak = 0;
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); // JST
    const yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000).toISOString().slice(0, 10);
    if (sortedDates[0] === today || sortedDates[0] === yesterday) {
      streak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diff = (prev.getTime() - curr.getTime()) / 86400000;
        if (diff <= 1) streak++;
        else break;
      }
    }

    // Detect locale (default to ja for Japanese emails)
    const locale = email.endsWith(".jp") || email.includes("@docomo") || email.includes("@softbank") ? "ja" : "ja"; // Default ja for now

    const summary: WeeklySummary = {
      userId,
      email,
      totalSessions: stats.sessions,
      totalMinutes: stats.minutes,
      types: stats.types,
      streak,
      locale,
    };

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `BJJ App <${FROM_EMAIL}>`,
          to: [email],
          subject: locale === "ja"
            ? `🥋 今週の練習: ${stats.sessions}セッション・${stats.minutes}分`
            : `🥋 This week: ${stats.sessions} sessions, ${stats.minutes} min`,
          html: buildEmailHtml(summary),
        }),
      });

      if (res.ok) {
        sent++;
      } else {
        const errText = await res.text();
        log.warn("Resend API error", { userId, status: res.status, error: errText });
        failed++;
      }
    } catch (err) {
      log.error("Failed to send weekly email", { userId, error: String(err) });
      failed++;
    }
  }

  log.info("Weekly email cron complete", { sent, failed, total: userMap.size });
  return NextResponse.json({ ok: true, sent, failed, total: userMap.size });
}
