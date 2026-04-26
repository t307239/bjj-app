/**
 * emailRateLimit — z189: 全 email cron 共通の frequency cap helper
 *
 * 【目的】 7 個の cron が独立に send 判定するため、新規ジムオーナーは
 * 月曜に 4 emails 受信などの spam リスク。本 helper で全 cron が同じ
 * email_send_log を共有し、24h 以内の重複送信を物理的に防ぐ。
 *
 * 【使い方】
 *   import { canSendEmail, recordEmailSent } from "@/lib/emailRateLimit";
 *
 *   const allowed = await canSendEmail(supabase, userId, "onboarding_d3");
 *   if (!allowed) { skipped++; continue; }
 *   const res = await fetch("https://api.resend.com/emails", {...});
 *   if (res.ok) {
 *     await recordEmailSent(supabase, userId, "onboarding_d3", email);
 *   }
 *
 * 【重要】 send 成功時のみ recordEmailSent を呼ぶ (失敗時に record すると
 * 24h リトライ不可)。
 *
 * 【lint で強制】 detect_locale_drift.py Pattern 11 が
 * `fetch("https://api.resend.com/emails"` 周辺で canSendEmail / recordEmailSent
 * の呼び出しが無ければ 🔴 fail (z189)。
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_COOLDOWN_HOURS = 24;

/**
 * 直近 cooldown_hours 以内に user に「何らかの email」が送信されていないか確認。
 * type-specific cooldown はオプションで上書き可。
 *
 * @returns true = send OK / false = skip
 */
export async function canSendEmail(
  supabase: SupabaseClient,
  userId: string,
  emailType: string,
  cooldownHours: number = DEFAULT_COOLDOWN_HOURS,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownHours * 3600 * 1000).toISOString();

  // 全 type 横断で「最近 send したか」を確認 (spam ban 防止)
  const { count, error } = await supabase
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("sent_at", cutoff);

  if (error) {
    // フェイルセーフ: DB エラー時は send しない (spam リスク回避)
    return false;
  }
  return (count ?? 0) === 0;
}

/**
 * Send 成功後に呼ぶ。
 */
export async function recordEmailSent(
  supabase: SupabaseClient,
  userId: string,
  emailType: string,
  emailTo: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await supabase.from("email_send_log").insert({
    user_id: userId,
    email_type: emailType,
    email_to: emailTo,
    metadata: metadata ?? null,
  });
}
