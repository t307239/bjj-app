-- RLS ポリシー確認クエリ
-- Supabase Dashboard > SQL Editor で実行してポリシーを確認

-- 現在のRLSポリシー一覧
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- RLSが有効なテーブル確認
SELECT 
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class 
WHERE relnamespace = 'public'::regnamespace 
  AND relkind = 'r'
ORDER BY relname;

-- 各テーブルに必要なポリシー（参考）
-- training_logs: SELECT/INSERT/UPDATE/DELETE (auth.uid() = user_id)
-- techniques:    SELECT/INSERT/UPDATE/DELETE (auth.uid() = user_id)
-- profiles:      SELECT/INSERT/UPDATE (auth.uid() = id)
