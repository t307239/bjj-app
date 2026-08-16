-- 009_add_announcements.sql
-- お知らせ一覧（アプリ内で文字でも読める）: プッシュ配信の内容を保存
-- Why: プッシュを見逃した会員（通知OFF/iPhone未PWA/ポップアップ消去）も後から読めるように。
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  title      text not null,
  body       text not null,
  urgent     boolean not null default false,
  sent_by    uuid references auth.users(id),
  sent_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_announcements_gym on public.announcements (gym_id, created_at desc);

alter table public.announcements enable row level security;

create policy announcements_staff on public.announcements
  using (is_gym_staff_or_owner(gym_id))
  with check (is_gym_staff_or_owner(gym_id));

create policy announcements_member_read on public.announcements
  for select using (
    gym_id in (select gym_id from public.gym_members where user_id = auth.uid())
  );
