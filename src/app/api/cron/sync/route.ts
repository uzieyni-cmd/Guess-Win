import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Vercel Cron Job — מוגדר ב-vercel.json
// רץ כל 30 שניות (מינימום Vercel הוא דקה אחת בתוכנית חינמית)
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: Request) {
  // אבטחה — רק Vercel Cron יכול להפעיל
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const now = new Date()
    const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
    const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000).toISOString()

    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id, api_fixture_id, status')
      .neq('status', 'finished')
      .not('api_fixture_id', 'is', null)
      .gte('match_start_time', windowStart)
      .lte('match_start_time', windowEnd)

    if (!matches?.length) {
      return NextResponse.json({ synced: 0 })
    }

    const BATCH = 20
    let synced = 0

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
        const isLive = status === 'live'
        await supabaseAdmin
          .from('matches')
          .update({
            status,
            // בזמן משחק חי: שמור את הציון הנוכחי (goals); בסיום: ציון סופי (fulltime)
            actual_home_score: isLive
              ? (f.goals.home ?? null)
              : (f.score.fulltime.home ?? null),
            actual_away_score: isLive
              ? (f.goals.away ?? null)
              : (f.score.fulltime.away ?? null),
            elapsed_minutes: isLive ? (f.fixture.status.elapsed ?? null) : null,
            match_period: isLive ? (f.fixture.status.short ?? null) : null,
          })
          .eq('api_fixture_id', f.fixture.id)
        synced++
      }
    }

    return NextResponse.json({ synced, at: now.toISOString() })
  } catch (err) {
    console.error('[cron/sync]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function mapStatus(short: string): string {
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished'
  if (['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'].includes(short)) return 'live'
  return 'scheduled'
}
