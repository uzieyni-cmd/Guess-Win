import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchFixtureEvents } from '@/lib/api-football'

export const runtime = 'nodejs'
export const maxDuration = 60

// Vercel Cron — runs every 2 hours
// מסנכרן אירועים (כרטיסים, שערים וכו') של משחקים שהסתיימו ב-3 הימים האחרונים
// Delete + Insert מחדש לכל משחק — מכסה עדכונים לאחור (VAR, ביטול כרטיס וכו')
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const backfill = url.searchParams.get('backfill') === 'true'

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabaseAdmin
    .from('matches')
    .select('api_fixture_id, tournament_id')
    .eq('status', 'finished')
    .not('api_fixture_id', 'is', null)

  if (!backfill) query = query.gte('match_start_time', threeDaysAgo)

  const { data: matches, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!matches?.length) return NextResponse.json({ synced: 0 })

  // dedup — אותו fixture יכול להופיע בכמה טורנירים; מסנכרנים פעם אחת בלבד
  const seenFixtures = new Set<number>()
  const uniqueMatches = (matches as { api_fixture_id: number; tournament_id: string }[]).filter(m => {
    if (seenFixtures.has(m.api_fixture_id)) return false
    seenFixtures.add(m.api_fixture_id)
    return true
  })

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const match of uniqueMatches) {
    try {
      const events = await fetchFixtureEvents(match.api_fixture_id as number)

      // מחק לפי api_fixture_id בלבד — שומר שורה אחת לכל fixture
      await supabaseAdmin
        .from('fixture_events')
        .delete()
        .eq('api_fixture_id', match.api_fixture_id)

      if (events.length > 0) {
        const rows = events.map(e => ({
          api_fixture_id: match.api_fixture_id,
          tournament_id:  match.tournament_id,
          type:           e.type,
          detail:         e.detail ?? '',
          player_id:      e.player.id ?? null,
          player_name:    e.player.name ?? null,
          team_id:        e.team.id ?? null,
          team_name:      e.team.name ?? null,
          elapsed:        e.time.elapsed ?? null,
        }))

        const { error: insertErr } = await supabaseAdmin
          .from('fixture_events')
          .insert(rows)

        if (insertErr) throw insertErr
      }

      synced++

      // השהיה קצרה בין קריאות API למניעת rate limit
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      failed++
      errors.push(`fixture ${match.api_fixture_id}: ${err instanceof Error ? err.message : JSON.stringify(err)}`)
    }
  }

  return NextResponse.json({
    synced,
    failed,
    total: matches.length,
    ...(errors.length ? { errors } : {}),
    at: new Date().toISOString(),
  })
}
