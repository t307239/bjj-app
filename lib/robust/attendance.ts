// AttendanceService — チェックイン・集計
import { format } from "date-fns";
import { createRobustAdminClient } from "./supabase";
import type { AttendanceLog, ClassType, GymMember } from "./types";
import { CHECKIN_COOLDOWN_MINUTES } from "./types";
import { addOverageToNextInvoice } from "./payments";

export function currentBillingPeriod(): string {
  return format(new Date(), "yyyy-MM");
}

/** 二重スキャン防止チェック（60分クールダウン） */
export async function isDuplicateCheckin(memberId: string): Promise<boolean> {
  const supabase = createRobustAdminClient();
  const since = new Date(Date.now() - CHECKIN_COOLDOWN_MINUTES * 60 * 1000).toISOString();
  // Why: head:true のとき data は null。count は別フィールドで返るため destructure が必要。
  //      data?.count は常に undefined → 永遠に重複検知しない silent bug だった。
  const { count } = await supabase
    .from("attendance_logs")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .gte("checked_in_at", since);
  return (count ?? 0) > 0;
}

export async function countThisMonthAttendance(memberId: string): Promise<number> {
  const supabase = createRobustAdminClient();
  const billingPeriod = currentBillingPeriod();
  const { count } = await supabase
    .from("attendance_logs")
    .select("*", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("billing_period", billingPeriod);
  return count ?? 0;
}

export async function checkIn(
  member: GymMember,
  gymId: string,
  classType?: ClassType
): Promise<{ log: AttendanceLog; overcharged: boolean; duplicate: boolean }> {
  const supabase = createRobustAdminClient();

  // 二重スキャン防止
  const duplicate = await isDuplicateCheckin(member.id);
  if (duplicate) {
    // ダミーログを返す（INSERT しない）
    return {
      log: { member_id: member.id, gym_id: gymId } as AttendanceLog,
      overcharged: false,
      duplicate: true,
    };
  }

  const billingPeriod = currentBillingPeriod();

  // Why: isDuplicateCheckin → INSERT の間に同時リクエストが到達すると二重 INSERT する。
  //      INSERT 直前に再チェックして競合ウィンドウを最小化する（楽観的ロック）。
  const doubleCheck = await isDuplicateCheckin(member.id);
  if (doubleCheck) {
    return { log: { member_id: member.id, gym_id: gymId } as AttendanceLog, overcharged: false, duplicate: true };
  }

  const { data: log, error } = await supabase
    .from("attendance_logs")
    .insert({
      member_id: member.id,
      gym_id: gymId,
      class_type: classType ?? null,
      billing_period: billingPeriod,
    })
    .select()
    .single();

  if (error || !log) throw new Error("チェックイン記録の作成に失敗しました");

  // 超過課金チェック（twice_weekly プランのみ）
  // Why: drop_in は subscription なし・単発参加のため上限・超過課金の概念が存在しない。
  //      stripe_subscription_id が null の会員で invoiceItems を作ると宙吊り invoice になる。
  let overcharged = false;
  if (member.plan_type === "twice_weekly" && member.plan_cap !== null) {
    const count = await countThisMonthAttendance(member.id);
    if (count > member.plan_cap && member.payment_method === "stripe") {
      await addOverageToNextInvoice(member, gymId);
      overcharged = true;
      // Why: charged フラグを true に更新しないと履歴画面の「超過」マークが出ない
      await supabase.from("attendance_logs").update({ charged: true }).eq("id", (log as { id: string }).id);
    }
  }

  return { log: log as AttendanceLog, overcharged, duplicate: false };
}
