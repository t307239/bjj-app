-- 002_secure_webhook_events_rls.sql
-- Supabase Security Advisor の Critical (rls_disabled_in_public) 解消。
-- webhook_events は Stripe webhook handler が service_role でのみ INSERT/DELETE する
-- 冪等性管理テーブル。RLS を有効化しポリシーを置かないことで anon/authenticated を
-- 完全遮断する（service_role は RLS をバイパスするため webhook 処理はそのまま動作）。

alter table public.webhook_events enable row level security;

-- 多層防御: PostgREST 経由の直接アクセス権限も剥奪
revoke all on table public.webhook_events from anon, authenticated;

-- 関数の search_path 可変警告(function_search_path_mutable)を解消
alter function public.set_updated_at() set search_path = public;
alter function public.is_gym_staff_or_owner(uuid) set search_path = public;

-- is_gym_staff_or_owner(SECURITY DEFINER) はログイン済み(authenticated)のみ実行可に。
-- PUBLIC 既定の EXECUTE があると anon でも RPC 経由で呼べてしまうため剥奪する。
revoke execute on function public.is_gym_staff_or_owner(uuid) from public;
grant execute on function public.is_gym_staff_or_owner(uuid) to authenticated;
