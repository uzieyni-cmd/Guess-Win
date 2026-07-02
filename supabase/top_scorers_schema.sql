-- ============================================================
-- Top Scorers — cached copy of API-Football /players/topscorers
-- synced by /api/cron/sync-top-scorers every 2 hours (19:00–07:00 IL)
-- keyed by competition (api_league_id + api_season), not tournament
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists public.top_scorers (
  id             bigserial primary key,
  api_league_id  int          not null,
  api_season     int          not null,
  rank           int          not null,
  player_id      int          not null,
  player_name    text         not null,
  photo          text,
  team_id        int,
  team_name      text,
  team_logo      text,
  goals          int          not null default 0,
  assists        int,
  penalties      int,
  appearances    int,
  synced_at      timestamptz  not null default now(),
  unique (api_league_id, api_season, player_id)
);

create index if not exists top_scorers_league_season_idx
  on public.top_scorers(api_league_id, api_season, rank);

-- RLS: service role only (routes read via supabaseAdmin)
alter table public.top_scorers enable row level security;
