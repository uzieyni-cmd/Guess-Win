import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// GET /api/v1/tournaments/[tournamentId]/top-scorers
// Returns top 5 scorers for a specific tournament
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params

  if (!tournamentId) {
    return NextResponse.json({ error: 'Invalid tournament ID' }, { status: 400 })
  }

  try {
    const { data: events, error } = await (supabaseAdmin as unknown as { from: (t: string) => ReturnType<typeof supabaseAdmin.from> })
      .from('vw_fixture_events')
      .select('heb_name, photo')
      .eq('tournament_id', tournamentId)
      .eq('type', 'Goal') as { data: { heb_name: string | null; photo: string | null }[] | null; error: { message: string } | null }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ topScorers: [] })
    }

    // Group by player and count goals
    const scorersMap = new Map<string, { name: string; photo: string | null; goals: number }>()

    for (const event of events) {
      const playerKey = event.heb_name || 'Unknown'
      if (scorersMap.has(playerKey)) {
        const existing = scorersMap.get(playerKey)!
        existing.goals += 1
      } else {
        scorersMap.set(playerKey, {
          name: event.heb_name || 'Unknown',
          photo: event.photo || null,
          goals: 1,
        })
      }
    }

    // Sort by goals descending and take top 5
    const topScorers = Array.from(scorersMap.values())
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 5)
      .map((scorer, index) => ({
        rank: index + 1,
        playerName: scorer.name,
        photo: scorer.photo,
        totalGoals: scorer.goals,
      }))

    return NextResponse.json({ topScorers })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
