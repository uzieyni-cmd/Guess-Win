import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchFixtures, mapFixtureStatus } from '@/lib/api-football'

// Vercel Cron Job — מוגדר ב-vercel.json
// רץ אחת ביום בחצות UTC — מסנכרן משחקים עתידיים לכל הטורנירים הפעילים
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // שלוף כל הטורנירים שאינם מוגמרים ויש להם הגדרת API
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select('id, api_league_id, api_season')
    .neq('status', 'completed')
    .not('api_league_id', 'is', null)
    .not('api_season', 'is', null)

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
  if (!tournaments?.length) return NextResponse.json({ synced: 0, tournaments: 0 })

  // מתאריך היום — הcron היומי שולף רק משחקים עתידיים לחסכון בקריאות API
  const today = new Date().toISOString().split('T')[0]

  let totalSynced = 0
  const results: { id: string; synced: number; error?: string }[] = []

  for (const t of tournaments) {
    try {
      const fixtures = await fetchFixtures(t.api_league_id, t.api_season, today)

      const rows = fixtures.map((f) => ({
        tournament_id: t.id,
        home_team_id: String(f.teams.home.id),
        home_team_name: f.teams.home.name,
        home_team_short: f.teams.home.name.slice(0, 3).toUpperCase(),
        home_team_flag: f.teams.home.logo,
        away_team_id: String(f.teams.away.id),
        away_team_name: f.teams.away.name,
        away_team_short: f.teams.away.name.slice(0, 3).toUpperCase(),
        away_team_flag: f.teams.away.logo,
        match_start_time: f.fixture.date,
        status: mapFixtureStatus(f.fixture.status.short),
        actual_home_score: f.score.fulltime.home ?? null,
        actual_away_score: f.score.fulltime.away ?? null,
        api_fixture_id: f.fixture.id,
        round: f.league.round ?? null,
      }))

      if (rows.length > 0) {
        const { error } = await supabase
          .from('matches')
          .upsert(rows, { onConflict: 'api_fixture_id' })
        if (error) throw error
      }

      totalSynced += rows.length
      results.push({ id: t.id, synced: rows.length })
    } catch (err) {
      results.push({ id: t.id, synced: 0, error: String(err) })
    }
  }

  return NextResponse.json({
    totalSynced,
    tournaments: results.length,
    results,
    at: new Date().toISOString(),
  })
}
