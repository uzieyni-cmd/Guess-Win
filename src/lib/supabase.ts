import { createClient } from '@supabase/supabase-js'

// ── Client-side Supabase (uses anon key + user JWT, respects RLS) ──
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Database row types ─────────────────────────────────────────────

export type DbProfile = {
  id: string
  display_name: string
  email: string
  role: 'user' | 'admin'
  created_at: string
}

export type DbTournament = {
  id: string
  name: string
  logo_url: string | null
  description: string | null
  status: 'upcoming' | 'active' | 'completed'
  is_hidden: boolean
  api_league_id: number | null
  api_season: number | null
  created_at: string
  updated_at: string
}

export type DbMatch = {
  id: string
  tournament_id: string
  home_team_id: string
  home_team_name: string
  home_team_short: string | null
  home_team_flag: string | null
  away_team_id: string
  away_team_name: string
  away_team_short: string | null
  away_team_flag: string | null
  match_start_time: string
  status: string
  actual_home_score: number | null
  actual_away_score: number | null
  api_fixture_id: number | null
  round: string | null
  created_at: string
}

export type DbBet = {
  id: string
  user_id: string
  match_id: string
  tournament_id: string
  predicted_home: number
  predicted_away: number
  submitted_at: string
  updated_at: string
}
