import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// GET /api/v1/matches/[matchId]/goals
// Returns list of goals for a specific match
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params
  const fixtureId = Number(matchId)

  if (!fixtureId) {
    return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 })
  }

  try {
    const { data: events, error } = await (supabaseAdmin as unknown as { from: (t: string) => ReturnType<typeof supabaseAdmin.from> })
      .from('vw_fixture_events')
      .select('heb_name, elapsed, team_name, detail')
      .eq('api_fixture_id', fixtureId)
      .eq('type', 'Goal')
      .order('elapsed', { ascending: true }) as { data: { heb_name: string | null; elapsed: number | null; team_name: string | null; detail: string | null }[] | null; error: { message: string } | null }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ goals: [] })
    }

    // לא לספור פנדל הכרעה (shootout) — נשמר ב-elapsed >= 120
    const goals = events
      .filter(e => !(e.detail === 'Penalty' && (e.elapsed ?? 0) >= 120))
      .map(e => ({
        scorer: e.heb_name ?? '',
        minute: e.elapsed,
        team: e.team_name,
        type: mapGoalType(e.detail),
      }))

    return NextResponse.json({ goals })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function mapGoalType(detail: string | null): 'penalty' | 'own_goal' | 'regular' {
  if (!detail) return 'regular'
  const lower = detail.toLowerCase()
  if (lower.includes('penalty')) return 'penalty'
  if (lower.includes('own goal')) return 'own_goal'
  return 'regular'
}
