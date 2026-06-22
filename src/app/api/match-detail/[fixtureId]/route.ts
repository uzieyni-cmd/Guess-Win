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

  const { data: matches, error: matchErr } = await supabaseAdmin
    .from('matches')
    .select('status, actual_home_score, actual_away_score, home_team_id, away_team_id, home_team_name, away_team_name, home_team_flag, away_team_flag, tournament_id')
    .eq('api_fixture_id', id)
    .limit(1)

  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 })
  const match = matches?.[0]
  if (!match) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: eventsRaw } = await (supabaseAdmin as unknown as { from: (t: string) => ReturnType<typeof supabaseAdmin.from> })
    .from('vw_fixture_events')
    .select('type, detail, heb_name, team_id, team_name, elapsed')
    .eq('api_fixture_id', id)
    .order('elapsed', { ascending: true }) as { data: { type: string; detail: string; heb_name: string | null; team_id: number | null; team_name: string | null; elapsed: number | null }[] | null }

  const m = match as {
    status: string
    actual_home_score: number | null
    actual_away_score: number | null
    home_team_id: number | null
    away_team_id: number | null
    home_team_name: string
    away_team_name: string
    home_team_flag: string | null
    away_team_flag: string | null
  }

  const events = (eventsRaw ?? [])
    .filter(e => e.type === 'Goal' || e.type === 'Card')
    .map(e => ({
      minute:   e.elapsed ?? 0,
      teamId:   e.team_id,
      teamName: e.team_name,
      player:   e.heb_name ?? '',
      type:     e.type,
      detail:   e.detail,
    }))

  return NextResponse.json({
    status: { short: m.status, elapsed: null },
    goals:  { home: m.actual_home_score, away: m.actual_away_score },
    score:  {
      halftime: { home: null, away: null },
      fulltime: { home: m.actual_home_score, away: m.actual_away_score },
    },
    teams:  {
      home: { id: m.home_team_id, name: m.home_team_name, logo: m.home_team_flag },
      away: { id: m.away_team_id, name: m.away_team_name, logo: m.away_team_flag },
    },
    events,
  })
}
