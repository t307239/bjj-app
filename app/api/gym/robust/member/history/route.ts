import { NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAuth } from "@/lib/robust/auth";

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

  // 今月の来館回数
  const now = new Date();
  const currentBillingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthCount = (logs ?? []).filter(l => l.billing_period === currentBillingPeriod).length;

  return NextResponse.json({
    logs: logs ?? [],
    thisMonthCount,
    planCap: member.plan_cap,
    planType: member.plan_type,
  });
}
