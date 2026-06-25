import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { translateTeam } from '@/lib/teams-he'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const COLS =
  'id,tournament_id,home_team_id,home_team_name,home_team_short,home_team_flag,' +
  'away_team_id,away_team_name,away_team_short,away_team_flag,' +
  'match_start_time,status,actual_home_score,actual_away_score,api_fixture_id,round,elapsed_minutes,match_period'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params

  // read-only — ניקוד חי מחושב ע"י cron sync-live (כל דקה), לא פר-לקוח.
  // החזר משחקים חיים + כאלה שסיימו ב-3 השעות האחרונות (כדי שהלקוח יקבל תוצאות סופיות)
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('matches')
    .select(COLS)
    .eq('tournament_id', tournamentId)
    .or(`status.eq.live,and(status.eq.finished,match_start_time.gte.${threeHoursAgo})`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const translated = (data ?? []).map(m => {
    const row = m as unknown as Record<string, unknown>
    return {
      ...row,
      home_team_name: translateTeam(row.home_team_name as string),
      away_team_name: translateTeam(row.away_team_name as string),
    }
  })
  return NextResponse.json(
    { matches: translated },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
