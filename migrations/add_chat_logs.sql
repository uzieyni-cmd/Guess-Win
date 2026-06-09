-- Chat usage logging table
create table if not exists public.chat_logs (
  id               uuid        default gen_random_uuid() primary key,
  user_id          uuid        references public.profiles(id) on delete set null,
  tournament_id    uuid        references public.tournaments(id) on delete set null,
  user_message     text,
  tokens_input     integer,
  tokens_output    integer,
  model            text        default 'perplexity/sonar-pro',
  created_at       timestamptz default now()
);

-- Indexes for fast admin queries
create index if not exists chat_logs_created_at_idx    on public.chat_logs(created_at desc);
create index if not exists chat_logs_user_id_idx       on public.chat_logs(user_id);
create index if not exists chat_logs_tournament_id_idx on public.chat_logs(tournament_id);

-- RLS
alter table public.chat_logs enable row level security;

-- Anyone (authenticated) can insert their own log
create policy "chat_logs_insert" on public.chat_logs
  for insert with check (true);

-- Only admins can read
create policy "chat_logs_admin_read" on public.chat_logs
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );
