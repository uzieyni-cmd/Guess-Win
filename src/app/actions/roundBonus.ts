'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ── Stage normalisation ──────────────────────────────────────────
// The DB stores round names like "Group A", "Quarter-finals", etc.
// We bucket them into canonical stage keys for the pick system.
export function normaliseStage(round: string): string {
  const r = round.toLowerCase()
  if (r.includes('group'))                         return 'Group Stage'
  if (r.includes('semi'))                          return 'Semi-finals'
  if (r.includes('final'))                         return 'Final'
  if (r.includes('quarter') || r.includes('1/4')) return 'Quarter-finals'
  if (r.includes('16')      || r.includes('1/8')) return 'Round of 16'
  if (r.includes('32'))                            return 'Round of 32'
  return round
}

export const STAGE_HE: Record<string, string> = {
  'Group Stage':    'שלב הבתים',
  'Round of 32':    'שלב 32',
  'Round of 16':    'שמינית גמר',
  'Quarter-finals': 'רבע גמר',
  'Semi-finals':    'חצי גמר',
  'Final':          'גמר',
}

// Desired display order for stages
const STAGE_ORDER = [
  'Group Stage', 'Round of 32', 'Round of 16',
  'Quarter-finals', 'Semi-finals', 'Final',
]

// ── Types (exported for use in UI) ───────────────────────────────
export type RoundBonusStage = {
  stage: string        // canonical key
  stageHe: string
  teams: string[]      // distinct team names playing in this stage
  lockTime: string     // first match of stage − 10 min
}

export type RoundBonusPick = {
  id: string
  tournamentId: string
  userId: string
  stage: string
  teamName: string
  pointsAwarded: number
}

// ── Get available stages + teams for a tournament ────────────────
export async function getRoundBonusStages(tournamentId: string): Promise<RoundBonusStage[]> {
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('round, home_team_name, away_team_name, match_start_time')
    .eq('tournament_id', tournamentId)
    .not('round', 'is', null)
    .order('match_start_time', { ascending: true })

  if (!matches?.length) return []

  const stageMap = new Map<string, { teams: Set<string>; minTime: string }>()

  for (const m of matches as { round: string | null; home_team_name: string; away_team_name: string; match_start_time: string }[]) {
    if (!m.round) continue
    const stage = normaliseStage(m.round)
    if (!stageMap.has(stage)) {
      stageMap.set(stage, { teams: new Set(), minTime: m.match_start_time })
    }
    const entry = stageMap.get(stage)!
    // Skip TBD / placeholder team names
    if (m.home_team_name && !m.home_team_name.startsWith('TBD')) entry.teams.add(m.home_team_name)
    if (m.away_team_name && !m.away_team_name.startsWith('TBD')) entry.teams.add(m.away_team_name)
    if (m.match_start_time < entry.minTime) entry.minTime = m.match_start_time
  }

  const result: RoundBonusStage[] = Array.from(stageMap.entries()).map(([stage, { teams, minTime }]) => ({
    stage,
    stageHe: STAGE_HE[stage] ?? stage,
    teams: Array.from(teams).sort(),
    lockTime: new Date(new Date(minTime).getTime() - 10 * 60 * 1000).toISOString(),
  }))

  // Sort by tournament progression order
  result.sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a.stage)
    const bi = STAGE_ORDER.indexOf(b.stage)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return result
}

// ── Get the current user's picks ─────────────────────────────────
export async function getMyRoundBonusPicks(tournamentId: string): Promise<RoundBonusPick[]> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabaseAdmin
    .from('round_bonus_picks')
    .select('id, tournament_id, user_id, stage, team_name, points_awarded')
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)

  return (data ?? []).map((r: { id: string; tournament_id: string; user_id: string; stage: string; team_name: string; points_awarded: number }) => ({
    id: r.id,
    tournamentId: r.tournament_id,
    userId: r.user_id,
    stage: r.stage,
    teamName: r.team_name,
    pointsAwarded: r.points_awarded,
  }))
}

// ── User submits / updates a pick ────────────────────────────────
export async function submitRoundBonusPick(
  tournamentId: string,
  stage: string,
  teamName: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  // Verify lock: query the earliest match in this stage
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('match_start_time, round')
    .eq('tournament_id', tournamentId)
    .not('round', 'is', null)
    .order('match_start_time', { ascending: true })

  if (!matches?.length) return { ok: false, error: 'לא נמצאו משחקים' }

  const stageTimes = (matches as { match_start_time: string; round: string }[])
    .filter(m => normaliseStage(m.round) === stage)
    .map(m => m.match_start_time)

  if (!stageTimes.length) return { ok: false, error: 'שלב לא נמצא' }

  const lockTime = new Date(new Date(stageTimes[0]).getTime() - 10 * 60 * 1000)
  if (new Date() >= lockTime) return { ok: false, error: 'ההימור נעול' }

  const { error } = await supabaseAdmin
    .from('round_bonus_picks')
    .upsert({
      tournament_id: tournamentId,
      user_id: user.id,
      stage,
      team_name: teamName,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tournament_id,user_id,stage' })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Auto-award 2 pts per match win (called from setActualScoreAction) ──
export async function awardRoundBonusForMatch(matchId: string): Promise<void> {
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('tournament_id, round, home_team_name, away_team_name, actual_home_score, actual_away_score')
    .eq('id', matchId)
    .single()

  if (!match) return
  const m = match as {
    tournament_id: string
    round: string | null
    home_team_name: string
    away_team_name: string
    actual_home_score: number
    actual_away_score: number
  }

  if (!m.round) return
  if (m.actual_home_score === m.actual_away_score) return // תיקו — אין נקודות בונוס

  const winner  = m.actual_home_score > m.actual_away_score ? m.home_team_name : m.away_team_name
  const stage   = normaliseStage(m.round)

  const { data: picks } = await supabaseAdmin
    .from('round_bonus_picks')
    .select('id, points_awarded')
    .eq('tournament_id', m.tournament_id)
    .eq('stage', stage)
    .eq('team_name', winner)

  if (!picks?.length) return

  for (const pick of picks as { id: string; points_awarded: number }[]) {
    await supabaseAdmin
      .from('round_bonus_picks')
      .update({ points_awarded: pick.points_awarded + 2, updated_at: new Date().toISOString() })
      .eq('id', pick.id)
  }
}
