/**
 * lib/api/techniques.ts — Technique query helpers
 *
 * Pure data-fetching functions (no React state).
 * Usable from hooks, server components, API routes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TechniqueRow = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  mastery_level: number;
  notes: string | null;
  created_at: string;
};

export type TechniqueSummary = {
  totalCount: number;
  byCategory: Record<string, number>;
  byMastery: Record<number, number>;
};

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch all techniques for a user, ordered by name.
 */
export async function fetchTechniques(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: TechniqueRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("techniques")
    .select("id, user_id, name, category, mastery_level, notes, created_at")
    .eq("user_id", userId)
    .order("name");

  return { data: (data as TechniqueRow[]) ?? [], error: error?.message ?? null };
}

/**
 * Count techniques for a user (head-only query — no row data transferred).
 */
export async function countTechniques(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from("techniques")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return { count: count ?? 0, error: error?.message ?? null };
}

/**
 * Fetch a summary breakdown (count by category and mastery level).
 */
export async function fetchTechniqueSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: TechniqueSummary; error: string | null }> {
  const { data, error } = await supabase
    .from("techniques")
    .select("category, mastery_level")
    .eq("user_id", userId);

  if (error) {
    return {
      data: { totalCount: 0, byCategory: {}, byMastery: {} },
      error: error.message,
    };
  }

  const rows = (data ?? []) as { category: string; mastery_level: number }[];
  const byCategory: Record<string, number> = {};
  const byMastery: Record<number, number> = {};

  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    byMastery[r.mastery_level] = (byMastery[r.mastery_level] ?? 0) + 1;
  }

  return {
    data: { totalCount: rows.length, byCategory, byMastery },
    error: null,
  };
}
