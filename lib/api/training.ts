/**
 * lib/api/training.ts — Training log query helpers
 *
 * Pure data-fetching functions (no React state).
 * Usable from hooks, server components, API routes, and CsvExport.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DbTrainingLog } from "@/lib/database.types";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TrainingLogRow = Pick<
  DbTrainingLog,
  "id" | "user_id" | "date" | "duration_min" | "type" | "notes" | "created_at"
>;

export type TrainingSummary = {
  totalSessions: number;
  totalMinutes: number;
  /** Earliest log date (ISO string) */
  dateFrom: string | null;
  /** Latest log date (ISO string) */
  dateTo: string | null;
};

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch all training logs for a user, newest first.
 * Optionally limited to `limit` rows.
 */
export async function fetchTrainingLogs(
  supabase: SupabaseClient,
  userId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ data: TrainingLogRow[]; error: string | null }> {
  let query = supabase
    .from("training_logs")
    .select("id, user_id, date, duration_min, type, notes, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (opts?.limit) query = query.limit(opts.limit);
  if (opts?.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);

  const { data, error } = await query;
  return { data: (data as TrainingLogRow[]) ?? [], error: error?.message ?? null };
}

/**
 * Fetch a summary of a user's training (total sessions, minutes, date range).
 * Uses a single lightweight query (only `date` and `duration_min`).
 */
export async function fetchTrainingSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: TrainingSummary; error: string | null }> {
  const { data, error } = await supabase
    .from("training_logs")
    .select("date, duration_min")
    .eq("user_id", userId)
    .order("date", { ascending: true });

  if (error) {
    return {
      data: { totalSessions: 0, totalMinutes: 0, dateFrom: null, dateTo: null },
      error: error.message,
    };
  }

  const rows = (data ?? []) as { date: string; duration_min: number }[];
  const totalMinutes = rows.reduce((s, r) => s + (r.duration_min ?? 0), 0);

  return {
    data: {
      totalSessions: rows.length,
      totalMinutes,
      dateFrom: rows[0]?.date ?? null,
      dateTo: rows[rows.length - 1]?.date ?? null,
    },
    error: null,
  };
}

/**
 * Count training logs for a user (head-only query — no row data transferred).
 */
export async function countTrainingLogs(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from("training_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return { count: count ?? 0, error: error?.message ?? null };
}
