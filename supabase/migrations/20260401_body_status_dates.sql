-- body_status_dates: 各部位が最初に sore/injured になった日付を記録するカラム
-- InjuryCareAlert の "Day N" 計算をlocalStorage依存から脱却させるための永続化
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS body_status_dates jsonb DEFAULT '{}'::jsonb;
