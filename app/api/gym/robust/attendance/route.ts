import { NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAdmin } from "@/lib/robust/auth";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

type StaffRole = "owner" | "admin" | "instructor";

// auth: public — is_gym_staff_or_owner RLS で保護（requireRobustAdmin）
// インストラクターも閲覧・手動チェックインできる出欠確認用。
// Why: 売上・プラン金額などの金額系は一切返さない。インストラクターに不要かつ
//      見せるべきでない情報を API レベルで遮断する（画面側の制御に依存しない）。
export async function GET() {
  const auth = await requireRobustAdmin();
  if (!auth.ok) return auth.response;

  const admin = createRobustAdminClient();

  // 役割判定: gyms.owner_id 一致なら owner、なければ gym_staff の role
  let role: StaffRole = "instructor";
  const { data: gym } = await admin
    .from("gyms")
    .select("owner_id")
    .eq("id", GYM_ID)
    .maybeSingle();
  if (gym?.owner_id === auth.userId) {
    role = "owner";
  } else {
    const { data: staff } = await admin
      .from("gym_staff")
      .select("role")
      .eq("gym_id", GYM_ID)
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .maybeSingle();
    if (staff?.role === "admin" || staff?.role === "instructor") role = staff.role;
  }

  // 今日チェックイン済みの member_id 集合（JST 基準の「今日」）
  const { jstTodayStartUtc } = await import("@/lib/robust/attendance");
  const todayStart = jstTodayStartUtc();
  const { data: todayLogs } = await admin
    .from("attendance_logs")
    .select("member_id")
    .eq("gym_id", GYM_ID)
    .gte("checked_in_at", todayStart.toISOString());
  const checkedIn = new Set((todayLogs ?? []).map(l => l.member_id));

  // active 会員のみ（金額系は select しない）
  const { data: members } = await admin
    .from("gym_members")
    .select("id, name, plan_type")
    .eq("gym_id", GYM_ID)
    .eq("status", "active")
    .order("name", { ascending: true });

  const roster = (members ?? []).map(m => ({
    id: m.id,
    name: m.name,
    plan_type: m.plan_type,
    checked_in_today: checkedIn.has(m.id),
  }));

  return NextResponse.json({ role, roster });
}
