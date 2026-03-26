-- ============================================================
-- Migration: הוספת avatar_url לטבלת profiles
-- הרץ ב: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. הוספת העמודה לטבלה
alter table public.profiles
  add column if not exists avatar_url text;

-- 2. יצירת bucket לתמונות פרופיל (ב-Storage)
-- בצע זאת ב-Supabase Dashboard → Storage → Create bucket
-- שם: avatars
-- Public bucket: true

-- 3. הרשאות Storage (RLS על ה-bucket)
-- אחרי יצירת ה-bucket הרץ:

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- אפשר למשתמשים להעלות את הקובץ שלהם
create policy "avatar_upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- אפשר למשתמשים לעדכן את הקובץ שלהם
create policy "avatar_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- קריאה פומבית
create policy "avatar_read" on storage.objects
  for select using (bucket_id = 'avatars');
