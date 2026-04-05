-- ============================================================
-- Bonus bets feature
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists public.bonus_questions (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  type            text not null check (type in ('winner', 'top_scorer', 'custom')),
  question        text not null,
  options         jsonb not null default '[]',   -- string[]
  correct_option  text default null,             -- set by admin at end
  points          int  not null default 10,
  lock_time       timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.bonus_picks (
  id                  uuid primary key default gen_random_uuid(),
  bonus_question_id   uuid not null references public.bonus_questions(id) on delete cascade,
  tournament_id       uuid not null references public.tournaments(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  pick                text not null,
  points_awarded      int default null,          -- filled when admin marks result
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (bonus_question_id, user_id)
);

-- Indexes
create index if not exists bonus_questions_tournament_idx on public.bonus_questions(tournament_id);
create index if not exists bonus_picks_question_idx       on public.bonus_picks(bonus_question_id);
create index if not exists bonus_picks_user_idx           on public.bonus_picks(user_id);
create index if not exists bonus_picks_tournament_idx     on public.bonus_picks(tournament_id);

-- RLS
alter table public.bonus_questions enable row level security;
alter table public.bonus_picks     enable row level security;

-- bonus_questions: all authenticated users can read, only service role writes
create policy "bonus_questions_read" on public.bonus_questions
  for select using (auth.role() = 'authenticated');

-- bonus_picks: users read their own picks; service role writes
create policy "bonus_picks_read_own" on public.bonus_picks
  for select using (auth.uid() = user_id);

create policy "bonus_picks_insert_own" on public.bonus_picks
  for insert with check (auth.uid() = user_id);

create policy "bonus_picks_update_own" on public.bonus_picks
  for update using (auth.uid() = user_id);
