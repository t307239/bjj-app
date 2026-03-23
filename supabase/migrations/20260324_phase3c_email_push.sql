-- Phase 3C: B2B 自動メール + Web Push サブスクリプション
-- gyms: outreach tracking column
-- push_subscriptions: PWA Web Push endpoint storage

-- 1. gyms テーブル: 自動メール送信追跡カラム
ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS outreach_sent_at TIMESTAMPTZ DEFAULT NULL;

-- outreach_sent_at = NULL → 未送信
-- outreach_sent_at IS NOT NULL → 送信済み (再送しない)

-- 2. RPC: gyms_with_member_counts — 道場ごとの会員数集計
--    Edge Function からコールする。outreach_sent_at IS NULL のみ返す。
CREATE OR REPLACE FUNCTION gyms_with_member_counts()
RETURNS TABLE (id UUID, name TEXT, member_count BIGINT)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    g.id,
    g.name,
    COUNT(p.id) AS member_count
  FROM gyms g
  JOIN profiles p ON p.gym_id = g.id
  WHERE g.outreach_sent_at IS NULL
  GROUP BY g.id, g.name
  HAVING COUNT(p.id) >= 10;
$$;

-- 3. push_subscriptions テーブル: PWA Web Push 購読情報
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  p256dh        TEXT NOT NULL,
  auth_key      TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- RLS: ユーザー自身のみ参照・挿入・削除可
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_owner" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Edge Function (service_role) からの全操作を許可
CREATE POLICY "push_subscriptions_service" ON push_subscriptions
  FOR ALL USING (auth.role() = 'service_role');
