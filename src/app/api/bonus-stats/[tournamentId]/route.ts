import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchFixtureEvents } from '@/lib/api-football'
import { translateTeam } from '@/lib/teams-he'

export const revalidate = 1800 // cache 30 דקות

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params

  const { data: t } = await supabaseAdmin
    .from('tournaments')
    .select('api_league_id, api_season')
    .eq('id', tournamentId)
    .single()

  if (!t?.api_league_id || !t?.api_season) {
    return NextResponse.json({ error: 'no league config' }, { status: 404 })
  }

  try {
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('api_fixture_id, actual_home_score, actual_away_score')
      .eq('tournament_id', tournamentId)
      .eq('status', 'finished')
      .not('api_fixture_id', 'is', null)

    const fixtureIds = (matches ?? []).map(m => m.api_fixture_id as number)

    const totalGoals = (matches ?? []).reduce(
      (sum, m) => sum + (m.actual_home_score ?? 0) + (m.actual_away_score ?? 0),
      0
    )

    const eventsByFixture = await Promise.all(
      fixtureIds.map(id => fetchFixtureEvents(id).catch(() => []))
    )

    let yellowCards = 0
    let redCards = 0
    let penalties = 0
    let ownGoals = 0

    // ניקוד כובשים מהאירועים של המשחקים שלנו — מסונכרן עם המשחקים שהסתיימו
    // (ה-endpoint הגלובלי של מלכי השערים בספק מפגר ולא משקף משחקים טריים)
    const scorerStats = new Map<number, { name: string; team: string; goals: number }>()

    for (const events of eventsByFixture) {
      for (const e of events) {
        if (e.type === 'Card') {
          if (e.detail === 'Yellow Card') yellowCards++
          else if (e.detail === 'Red Card') redCards++
        } else if (e.type === 'Goal') {
          if (e.detail === 'Penalty') penalties++
          else if (e.detail === 'Own Goal') ownGoals++

          if (e.player.id !== null && e.detail !== 'Own Goal' && e.detail !== 'Missed Penalty') {
            const existing = scorerStats.get(e.player.id)
            if (existing) {
              existing.goals++
            } else {
              scorerStats.set(e.player.id, {
                name: e.player.name ?? '',
                team: translateTeam(e.team.name),
                goals: 1,
              })
            }
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

    return NextResponse.json(
      { totalGoals, yellowCards, redCards, penalties, ownGoals, topScorers, matchCount: fixtureIds.length },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
