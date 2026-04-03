// Server-side only — רץ אחת בהפעלת השרת דרך instrumentation.ts
// מסנכרן תוצאות של משחקים חיים כל 30 שניות

import { createClient } from '@supabase/supabase-js'

let started = false

export function startSyncCron() {
  if (started) return
  started = true

  console.log('[sync-cron] התחיל — מסנכרן תוצאות כל 30 שניות')

  const run = async () => {
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )

      // מצא משחקים שמתרחשים כעת או התרחשו ב-3 השעות האחרונות
      const now = new Date()
      const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
      const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000).toISOString() // + 30 דקות

      const { data: matches } = await supabaseAdmin
        .from('matches')
        .select('id, api_fixture_id, status')
        .neq('status', 'finished')
        .not('api_fixture_id', 'is', null)
        .gte('match_start_time', windowStart)
        .lte('match_start_time', windowEnd)

      if (!matches?.length) return

      // API-Football תומך ב-ids מופרדים במקף — batch של עד 20
      const BATCH = 20
      for (let i = 0; i < matches.length; i += BATCH) {
        const batch = matches.slice(i, i + BATCH)
        const ids   = batch.map((m: { api_fixture_id: number }) => m.api_fixture_id).join('-')

        const res = await fetch(
          `https://v3.football.api-sports.io/fixtures?ids=${ids}`,
          { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! } }
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
        }
      }
    } catch (err) {
      console.error('[sync-cron] שגיאה:', err)
    }
  }

  // הרצה ראשונה מיידית, ואז כל 30 שניות
  run()
  setInterval(run, 30_000)
}

function mapStatus(short: string): string {
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished'
  if (['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'].includes(short)) return 'live'
  return 'scheduled'
}
