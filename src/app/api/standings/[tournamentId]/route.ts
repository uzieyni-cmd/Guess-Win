import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchStandings } from '@/lib/api-football'

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
    const standings = await fetchStandings(t.api_league_id, t.api_season)
    return NextResponse.json({ standings }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
