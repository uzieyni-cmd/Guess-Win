-- ============================================================
-- Guess&Win – Supabase Schema
-- הרץ את הקובץ הזה ב: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- פרופילים (מרחיב את auth.users של Supabase)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text not null,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- תחרויות
create table if not exists public.tournaments (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  logo_url text,
  description text,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed')),
  api_league_id integer,
  api_season integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- משתתפים בתחרות (many-to-many)
create table if not exists public.tournament_participants (
  tournament_id uuid references public.tournaments(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (tournament_id, user_id)
);

-- משחקים
create table if not exists public.matches (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  home_team_id text not null,
  home_team_name text not null,
  home_team_short text,
  home_team_flag text,
  away_team_id text not null,
  away_team_name text not null,
  away_team_short text,
  away_team_flag text,
  match_start_time timestamptz not null,
  status text not null default 'scheduled',
  actual_home_score integer,
  actual_away_score integer,
  api_fixture_id integer unique,
  created_at timestamptz default now()
);

-- ניחושים
create table if not exists public.bets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  predicted_home integer not null check (predicted_home >= 0),
  predicted_away integer not null check (predicted_away >= 0),
  submitted_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, match_id)
);

-- ============================================================
-- הפעלת Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.matches enable row level security;
alter table public.bets enable row level security;

-- Profiles
create policy "profiles_read" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Tournaments
create policy "tournaments_read" on public.tournaments for select using (true);
create policy "tournaments_admin" on public.tournaments for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- Tournament Participants
create policy "tp_read" on public.tournament_participants for select using (true);
create policy "tp_admin" on public.tournament_participants for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- Matches
create policy "matches_read" on public.matches for select using (true);
create policy "matches_admin" on public.matches for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- Bets: הניחוש נחשף לכולם 10 דקות לפני הקיקוף (מחושב server-side!)
create policy "bets_read" on public.bets for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.matches m
    where m.id = match_id
    and m.match_start_time <= now() + interval '10 minutes'
  )
);
create policy "bets_insert" on public.bets for insert with check (
  user_id = auth.uid()
  and not exists (
    select 1 from public.matches m
    where m.id = match_id
    and m.match_start_time <= now() + interval '10 minutes'
  )
);
create policy "bets_update" on public.bets for update using (
  user_id = auth.uid()
  and not exists (
    select 1 from public.matches m
    where m.id = match_id
    and m.match_start_time <= now() + interval '10 minutes'
  )
);
create policy "bets_admin" on public.bets for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- ============================================================
-- Trigger: יצירת פרופיל אוטומטית עם הרשמה
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
