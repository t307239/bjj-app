/**
 * lib/api/profiles.ts — Profile query helpers
 *
 * Pure data-fetching functions (no React state).
 * Usable from hooks, server components, API routes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DbProfile } from "@/lib/database.types";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Lightweight profile subset for display purposes. */
export type ProfileView = Pick<
  DbProfile,
  "belt" | "stripe" | "start_date" | "is_pro" | "gym_id" | "share_data_with_gym" | "weekly_goal"
> & {
  gym_name: string | null;
  bio: string | null;
};

/** Fields the user can update from the profile edit form. */
export type ProfileUpdatePayload = {
  belt?: string;
  stripe?: number;
  gym?: string;
  bio?: string;
  start_date?: string | null;
  weekly_goal?: number;
};

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's profile.
 * Includes belt, stripe, gym info, and subscription status.
 */
export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: DbProfile | null; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return { data: data as DbProfile | null, error: error?.message ?? null };
}

/**
 * Fetch only the Pro/subscription status fields (lightweight check).
 */
export async function fetchProStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ isPro: boolean; subscriptionStatus: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_pro, subscription_status")
    .eq("id", userId)
    .single();

  return {
    isPro: (data as { is_pro?: boolean })?.is_pro ?? false,
    subscriptionStatus: (data as { subscription_status?: string | null })?.subscription_status ?? null,
    error: error?.message ?? null,
  };
}

/**
 * Update profile fields for a user.
 * Only sends the fields present in `payload`.
 */
export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  payload: ProfileUpdatePayload,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId);

  return { error: error?.message ?? null };
}
