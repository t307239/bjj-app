import { NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAuth } from "@/lib/robust/auth";
import { currentBillingPeriod } from "@/lib/robust/attendance";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// auth: public — 本人のみ
export async function GET() {
  const auth = await requireRobustAuth();
  if (!auth.ok) return auth.response;

  const admin = createRobustAdminClient();

  // 自分の gym_members レコードを取得
  const { data: member } = await admin
    .from("gym_members")
    .select("id, plan_type, plan_cap")
    .eq("user_id", auth.userId)
    .eq("gym_id", GYM_ID)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "会員情報が見つかりません" }, { status: 404 });

  // 直近3ヶ月のチェックイン履歴
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: logs, error } = await admin
    .from("attendance_logs")
    .select("id, checked_in_at, class_type, billing_period, charged")
    .eq("member_id", member.id)
    .gte("checked_in_at", threeMonthsAgo.toISOString())
    .order("checked_in_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 今月の来館回数（保存される billing_period と同じ JST 基準で集計）
  const thisMonth = currentBillingPeriod();
  const thisMonthCount = (logs ?? []).filter(l => l.billing_period === thisMonth).length;

  // 年間出席数・来館頻度分析（依頼書 Section 8）: 直近12ヶ月を billing_period(JST) で集計。
  // Why: 3ヶ月の詳細ログとは別に、軽量な billing_period のみを12ヶ月分取得して集計する
  //      （詳細行を12ヶ月ぶん転送すると重いため、集計用は最小カラムに絞る）。
  const MONTHS_IN_YEAR = 12;
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - MONTHS_IN_YEAR);

  const { data: yearLogs } = await admin
    .from("attendance_logs")
    .select("billing_period")
    .eq("member_id", member.id)
    .eq("gym_id", GYM_ID)
    .gte("checked_in_at", twelveMonthsAgo.toISOString())
    .range(0, 4999);

  const byPeriod: Record<string, number> = {};
  for (const l of yearLogs ?? []) {
    byPeriod[l.billing_period] = (byPeriod[l.billing_period] ?? 0) + 1;
  }

  // 直近12ヶ月の期首キーを JST で生成し、来館0の月も埋める（棒グラフ表示用）。
  const nowJst = new Date(Date.now() + JST_OFFSET_MS);
  const monthly: { period: string; count: number }[] = [];
  for (let i = MONTHS_IN_YEAR - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth() - i, 1));
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthly.push({ period, count: byPeriod[period] ?? 0 });
  }
  const annualCount = monthly.reduce((sum, m) => sum + m.count, 0);
  // 平均来館数（月あたり・小数第1位）。頻度の目安として表示する。
  const avgPerMonth = Math.round((annualCount / MONTHS_IN_YEAR) * 10) / 10;

  return NextResponse.json({
    logs: logs ?? [],
    thisMonthCount,
    annualCount,
    avgPerMonth,
    monthly,
    planCap: member.plan_cap,
    planType: member.plan_type,
  });
}
