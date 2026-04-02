import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 30

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
    { headers: { 'x-apisports-key': apiKey }, next: { revalidate: 30 } }
  )
  if (!res.ok) return NextResponse.json({ error: 'api error' }, { status: 502 })

  const json = await res.json()
  const fixture = json.response?.[0]
  if (!fixture) return NextResponse.json({ error: 'not found' }, { status: 404 })

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
