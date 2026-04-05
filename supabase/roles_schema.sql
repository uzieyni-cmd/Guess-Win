-- ============================================================
-- Role management feature
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Expand allowed roles in profiles table
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'owner', 'tournament_admin'));

-- 2. Set your owner account (replace with your actual user email)
-- UPDATE public.profiles SET role = 'owner' WHERE email = 'your@email.com';

-- 3. Tournament admins junction table
CREATE TABLE IF NOT EXISTS public.tournament_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS tournament_admins_tournament_idx ON public.tournament_admins(tournament_id);
CREATE INDEX IF NOT EXISTS tournament_admins_user_idx       ON public.tournament_admins(user_id);

-- RLS
ALTER TABLE public.tournament_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_admins_read" ON public.tournament_admins
  FOR SELECT USING (auth.role() = 'authenticated');
