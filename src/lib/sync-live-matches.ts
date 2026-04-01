// SEC-04: מייבא supabaseAdmin מ-lib/supabase-admin במקום ליצור instance חדש בכל קריאה.
import { supabaseAdmin } from './supabase-admin'

// PERF-06: rate limit ב-DB — מונע sync כפול כשיש מספר serverless instances
const SYNC_INTERVAL_MS = 55_000

function mapStatus(short: string): string {
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished'
  if (['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'].includes(short)) return 'live'
  return 'scheduled'
}

/**
 * מסנכרן משחקים חיים/קרובים מ-API-Football → Supabase.
 * מחזיר את מספר המשחקים שעודכנו.
 */
export async function syncLiveMatches(opts: {
  tournamentId?: string  // אם לא מסופק — כל הטורנירים
}): Promise<number> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) return 0

  const now = new Date()

  // PERF-06: בדוק last_synced_at ב-DB לפני שמתחילים (distributed rate limit)
  if (opts.tournamentId) {
    const { data: t } = await supabaseAdmin
      .from('tournaments')
      .select('last_synced_at')
      .eq('id', opts.tournamentId)
      .single()
    if (t?.last_synced_at) {
      const elapsed = now.getTime() - new Date(t.last_synced_at).getTime()
      if (elapsed < SYNC_INTERVAL_MS) return 0
    }
    // סמן sync מיידית (אופטימיסטי) כדי לחסום instances מקבילים
    await supabaseAdmin
      .from('tournaments')
      .update({ last_synced_at: now.toISOString() })
      .eq('id', opts.tournamentId)
  }

  const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000).toISOString()

  // Include matches in the normal time window OR any match still stuck in 'live'
  // (stuck matches have match_start_time older than 3h and never got synced to 'finished')
  let query = supabaseAdmin
    .from('matches')
    .select('id, api_fixture_id, status')
    .neq('status', 'finished')
    .not('api_fixture_id', 'is', null)
    .lte('match_start_time', windowEnd)
    .or(`and(match_start_time.gte.${windowStart},match_start_time.lte.${windowEnd}),status.eq.live`)

  if (opts.tournamentId) {
    query = query.eq('tournament_id', opts.tournamentId)
  }

  const { data: matches } = await query
  if (!matches?.length) return 0

  const BATCH = 20
  let synced = 0

  for (let i = 0; i < matches.length; i += BATCH) {
    const batch = matches.slice(i, i + BATCH)
    const ids   = batch.map((m: { api_fixture_id: number }) => m.api_fixture_id).join('-')

    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?ids=${ids}`,
      { headers: { 'x-apisports-key': apiKey }, cache: 'no-store' }
    )
    if (!res.ok) continue

    const json = await res.json()
    const fixtures: {
      fixture: { id: number; status: { short: string; elapsed: number | null } }
      goals: { home: number | null; away: number | null }
      score: { fulltime: { home: number | null; away: number | null } }
    }[] = json.response ?? []

    for (const f of fixtures) {
      const status = mapStatus(f.fixture.status.short)
      const isLive     = status === 'live'
      const isFinished = status === 'finished'

      const fields: Record<string, unknown> = {
        status,
        elapsed_minutes: isLive ? (f.fixture.status.elapsed ?? null) : null,
        match_period:    isLive ? (f.fixture.status.short   ?? null) : null,
      }

      if (isLive) {
        if (f.goals.home !== null && f.goals.home !== undefined) fields.actual_home_score = f.goals.home
        if (f.goals.away !== null && f.goals.away !== undefined) fields.actual_away_score = f.goals.away
      } else if (isFinished) {
        if (f.score.fulltime.home !== null) fields.actual_home_score = f.score.fulltime.home
        if (f.score.fulltime.away !== null) fields.actual_away_score = f.score.fulltime.away
      }

      await supabaseAdmin
        .from('matches')
        .update(fields)
        .eq('api_fixture_id', f.fixture.id)
      synced++
    }
  }

  return synced
}
