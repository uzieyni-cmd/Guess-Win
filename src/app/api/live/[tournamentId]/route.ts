import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// endpoint זה מחזיר רק משחקים שנמצאים כעת ב-LIVE — ללא cache
export const dynamic = 'force-dynamic'

const COLS =
  'id,tournament_id,home_team_id,home_team_name,home_team_short,home_team_flag,' +
  'away_team_id,away_team_name,away_team_short,away_team_flag,' +
  'match_start_time,status,actual_home_score,actual_away_score,api_fixture_id,round,elapsed_minutes,match_period'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params

  const { data, error } = await supabaseAdmin
    .from('matches')
    .select(COLS)
    .eq('tournament_id', tournamentId)
    .eq('status', 'live')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    { matches: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
