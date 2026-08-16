-- 006_add_push_subscriptions.sql
-- 依頼書 Section 15: プッシュ通知（会員デバイスの購読情報を保存）
-- Why: LINE公式の月1制限を解消し、休館/イベント/緊急連絡を回数無制限で配信するため、
--      会員の Web Push 購読(endpoint + 鍵)を会員に紐付けて保持する。
--      VAPID 鍵は本体 bjj-app と共用（新規発行不要）。endpoint は端末+ブラウザ単位で一意。
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  member_id  uuid not null references public.gym_members(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  timezone   text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now()
);

create index if not exists idx_push_sub_member on public.push_subscriptions (member_id);
create index if not exists idx_push_sub_gym on public.push_subscriptions (gym_id);

alter table public.push_subscriptions enable row level security;

create policy push_sub_staff_access on public.push_subscriptions
  using (is_gym_staff_or_owner(gym_id))
  with check (is_gym_staff_or_owner(gym_id));

create policy push_sub_self on public.push_subscriptions
  using (member_id in (select id from public.gym_members where user_id = auth.uid()))
  with check (member_id in (select id from public.gym_members where user_id = auth.uid()));
