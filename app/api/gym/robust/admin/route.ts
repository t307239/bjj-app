import { NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAdmin } from "@/lib/robust/auth";
import { currentBillingPeriod } from "@/lib/robust/attendance";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// 保険期限切れ警告の対象期間: 今日から30日以内に期限を迎える会員を「更新予定」として表示
const INSURANCE_EXPIRY_WARNING_DAYS = 30;

// auth: public — is_gym_staff_or_owner RLS で保護
export async function GET() {
  const auth = await requireRobustAdmin();
  if (!auth.ok) return auth.response;
  const admin = createRobustAdminClient();

  const billingPeriod = currentBillingPeriod();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 会員一覧 (今月の出欠数付き)
  const { data: members } = await admin
    .from("gym_members")
    .select(
      "id, name, email, plan_type, status, created_at, " +
      "attendance_logs(id, billing_period)"
    )
    .eq("gym_id", GYM_ID)
    .order("created_at", { ascending: false });

  // 保険期限切れ予定者: 期限切れ済み + 30日以内に期限を迎える active 会員
  // Why: スポーツ保険は年単位更新。期限切れに気づかず練習させると無保険事故のリスク。
  //      admin が事前に更新案内できるよう、期限が近い順に一覧化する。
  const warningCutoff = new Date();
  warningCutoff.setDate(warningCutoff.getDate() + INSURANCE_EXPIRY_WARNING_DAYS);
  const { data: insuranceExpiring } = await admin
    .from("gym_members")
    .select("id, name, insurance_expires_at, status")
    .eq("gym_id", GYM_ID)
    .eq("status", "active")
    .not("insurance_expires_at", "is", null)
    .lte("insurance_expires_at", warningCutoff.toISOString().slice(0, 10))
    .order("insurance_expires_at", { ascending: true });

  // 今日のチェックインログ
  const { data: todayLogs } = await admin
    .from("attendance_logs")
    .select("id, checked_in_at, class_type, gym_members(name, plan_type)")
    .eq("gym_id", GYM_ID)
    .gte("checked_in_at", todayStart.toISOString())
    .order("checked_in_at", { ascending: false });

  type MemberRow = {
    id: string; name: string; email: string; plan_type: string;
    status: string; created_at: string;
    attendance_logs: Array<{ billing_period: string }>;
  };
  // 会員ごとに今月出欠数を集計
  const membersWithCount = ((members as unknown as MemberRow[]) ?? []).map((m) => {
    const logs = m.attendance_logs ?? [];
    const monthCount = logs.filter(l => l.billing_period === billingPeriod).length;
    const { attendance_logs: _logs, ...rest } = m;
    void _logs;
    return { ...rest, month_count: monthCount };
  });

  return NextResponse.json({
    members: membersWithCount,
    todayLogs: todayLogs ?? [],
    insuranceExpiring: insuranceExpiring ?? [],
    billingPeriod,
  });
}
