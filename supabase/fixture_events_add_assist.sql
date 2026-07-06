-- ============================================================
-- Add assist provider to fixture_events
-- Enables computing top scorers (goals + assists) from our own
-- event data instead of the unreliable API /players/topscorers.
-- Run this in Supabase SQL Editor BEFORE deploying the updated crons.
-- Additive + nullable — safe to run on a live table.
-- ============================================================

alter table public.fixture_events
  add column if not exists assist_player_id   int,
  add column if not exists assist_player_name text;

-- מאיץ צבירת מלכי שערים לפי אירועי גול
create index if not exists fixture_events_goal_idx
  on public.fixture_events (tournament_id, type)
  where type = 'Goal';
