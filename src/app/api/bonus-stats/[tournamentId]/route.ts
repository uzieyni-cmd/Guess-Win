import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { translateTeam } from '@/lib/teams-he'

export const revalidate = 300 // cache 5 דקות — נתונים מגיעים מ-DB, לא מ-API

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params

  try {
    // סכום שערים מהמשחקים עצמם (מהימן תמיד)
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('api_fixture_id, actual_home_score, actual_away_score')
      .eq('tournament_id', tournamentId)
      .eq('status', 'finished')
      .not('api_fixture_id', 'is', null)

    const matchCount = (matches ?? []).length

    const totalGoals = (matches ?? []).reduce(
      (sum, m) => sum + (m.actual_home_score ?? 0) + (m.actual_away_score ?? 0),
      0
    )

    // אירועים מה-DB — מסונן לפי api_fixture_id של הטורניר
    // (לא לפי tournament_id — אחרי dedup יש שורה אחת לכל אירוע ללא קשר לטורניר)
    const fixtureIds = (matches ?? [])
      .map(m => m.api_fixture_id)
      .filter((id): id is number => id !== null)

    const { data: events } = fixtureIds.length
      ? await supabaseAdmin
          .from('fixture_events')
          .select('type, detail, player_id, player_name, team_name, synced_at')
          .in('api_fixture_id', fixtureIds)
      : { data: [] }

    let yellowCards = 0
    let redCards = 0
    let penalties = 0
    let ownGoals = 0
    const scorerStats = new Map<number, { name: string; team: string; goals: number }>()

    for (const e of events ?? []) {
      if (e.type === 'Card') {
        if (e.detail === 'Yellow Card') yellowCards++
        else if (e.detail === 'Red Card' || e.detail === 'Yellow Red Card') redCards++
      } else if (e.type === 'Goal') {
        if (e.detail === 'Penalty') penalties++
        else if (e.detail === 'Own Goal') ownGoals++

        if (e.player_id !== null && e.detail !== 'Own Goal' && e.detail !== 'Missed Penalty') {
          const existing = scorerStats.get(e.player_id)
          if (existing) {
            existing.goals++
          } else {
            scorerStats.set(e.player_id, {
              name: e.player_name ?? '',
              team: translateTeam(e.team_name ?? ''),
              goals: 1,
            })
          }
        }
      }
    }

    const topScorers = [...scorerStats.entries()]
      .sort((a, b) => b[1].goals - a[1].goals)
      .slice(0, 3)
      .map(([playerId, s]) => ({
        name: s.name,
        team: s.team,
        photo: `https://media.api-sports.io/football/players/${playerId}.png`,
        goals: s.goals,
      }))

    const lastSyncedAt = (events ?? []).reduce<string | null>((max, e) => {
      if (!max || e.synced_at > max) return e.synced_at
      return max
    }, null)

    return NextResponse.json(
      { totalGoals, yellowCards, redCards, penalties, ownGoals, topScorers, matchCount, lastSyncedAt },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
