-- 2026/04/07: Add timezone column to profiles table
-- T-33: タイムゾーン一貫性改善
--
-- 背景: ユーザーのローカルタイムゾーン（Asia/Tokyo, America/New_York等）を保存する。
--       ProfileForm でユーザーが選択可能にして、アプリ全体で一貫性のある時刻計算を実現。
--       デフォルト: User Agent から推定される値。なければ UTC を使用。

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

COMMENT ON COLUMN profiles.timezone IS
  'IANA timezone string (e.g. "Asia/Tokyo", "America/New_York"). '
  'Used by client-side timezone utilities to ensure consistent local date calculations. '
  'Default: UTC. User can select via ProfileForm.';
