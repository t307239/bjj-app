// MemberService — 全モジュールの共通基盤（他から呼ばれる側）
// Why: member.ts の全関数はサーバーサイド lookup。
//      gym_members/gyms テーブルは RLS で is_gym_staff_or_owner のみ許可されるため、
//      anon/user client では取得不可。service role (admin client) で明示的なフィルタを使用する。
import { createRobustAdminClient } from "./supabase";
import type { Gym, GymMember } from "./types";

export async function getGymBySlug(slug: string): Promise<Gym | null> {
  // Why: gyms テーブルの RLS は is_gym_staff_or_owner のみ許可。
  //      登録フロー中のユーザーはまだ staff/owner でないため anon client では取得不可。
  //      service role でジム情報を公開 lookup する。
  const admin = createRobustAdminClient();
  const { data, error } = await admin
    .from("gyms")
    .select("id, owner_id, name, slug, plan_cap, overage_yen, features, created_at, updated_at")
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data as Gym;
}

export async function getMemberByQrToken(qrToken: string): Promise<GymMember | null> {
  // Why: checkin は auth:public エンドポイント。anon key では gym_members の RLS が通らないため admin client を使用。
  const admin = createRobustAdminClient();
  const { data, error } = await admin
    .from("gym_members")
    .select(
      "id, gym_id, user_id, email, name, stripe_customer_id, stripe_subscription_id, " +
      "default_payment_method_id, payment_method, qr_token, plan_type, plan_cap, status"
    )
    .eq("qr_token", qrToken)
    .eq("status", "active")
    .single();
  if (error) return null;
  return data as unknown as GymMember;
}

export async function getMemberByUserId(userId: string, gymId: string): Promise<GymMember | null> {
  // Why: server-side lookup。self-read RLS (user_id = auth.uid()) はサーバー側では
  //      cookie 経由セッションが必要だが、admin client で明示的に userId フィルタすれば同等の安全性を確保できる。
  const admin = createRobustAdminClient();
  const { data, error } = await admin
    .from("gym_members")
    .select("id, gym_id, user_id, email, name, plan_type, plan_cap, status, qr_token")
    .eq("user_id", userId)
    .eq("gym_id", gymId)
    .maybeSingle();
  if (error) return null;
  return data as GymMember | null;
}

export async function isGymFeatureEnabled(gymId: string, feature: string): Promise<boolean> {
  // Why: gyms テーブルの RLS は is_gym_staff_or_owner のみ。server-side lookup のため admin client を使用。
  const admin = createRobustAdminClient();
  const { data } = await admin
    .from("gyms")
    .select("features")
    .eq("id", gymId)
    .single();
  return Array.isArray(data?.features) && data.features.includes(feature);
}
