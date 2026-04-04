import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

function mapStatus(short: string): string {
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished'
  if (['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'].includes(short)) return 'live'
  return 'scheduled'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params
  const id = Number(fixtureId)
  if (!id) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) return NextResponse.json({ error: 'no api key' }, { status: 500 })

  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?id=${id}`,
    { headers: { 'x-apisports-key': apiKey }, cache: 'no-store' }
  )
  if (!res.ok) return NextResponse.json({ error: 'api error' }, { status: 502 })

  const json = await res.json()
  const fixture = json.response?.[0]
  if (!fixture) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // ── עדכן DB (מקור אמת יחיד לתוצאה) ────────────────────────────
  const status     = mapStatus(fixture.fixture.status.short)
  const isLive     = status === 'live'
  const isFinished = status === 'finished'

  const fields: Record<string, unknown> = {
    status,
    elapsed_minutes: isLive ? (fixture.fixture.status.elapsed ?? null) : null,
    match_period:    isLive ? (fixture.fixture.status.short   ?? null) : null,
  }
  if (isLive) {
    if (fixture.goals.home !== null) fields.actual_home_score = fixture.goals.home
    if (fixture.goals.away !== null) fields.actual_away_score = fixture.goals.away
  } else if (isFinished) {
    if (fixture.score.fulltime.home !== null) fields.actual_home_score = fixture.score.fulltime.home
    if (fixture.score.fulltime.away !== null) fields.actual_away_score = fixture.score.fulltime.away
  }

  // fire-and-forget — לא חוסם את התגובה
  supabaseAdmin.from('matches').update(fields).eq('api_fixture_id', id)

  // ── אירועים ────────────────────────────────────────────────────
  const events = (fixture.events ?? [])
    .filter((e: { type: string }) => e.type === 'Goal' || e.type === 'Card')
    .map((e: {
      time: { elapsed: number; extra: number | null }
      team: { id: number }
      player: { name: string }
      type: string
      detail: string
    }) => ({
      minute: e.time.elapsed + (e.time.extra ?? 0),
      teamId: e.team.id,
      player: e.player.name,
      type:   e.type,
      detail: e.detail,
    }))

  return NextResponse.json({
    status: fixture.fixture.status,
    goals:  fixture.goals,
    score:  fixture.score,
    teams:  fixture.teams,
    events,
  })
}
