-- 2026/03/30: push_subscriptions にタイムゾーン列を追加
-- Notification Terrorism 防止: 送信側 Edge Function がローカル時刻 22:00-08:00 を
-- サイレント時間帯として除外できるようにするための前提条件。
--
-- 背景: VAPID 鍵を設定する前にこのマイグレーションを適用すること。
--       timezone が保存されていないまま通知を送ると深夜 3 時に配信される可能性がある。

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

COMMENT ON COLUMN push_subscriptions.timezone IS
  'IANA timezone string (e.g. "Asia/Tokyo"). '
  'Used by the push-sender Edge Function to enforce silent hours (22:00-08:00 local).';
