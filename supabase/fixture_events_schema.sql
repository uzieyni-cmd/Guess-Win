-- ============================================================
-- Fixture Events — stores per-match events (cards, goals, etc.)
-- synced by /api/cron/sync-events every 2 hours
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists public.fixture_events (
  id             bigserial primary key,
  api_fixture_id int          not null,
  tournament_id  uuid         not null references public.tournaments(id) on delete cascade,
  type           text         not null,  -- 'Goal' | 'Card' | 'subst' | 'Var'
  detail         text         not null,  -- 'Yellow Card' | 'Red Card' | 'Normal Goal' | 'Penalty' | 'Own Goal' ...
  player_id      int,
  player_name    text,
  team_id        int,
  team_name      text,
  elapsed        int,
  synced_at      timestamptz  not null default now()
);

create index if not exists fixture_events_fixture_idx    on public.fixture_events(api_fixture_id);
create index if not exists fixture_events_tournament_idx on public.fixture_events(tournament_id);
create index if not exists fixture_events_type_idx       on public.fixture_events(tournament_id, type, detail);

-- RLS: service role only (no direct client reads needed — route reads via supabaseAdmin)
alter table public.fixture_events enable row level security;
