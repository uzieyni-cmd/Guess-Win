-- PERF-06: עמודה לשמירת זמן הסנכרון האחרון per tournament
-- מאפשרת rate-limiting distributed בין instances serverless
alter table public.tournaments
  add column if not exists last_synced_at timestamptz;
