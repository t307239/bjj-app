-- z197 (F-7): SECURITY DEFINER 関数から anon/authenticated/public の EXECUTE を REVOKE
--
-- 背景: z196 で 3 service-role-only テーブルの anon/authenticated 権限を REVOKE した結果、
-- advisor が新たに 4 件の WARN を surface:
--   - public.gyms_with_member_counts() — anon/authenticated 双方
--   - public.handle_new_user()        — anon/authenticated 双方
--
-- 安全性検証:
--   1. gyms_with_member_counts():
--      - Edge Function (supabase/functions/gym-milestone-email/index.ts L49-55) からのみ呼ばれる
--      - Edge Function は SUPABASE_SERVICE_ROLE_KEY で createClient — service_role には RLS/REVOKE 影響なし
--      - anon/authenticated が直接 /rest/v1/rpc/gyms_with_member_counts を叩く正当な理由なし (admin 集計)
--   2. handle_new_user():
--      - RETURNS trigger — auth.users INSERT trigger 経由のみ
--      - trigger は DEFINER 権限で実行されるため EXECUTE 権限不要
--      - anon/authenticated が /rest/v1/rpc/handle_new_user を直接呼ぶ用途は皆無
--
-- 対応:
REVOKE EXECUTE ON FUNCTION public.gyms_with_member_counts() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
