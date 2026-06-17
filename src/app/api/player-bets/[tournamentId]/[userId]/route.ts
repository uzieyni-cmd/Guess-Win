import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { translateTeam } from '@/lib/teams-he'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tournamentId: string; userId: string }> }
) {
  // דרוש התחברות
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tournamentId, userId } = await params

  const { data: bets, error } = await supabaseAdmin
    .from('bets')
    .select(`
      id,
      match_id,
      predicted_home,
      predicted_away,
      points,
      result,
      team_bonus_pick
    `)
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // מצא אם המשתמש השתמש בג'וקר על כל משחק
  const { data: jokers } = await supabaseAdmin
    .from('joker_picks')
    .select('match_id')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)

  const jokerMatchIds = new Set((jokers ?? []).map((j: { match_id: string }) => j.match_id))

  // פרטי המשחקים שהסתיימו
  const matchIds = (bets ?? []).map(b => (b as { match_id: string }).match_id)
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, home_team_name, home_team_flag, home_team_id, away_team_name, away_team_flag, away_team_id, actual_home_score, actual_away_score, match_start_time, status')
    .in('id', matchIds)
    .eq('status', 'finished')

  const matchMap = new Map((matches ?? []).map((m: { id: string }) => [m.id, m]))

  type BetRow = {
    id: string
    match_id: string
    predicted_home: number
    predicted_away: number
    points: number | null
    result: string | null
    team_bonus_pick: number
  }

  const rows = (bets ?? [])
    .filter((b) => {
      const bet = b as BetRow
      return matchMap.has(bet.match_id) &&
        (bet.points !== null || (bet.team_bonus_pick ?? 0) > 0)
    })
    .map((b) => {
      const bet = b as BetRow
      const match = matchMap.get(bet.match_id) as {
        id: string
        home_team_name: string
        home_team_flag: string
        home_team_id: string
        away_team_name: string
        away_team_flag: string
        away_team_id: string
        actual_home_score: number
        actual_away_score: number
        match_start_time: string
        status: string
      }
      return {
        matchId: bet.match_id,
        matchStartTime: match.match_start_time,
        homeTeam: { name: translateTeam(match.home_team_name), flag: match.home_team_flag, id: match.home_team_id },
        awayTeam: { name: translateTeam(match.away_team_name), flag: match.away_team_flag, id: match.away_team_id },
        actualScore: { home: match.actual_home_score, away: match.actual_away_score },
        predictedScore: { home: bet.predicted_home, away: bet.predicted_away },
        points: bet.points,
        betResult: bet.result,
        teamBonusPick: bet.team_bonus_pick ?? 0,
        hasJoker: jokerMatchIds.has(bet.match_id),
        total: (bet.points ?? 0) + (bet.team_bonus_pick ?? 0),
      }
    })
    .sort((a, b) => new Date(a.matchStartTime).getTime() - new Date(b.matchStartTime).getTime())

  return NextResponse.json({ rows })
}
