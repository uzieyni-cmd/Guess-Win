import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchFixtures, ApiFixture } from '@/lib/api-football'

export const revalidate = 3600

// Round labels that are part of knockout stage (not group stage)
const KNOCKOUT_ROUNDS = [
  'Round of 16',
  'Round Of 16',
  '1/8-finals',
  'Quarter-finals',
  'Semi-finals',
  'Final',
  '3rd Place Final',
  'Round of 32',
  'Round Of 32',
  '1/4-finals',
  '1/2-finals',
]

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params

  const { data: t } = await supabaseAdmin
    .from('tournaments')
    .select('api_league_id, api_season, bracket_config')
    .eq('id', tournamentId)
    .single()

  if (!t?.api_league_id || !t?.api_season) {
    return NextResponse.json({ error: 'no league config' }, { status: 404 })
  }

  try {
    const fixtures = await fetchFixtures(t.api_league_id, t.api_season)

    // Filter to knockout rounds only
    const knockout = fixtures.filter(f =>
      KNOCKOUT_ROUNDS.some(r => f.league.round?.toLowerCase().includes(r.toLowerCase()))
    )

    // Deduplicate by round name, then group
    const byRound: Record<string, ApiFixture[]> = {}
    for (const f of knockout) {
      const round = f.league.round
      if (!byRound[round]) byRound[round] = []
      byRound[round].push(f)
    }

    return NextResponse.json({ rounds: byRound, bracketConfig: t.bracket_config ?? null }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
