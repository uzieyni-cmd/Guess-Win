import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// GET /api/v1/tournaments/[tournamentId]/top-scorers
// Returns top 5 scorers, aggregated across ALL tournaments that share the
// same competition (api_league_id + api_season) as the given tournament —
// so a competition split into multiple tournament records (e.g. group +
// knockout) is counted as one.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params

  if (!tournamentId) {
    return NextResponse.json({ error: 'Invalid tournament ID' }, { status: 400 })
  }

  try {
    // 1. מצא את הליגה+עונה של הטורניר הנתון
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

    // 2. מצא את כל הטורנירים עם אותה ליגה+עונה (אותה תחרות, גם אם מפוצלת)
    let tournamentIds = [tournamentId]
    const league = (t as { api_league_id: number | null; api_season: number | null }).api_league_id
    const season = (t as { api_league_id: number | null; api_season: number | null }).api_season
    if (league != null && season != null) {
      const { data: siblings } = await supabaseAdmin
        .from('tournaments')
        .select('id')
        .eq('api_league_id', league)
        .eq('api_season', season)
      if (siblings?.length) {
        tournamentIds = (siblings as { id: string }[]).map(s => s.id)
      }
    }

    // 3. שלוף את כל שערי השחקנים מכל הטורנירים האלה
    const { data: events, error } = await (supabaseAdmin as unknown as { from: (tbl: string) => ReturnType<typeof supabaseAdmin.from> })
      .from('vw_fixture_events')
      .select('heb_name, photo, detail, api_fixture_id, player_id, elapsed')
      .in('tournament_id', tournamentIds)
      .eq('type', 'Goal') as { data: { heb_name: string | null; photo: string | null; detail: string | null; api_fixture_id: number | null; player_id: number | null; elapsed: number | null }[] | null; error: { message: string } | null }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ topScorers: [] })
    }

    // ספירת שערים שהובקעו בלבד — לא פנדל מוחמץ ולא גול עצמי
    const scored = events.filter(
      e => e.detail !== 'Missed Penalty' && e.detail !== 'Own Goal'
    )

    // dedup — אותו fixture עשוי להופיע בכמה טורנירים (league+season משותף);
    // סופרים כל אירוע שער פעם אחת לפי (fixture, player, דקה, detail)
    const seenEvents = new Set<string>()
    const scorersMap = new Map<string, { name: string; photo: string | null; goals: number }>()

    for (const event of scored) {
      const eventKey = `${event.api_fixture_id}:${event.player_id}:${event.elapsed}:${event.detail}`
      if (seenEvents.has(eventKey)) continue
      seenEvents.add(eventKey)

      // קבץ לפי player_id (יציב יותר משם); נופל ל-heb_name אם חסר
      const playerKey = event.player_id != null ? `id:${event.player_id}` : `name:${event.heb_name || 'Unknown'}`
      const existing = scorersMap.get(playerKey)
      if (existing) {
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
