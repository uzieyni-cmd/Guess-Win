import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// GET /api/v1/tournaments/[tournamentId]/top-scorers
// Returns top 5 scorers from the top_scorers table — a cached copy of
// API-Football /players/topscorers, synced by /api/cron/sync-top-scorers.
// Keyed by competition (api_league_id + api_season), so a competition split
// into multiple tournament records (group + knockout) shares one list.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params

  if (!tournamentId) {
    return NextResponse.json({ error: 'Invalid tournament ID' }, { status: 400 })
  }

  try {
    const { data: t, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('api_league_id, api_season')
      .eq('id', tournamentId)
      .single()

    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 500 })
    }
    if (!t) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const league = (t as { api_league_id: number | null; api_season: number | null }).api_league_id
    const season = (t as { api_league_id: number | null; api_season: number | null }).api_season
    if (league == null || season == null) {
      return NextResponse.json({ topScorers: [] })
    }

    const { data: scorers, error } = await supabaseAdmin
      .from('top_scorers')
      .select('player_id, player_name, photo, team_name, goals, assists, rank, synced_at')
      .eq('api_league_id', league)
      .eq('api_season', season)
      .order('rank', { ascending: true })
      .limit(5) as { data: { player_id: number; player_name: string; photo: string | null; team_name: string | null; goals: number; assists: number | null; rank: number; synced_at: string }[] | null; error: { message: string } | null }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!scorers?.length) {
      return NextResponse.json({ topScorers: [] })
    }

    // שמות בעברית מטבלת players (fallback לשם מה-API)
    const { data: hebPlayers } = await supabaseAdmin
      .from('players')
      .select('id, heb_name')
      .in('id', scorers.map(s => s.player_id)) as { data: { id: number; heb_name: string | null }[] | null }

    const hebMap = new Map((hebPlayers ?? []).map(p => [p.id, p.heb_name]))

    const topScorers = scorers.map((s, index) => ({
      rank: index + 1,
      playerName: hebMap.get(s.player_id) || s.player_name,
      photo: s.photo ?? `https://media.api-sports.io/football/players/${s.player_id}.png`,
      totalGoals: s.goals,
      totalAssists: s.assists,
    }))

    return NextResponse.json({ topScorers, lastSyncedAt: scorers[0].synced_at })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
