// Cron: מריץ את הקוף 🐒 — ממלא ניחושים לכל הטורנירים האקטיביים.
// מופעל כל שעה על ידי Vercel Cron (ראה vercel.json).
import { NextResponse } from 'next/server'
import { runMonkeyForAllTournaments } from '@/app/actions/ai-monkey'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runMonkeyForAllTournaments()
  return NextResponse.json(result)
}
