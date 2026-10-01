import { NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAdmin } from "@/lib/robust/auth";
import { currentBillingPeriod, jstTodayStartUtc } from "@/lib/robust/attendance";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// 保険期限切れ警告の対象期間: 今日から30日以内に期限を迎える会員を「更新予定」として表示
const INSURANCE_EXPIRY_WARNING_DAYS = 30;

// auth: public — is_gym_staff_or_owner RLS で保護
export async function GET() {
  const auth = await requireRobustAdmin();
  if (!auth.ok) return auth.response;
  const admin = createRobustAdminClient();

  const billingPeriod = currentBillingPeriod();
  const todayStart = jstTodayStartUtc();

  // 保険期限切れ予定者: 期限切れ済み + 30日以内に期限を迎える active 会員
  // Why: スポーツ保険は年単位更新。期限切れに気づかず練習させると無保険事故のリスク。
  //      admin が事前に更新案内できるよう、期限が近い順に一覧化する。
  const warningCutoff = new Date();
  warningCutoff.setDate(warningCutoff.getDate() + INSURANCE_EXPIRY_WARNING_DAYS);

  // Why: 以下5クエリは互いに依存しない。直列だと DB 往復(RTT)×5 かかるため Promise.all で並列化する
  //      （管理画面の初回表示の主なボトルネック）。
  const [gymRes, staffRes, membersRes, insuranceRes, todayLogsRes] = await Promise.all([
    // 呼び出し元の役割（owner / admin / instructor）判定用。UI でメニュー出し分けに使う
    admin.from("gyms").select("owner_id").eq("id", GYM_ID).maybeSingle(),
    admin
      .from("gym_staff")
      .select("role")
      .eq("gym_id", GYM_ID)
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .maybeSingle(),
    // 会員一覧 (今月の出欠数付き)
    // Why: 出席履歴は年単位で蓄積するため、全期間を埋め込むと会員数×全出席行を毎回転送して重くなる。
    //      埋め込みを当月(billing_period)だけに絞る（過去データはDBに残り、必要時に履歴画面で取得）。
    //      埋め込みフィルタは left join のままなので、当月出席0の会員も一覧に残る。
    admin
      .from("gym_members")
      .select("id, name, email, plan_type, status, created_at, attendance_logs(id)")
      .eq("gym_id", GYM_ID)
      .eq("attendance_logs.billing_period", billingPeriod)
      .order("created_at", { ascending: false }),
    admin
      .from("gym_members")
      .select("id, name, insurance_expires_at, status")
      .eq("gym_id", GYM_ID)
      .eq("status", "active")
      .not("insurance_expires_at", "is", null)
      .lte("insurance_expires_at", warningCutoff.toISOString().slice(0, 10))
      .order("insurance_expires_at", { ascending: true }),
    // 今日のチェックインログ
    admin
      .from("attendance_logs")
      .select("id, checked_in_at, class_type, gym_members(name, plan_type)")
      .eq("gym_id", GYM_ID)
      .gte("checked_in_at", todayStart.toISOString())
      .order("checked_in_at", { ascending: false }),
  ]);

  // owner 判定を優先（従来と同じ優先順位: owner > staff の role > instructor）
  let role: "owner" | "admin" | "instructor" = "instructor";
  if (gymRes.data?.owner_id === auth.userId) {
    role = "owner";
  } else if (staffRes.data?.role === "admin" || staffRes.data?.role === "instructor") {
    role = staffRes.data.role;
  }
  const members = membersRes.data;
  const insuranceExpiring = insuranceRes.data;
  const todayLogs = todayLogsRes.data;

  type MemberRow = {
    id: string;
    name: string;
    email: string;
    plan_type: string;
    status: string;
    created_at: string;
    attendance_logs: Array<{ id: string }>; // 当月分のみ（クエリで絞り込み済み）
  };
  // 会員ごとに今月出欠数を集計（埋め込みは当月分のみなので件数=今月回数）
  const membersWithCount = ((members as unknown as MemberRow[]) ?? []).map((m) => {
    const monthCount = (m.attendance_logs ?? []).length;
    const { attendance_logs: _logs, ...rest } = m;
    void _logs;
    return { ...rest, month_count: monthCount };
  });

  return NextResponse.json({
    members: membersWithCount,
    todayLogs: todayLogs ?? [],
    insuranceExpiring: insuranceExpiring ?? [],
    role,
    billingPeriod,
  });
}
