// Cron: מסנכרן יחסי הימורים (Bet365 Match Winner) לכל המשחקים הקרובים.
// רץ פעם ביום בשעה 06:00 UTC.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchOdds } from '@/lib/api-football'

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

  const { data: matches } = await supabase
    .from('matches')
    .select('id, api_fixture_id')
    .eq('status', 'scheduled')
    .not('api_fixture_id', 'is', null)

  if (!matches?.length) return NextResponse.json({ synced: 0 })

  let synced = 0
  for (const m of matches as { id: string; api_fixture_id: number }[]) {
    const odds = await fetchOdds(m.api_fixture_id)
    if (!odds) continue
    await supabase
      .from('matches')
      .update({ odds_home: odds.home, odds_draw: odds.draw, odds_away: odds.away, odds_updated_at: new Date().toISOString() })
      .eq('id', m.id)
    synced++
  }

  return NextResponse.json({ synced, at: new Date().toISOString() })
}
