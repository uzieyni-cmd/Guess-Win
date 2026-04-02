import { NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { syncLiveMatches } from '@/lib/sync-live-matches'

export const runtime = 'nodejs'
export const maxDuration = 30

// ── QStash POST handler (trigger every minute via QStash dashboard) ──────────
export async function POST(req: Request) {
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  })
  const body      = await req.text()
  const signature = req.headers.get('upstash-signature') ?? ''
  const isValid   = await receiver.verify({ signature, body }).catch(() => false)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 })
  }
  const synced = await syncLiveMatches({})
  return NextResponse.json({ synced, at: new Date().toISOString() })
}

// ── GET handler — Vercel Cron / manual trigger ───────────────────────────────
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const synced = await syncLiveMatches({})
  return NextResponse.json({ synced, at: new Date().toISOString() })
}
