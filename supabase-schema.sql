-- BJJ App データベーススキーマ
-- Supabase SQL Editor で実行してください

-- 練習記録テーブル
create table if not exists public.training_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  duration_min integer not null default 60,
  type text not null default 'gi', -- gi, nogi, drilling, competition, open_mat
  notes text default '',
  created_at timestamptz default now()
);

-- RLS (Row Level Security) を有効化
alter table public.training_logs enable row level security;

-- 自分のデータのみ読み書き可能
create policy "Users can view own training logs"
  on public.training_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own training logs"
  on public.training_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own training logs"
  on public.training_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own training logs"
  on public.training_logs for delete
  using (auth.uid() = user_id);

-- テクニック帳テーブル
create table if not exists public.techniques (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null default 'guard', -- guard, pass, submission, escape, takedown, back
  position text default '',
  notes text default '',
  mastery_level integer default 1, -- 1-5
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.techniques enable row level security;

create policy "Users can manage own techniques"
  on public.techniques for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- プロフィールテーブル
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  belt text default 'white', -- white, blue, purple, brown, black
  stripe integer default 0,
  gym text default '',
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can upsert own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ユーザー登録時に自動でプロフィール作成
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
