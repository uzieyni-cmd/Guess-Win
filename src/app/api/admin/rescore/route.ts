// Admin: מחשב מחדש נקודות לכל הבטים שיש להם points=null על משחקים שהסתיימו.
// POST /api/admin/rescore
// POST /api/admin/rescore?tournamentId=<id>  — מוגבל לטורניר ספציפי
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // מאובטח עם CRON_SECRET — אותו secret שמשמש את ה-cron jobs
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tournamentId = searchParams.get('tournamentId') ?? undefined

  // 1. שלוף כל המשחקים שהסתיימו עם תוצאה סופית
  let matchQuery = supabaseAdmin
    .from('matches')
    .select('id, actual_home_score, actual_away_score')
    .eq('status', 'finished')
    .not('actual_home_score', 'is', null)
    .not('actual_away_score', 'is', null)

  if (tournamentId) matchQuery = matchQuery.eq('tournament_id', tournamentId)

  const { data: matches, error: matchErr } = await matchQuery
  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 })
  if (!matches?.length) return NextResponse.json({ scored: 0, matches: 0 })

  type MatchRow = { id: string; actual_home_score: number; actual_away_score: number }

  let totalScored = 0

  for (const m of matches as MatchRow[]) {
    // 2. שלוף רק בטים ללא נקודות על המשחק הזה
    const { data: bets } = await supabaseAdmin
      .from('bets')
      .select('id, predicted_home, predicted_away')
      .eq('match_id', m.id)
      .is('points', null)

    if (!bets?.length) continue

    for (const bet of bets as { id: string; predicted_home: number; predicted_away: number }[]) {
      let result: 'exact' | 'outcome' | 'miss'
      let points: number

      if (bet.predicted_home === m.actual_home_score && bet.predicted_away === m.actual_away_score) {
        result = 'exact'; points = 10
      } else {
        const predOut = bet.predicted_home > bet.predicted_away ? 'home' : bet.predicted_home < bet.predicted_away ? 'away' : 'draw'
        const actOut  = m.actual_home_score > m.actual_away_score ? 'home' : m.actual_home_score < m.actual_away_score ? 'away' : 'draw'
        if (predOut === actOut) { result = 'outcome'; points = 5 }
        else { result = 'miss'; points = 0 }
      }

      await supabaseAdmin
        .from('bets')
        .update({ points, result })
        .eq('id', bet.id)

      totalScored++
    }
  }

  return NextResponse.json({
    ok: true,
    matches: matches.length,
    scored: totalScored,
    ...(tournamentId ? { tournamentId } : {}),
  })
}
