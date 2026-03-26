import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchLeaguesFromApi } from '@/app/actions/leagues'

// Vercel Cron — פעם בשבוע ראשון בחצות (vercel.json)
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const leagues = await fetchLeaguesFromApi()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error } = await supabaseAdmin
      .from('leagues_cache')
      .upsert({ id: 1, leagues, updated_at: new Date().toISOString() })

    if (error) throw error

    return NextResponse.json({ ok: true, count: leagues.length, updated_at: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
