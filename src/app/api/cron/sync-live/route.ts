// Cron: מסנכרן משחקים חיים מ-API-Football לכל הטורנירים האקטיביים.
// מופעל כל דקה על ידי Vercel Cron (ראה vercel.json).
// SEC-05: כך rate limiting על API-Football מנוהל ב-cron ולא ב-endpoint משתמש.
import { NextResponse } from 'next/server'
import { syncLiveMatches } from '@/lib/sync-live-matches'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const synced = await syncLiveMatches({})
  return NextResponse.json({ ok: true, synced })
}
