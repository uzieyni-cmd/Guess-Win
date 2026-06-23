import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// GET /api/v1/matches/[matchId]/cards
// Returns list of cards (yellow/red) for a specific match
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
      .eq('type', 'Card')
      .order('elapsed', { ascending: true }) as { data: { heb_name: string | null; elapsed: number | null; team_name: string | null; detail: string | null }[] | null; error: { message: string } | null }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ cards: [] })
    }

    const cards = events.map(e => ({
      player: e.heb_name ?? '',
      minute: e.elapsed,
      team: e.team_name,
      type: mapCardType(e.detail),
    }))

    return NextResponse.json({ cards })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function mapCardType(detail: string | null): 'yellow' | 'red' {
  if (!detail) return 'yellow'
  const lower = detail.toLowerCase()
  if (lower.includes('red')) return 'red'
  return 'yellow'
}
