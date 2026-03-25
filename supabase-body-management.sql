-- ============================================================
-- BJJ App — Body Management Feature Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. weight_logs: standalone daily weight records (e.g. morning weigh-in)
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight        NUMERIC(5,2) NOT NULL,       -- kg, e.g. 75.50
  measured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own weight_logs"
  ON public.weight_logs FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS weight_logs_user_time
  ON public.weight_logs (user_id, measured_at DESC);

-- ============================================================
-- 2. training_logs.weight — post-training weight (optional)
--    NOTE: The app's table is called `training_logs`, not
--          `training_sessions`. This column stores the weight
--          logged alongside a training session.
-- ============================================================
ALTER TABLE public.training_logs
  ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2);

-- ============================================================
-- 3. profiles.body_status — injury/condition heatmap (JSONB)
--    Shape: { "neck": "ok"|"sore"|"injured", "left_shoulder": ..., ... }
--    Parts: neck, left_shoulder, right_shoulder, left_elbow, right_elbow,
--           left_wrist, right_wrist, lower_back,
--           left_hip, right_hip, left_knee, right_knee,
--           left_ankle, right_ankle
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS body_status JSONB;
