-- body_status: 各部位の状態 (ok/sore/injured) を記録するJSONBカラム
-- BodyHeatmap / InjuryCareAlert で使用
-- 既存の body_status_dates (20260401) と対になるカラム
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS body_status jsonb DEFAULT '{}'::jsonb;
