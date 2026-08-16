-- 008_add_member_photo.sql
-- 会員写真（本人確認・なりすまし/過少申告対策）
-- Why: チェックイン時や会員管理でスタッフが顔と名前を照合できるようにする。任意(NULL許容)。
alter table public.gym_members
  add column if not exists photo_url text;

-- 写真保存用の公開バケット（URLは member_id(uuid) ベースで推測困難）。
-- 厳格な非公開が必要になった場合は将来 signed URL 化を検討。
insert into storage.buckets (id, name, public)
values ('member-photos', 'member-photos', true)
on conflict (id) do nothing;
