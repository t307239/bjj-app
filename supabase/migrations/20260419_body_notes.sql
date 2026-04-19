-- body_notes: 各部位の任意メモ (例: {"left_knee": "内側靭帯あたり"})
-- body_status / body_status_dates と同じパターン
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS body_notes jsonb DEFAULT '{}'::jsonb;
