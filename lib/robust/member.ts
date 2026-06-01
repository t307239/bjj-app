// MemberService — 全モジュールの共通基盤（他から呼ばれる側）
import { createRobustServerClient } from "./supabase-server";
import type { Gym, GymMember } from "./types";

export async function getGymBySlug(slug: string): Promise<Gym | null> {
  const supabase = await createRobustServerClient();
  const { data, error } = await supabase
    .from("gyms")
    .select("id, owner_id, name, slug, plan_cap, overage_yen, features, created_at, updated_at")
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data as Gym;
}

export async function getMemberByQrToken(qrToken: string): Promise<GymMember | null> {
  const supabase = await createRobustServerClient();
  const { data, error } = await supabase
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
  const supabase = await createRobustServerClient();
  const { data, error } = await supabase
    .from("gym_members")
    .select("id, gym_id, user_id, email, name, plan_type, plan_cap, status, qr_token")
    .eq("user_id", userId)
    .eq("gym_id", gymId)
    .maybeSingle();
  if (error) return null;
  return data as GymMember | null;
}

export async function isGymFeatureEnabled(gymId: string, feature: string): Promise<boolean> {
  const supabase = await createRobustServerClient();
  const { data } = await supabase
    .from("gyms")
    .select("features")
    .eq("id", gymId)
    .single();
  return Array.isArray(data?.features) && data.features.includes(feature);
}
