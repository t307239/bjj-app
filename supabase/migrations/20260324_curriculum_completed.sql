-- Phase 3C gamification: curriculum completion tracking
-- Allows students to mark curriculum as "practiced" which:
--   1. Shows visual confirmation on the GymCurriculumCard
--   2. Appears on gym dashboard as engagement metric (future)
--
-- Design: one row per student, reused each time curriculum_set_at changes.
-- Comparison: completed_at vs gyms.curriculum_set_at tells if current curriculum is done.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS curriculum_completed_at TIMESTAMPTZ DEFAULT NULL;
