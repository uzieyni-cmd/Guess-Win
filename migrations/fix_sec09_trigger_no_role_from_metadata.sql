-- SEC-09: תיקון אבטחה — הסרת קריאת role מ-metadata של משתמש חדש
--
-- לפני התיקון: trigger קרא את role מ-raw_user_meta_data
-- מה שאפשר למשתמש להירשם עם { data: { role: 'admin' } } ולקבל הרשאות admin
--
-- לאחר התיקון: role תמיד 'user' — ניתן לשדרג ל-admin רק ידנית דרך Supabase Dashboard

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    'user'  -- תמיד 'user' — role לעולם לא מגיע מ-metadata של הלקוח
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
