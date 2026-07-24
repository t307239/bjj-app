-- 005_add_belt_stripes_and_history.sql
-- 依頼書 Section 9・10: 帯・ストライプ管理 + 昇格履歴管理
-- Why: BJJ の帯(白青紫茶黒)とストライプ(0-4本)をオーナーが変更し会員に表示、
--      変更の都度その履歴を時系列で残す。値は CHECK 制約で不正混入を防ぐ。

-- 現在の帯・ストライプ（gym_members に保持）
alter table public.gym_members
  add column if not exists belt text not null default 'white'
    check (belt in ('white','blue','purple','brown','black')),
  add column if not exists stripes smallint not null default 0
    check (stripes between 0 and 4);

-- 昇格履歴テーブル
create table if not exists public.belt_history (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  member_id   uuid not null references public.gym_members(id) on delete cascade,
  belt        text not null check (belt in ('white','blue','purple','brown','black')),
  stripes     smallint not null check (stripes between 0 and 4),
  promoted_on date not null default (now() at time zone 'Asia/Tokyo')::date,
  note        text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_belt_history_member on public.belt_history (member_id, promoted_on desc);

alter table public.belt_history enable row level security;

-- オーナー・スタッフ: 自ジムの履歴を全操作可
create policy belt_history_staff_access on public.belt_history
  using (is_gym_staff_or_owner(gym_id))
  with check (is_gym_staff_or_owner(gym_id));

-- 会員本人: 自分の履歴を閲覧可
create policy belt_history_self_read on public.belt_history
  for select using (
    member_id in (select id from public.gym_members where user_id = auth.uid())
  );
