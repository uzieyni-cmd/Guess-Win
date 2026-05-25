'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Fixed key stored in the stage column — one pick per user per tournament
const TOURNAMENT_STAGE_KEY = 'tournament'

// ── Types ────────────────────────────────────────────────────────
export type TournamentPickConfig = {
  teams: string[]    // all teams in the tournament (sorted)
  lockTime: string   // first match − 10 min
}

export type RoundBonusPick = {
  id: string
  tournamentId: string
  userId: string
  teamName: string
  pointsAwarded: number
}

// ── Get teams + lock time for the tournament pick ────────────────
export async function getTournamentPickConfig(tournamentId: string): Promise<TournamentPickConfig | null> {
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('home_team_name, away_team_name, match_start_time')
    .eq('tournament_id', tournamentId)
    .order('match_start_time', { ascending: true })

  if (!matches?.length) return null

  const teams = new Set<string>()
  let minTime = (matches[0] as { match_start_time: string }).match_start_time

  for (const m of matches as { home_team_name: string; away_team_name: string; match_start_time: string }[]) {
    if (m.home_team_name && !m.home_team_name.startsWith('TBD')) teams.add(m.home_team_name)
    if (m.away_team_name && !m.away_team_name.startsWith('TBD')) teams.add(m.away_team_name)
    if (m.match_start_time < minTime) minTime = m.match_start_time
  }

  return {
    teams: Array.from(teams).sort(),
    lockTime: new Date(new Date(minTime).getTime() - 10 * 60 * 1000).toISOString(),
  }
}

// ── Get the current user's single pick ───────────────────────────
export async function getMyTournamentPick(tournamentId: string): Promise<RoundBonusPick | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabaseAdmin
    .from('round_bonus_picks')
    .select('id, tournament_id, user_id, team_name, points_awarded')
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)
    .eq('stage', TOURNAMENT_STAGE_KEY)
    .maybeSingle()

  if (!data) return null
  const r = data as { id: string; tournament_id: string; user_id: string; team_name: string; points_awarded: number }
  return {
    id: r.id,
    tournamentId: r.tournament_id,
    userId: r.user_id,
    teamName: r.team_name,
    pointsAwarded: r.points_awarded,
  }
}

// ── User submits / updates the single tournament pick ─────────────
export async function submitTournamentPick(
  tournamentId: string,
  teamName: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  // Verify lock: first match of tournament
  const { data: firstMatch } = await supabaseAdmin
    .from('matches')
    .select('match_start_time')
    .eq('tournament_id', tournamentId)
    .order('match_start_time', { ascending: true })
    .limit(1)
    .single()

  if (!firstMatch) return { ok: false, error: 'לא נמצאו משחקים בטורניר' }

  const lockTime = new Date(new Date((firstMatch as { match_start_time: string }).match_start_time).getTime() - 10 * 60 * 1000)
  if (new Date() >= lockTime) return { ok: false, error: 'ההימור נעול' }

  const { error } = await supabaseAdmin
    .from('round_bonus_picks')
    .upsert({
      tournament_id: tournamentId,
      user_id: user.id,
      stage: TOURNAMENT_STAGE_KEY,
      team_name: teamName,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tournament_id,user_id,stage' })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Auto-award 2 pts per match win ───────────────────────────────
// Called from setActualScoreAction — no stage filter, spans full tournament
export async function awardRoundBonusForMatch(matchId: string): Promise<void> {
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('tournament_id, home_team_name, away_team_name, actual_home_score, actual_away_score')
    .eq('id', matchId)
    .single()

  if (!match) return
  const m = match as {
    tournament_id: string
    home_team_name: string
    away_team_name: string
    actual_home_score: number
    actual_away_score: number
  }

  if (m.actual_home_score === m.actual_away_score) return // תיקו — אין נקודות

  const winner = m.actual_home_score > m.actual_away_score ? m.home_team_name : m.away_team_name

  const { data: picks } = await supabaseAdmin
    .from('round_bonus_picks')
    .select('id, points_awarded')
    .eq('tournament_id', m.tournament_id)
    .eq('team_name', winner)

  if (!picks?.length) return

  for (const pick of picks as { id: string; points_awarded: number }[]) {
    await supabaseAdmin
      .from('round_bonus_picks')
      .update({ points_awarded: pick.points_awarded + 2, updated_at: new Date().toISOString() })
      .eq('id', pick.id)
  }
}
