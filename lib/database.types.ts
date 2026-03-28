/**
 * Centralized database type definitions for Supabase tables.
 *
 * These types mirror the Supabase schema and should be the single source
 * of truth for all database row types used across components and lib.
 *
 * TODO: Replace with `npx supabase gen types typescript` when CI/CD is set up.
 *       Command: npx supabase gen types typescript --project-id <id> > lib/database.types.ts
 */

// ─── technique_nodes ──────────────────────────────────────────────────────────
export type DbTechniqueNode = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  pos_x: number;
  pos_y: number;
  mastery_level: number | null; // 0=Locked, 1=Learning, 2=Mastered (nullable for legacy rows)
  created_at: string;
};

// ─── technique_edges ──────────────────────────────────────────────────────────
export type DbTechniqueEdge = {
  id: string;
  user_id: string;
  source_id: string;
  target_id: string;
  label: string | null;
  created_at: string;
};

// ─── profiles ─────────────────────────────────────────────────────────────────
export type DbProfile = {
  id: string;
  belt: string;
  stripe: number;
  start_date: string | null;
  is_pro: boolean;
  gym_name: string | null;
  weekly_goal: number;
  gym_id: string | null;
  gym_kick_notified: boolean | null;
  share_data_with_gym: boolean;
  signup_source: string | null;
  referral_code: string | null;
  created_at: string;
};

// ─── training_logs ────────────────────────────────────────────────────────────
export type DbTrainingLog = {
  id: string;
  user_id: string;
  date: string;
  duration_min: number;
  type: string;
  notes: string;
  instructor: string | null;
  partner: string | null;
  created_at: string;
};

// ─── gyms ─────────────────────────────────────────────────────────────────────
export type DbGym = {
  id: string;
  owner_id: string;
  name: string;
  invite_code: string;
  plan: string;
  curriculum_url: string | null;
  curriculum_set_at: string | null;
  created_at: string;
};

// ─── techniques ───────────────────────────────────────────────────────────────
export type DbTechnique = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  mastery_level: number;
  notes: string | null;
  video_url: string | null;
  created_at: string;
};

// ─── ugc_video_submissions ────────────────────────────────────────────────────
export type DbUgcVideoSubmission = {
  id: string;
  slug: string;
  lang: string;
  youtube_url: string;
  video_id: string;
  status: "pending" | "approved" | "rejected";
  ai_score: number | null;
  ai_notes: string | null;
  submitter_ip: string | null;
  created_at: string;
  reviewed_at: string | null;
};
