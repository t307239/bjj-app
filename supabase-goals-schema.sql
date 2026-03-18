-- GoalTracker コンポーネント用スキーマ
-- Supabase Dashboard > SQL Editor で実行してください

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS weekly_goal    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_goal  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS technique_goal INTEGER NOT NULL DEFAULT 0;
