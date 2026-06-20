import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params
  const id = Number(fixtureId)
  if (!id) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('status, actual_home_score, actual_away_score, home_team_name, away_team_name, home_team_flag, away_team_flag, home_team_id, away_team_id')
    .eq('api_fixture_id', id)
    .single()

  if (!match) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: eventsRaw } = await supabaseAdmin
    .from('fixture_events')
    .select('type, detail, player_id, player_name, team_id, team_name, elapsed')
    .eq('api_fixture_id', id)
    .order('elapsed', { ascending: true })

  const events = (eventsRaw ?? [])
    .filter((e: { type: string }) => e.type === 'Goal' || e.type === 'Card')
    .map((e: { type: string; detail: string; player_name: string | null; team_id: number | null; elapsed: number | null }) => ({
      minute: e.elapsed ?? 0,
      teamId: e.team_id,
      player: e.player_name ?? '',
      type:   e.type,
      detail: e.detail,
    }))

  const m = match as {
    status: string
    actual_home_score: number | null
    actual_away_score: number | null
    home_team_name: string
    away_team_name: string
    home_team_flag: string | null
    away_team_flag: string | null
    home_team_id: number | null
    away_team_id: number | null
  }

  return NextResponse.json({
    status: { short: m.status },
    goals:  { home: m.actual_home_score, away: m.actual_away_score },
    score:  { fulltime: { home: m.actual_home_score, away: m.actual_away_score } },
    teams:  {
      home: { id: m.home_team_id, name: m.home_team_name, logo: m.home_team_flag },
      away: { id: m.away_team_id, name: m.away_team_name, logo: m.away_team_flag },
    },
    events,
  })
}
