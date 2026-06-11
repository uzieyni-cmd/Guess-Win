import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { awardRoundBonusForMatch } from '@/app/actions/roundBonus'

/**
 * מחשב ושומר ניקוד מלא למשחק שהסתיים: ניקוד בסיס, מכפיל ג'וקר,
 * בונוס ניחוש מדויק יחידני (+5, אחרי הכפלת ג'וקר), ובונוס נבחרת מדורגת.
 */
export async function scoreFinishedMatch(
  matchId: string,
  actualScore: { home: number; away: number }
): Promise<void> {
  const { home, away } = actualScore

  const { data: bets } = await supabaseAdmin
    .from('bets')
    .select('id, user_id, predicted_home, predicted_away')
    .eq('match_id', matchId)

  if (!bets?.length) {
    await awardRoundBonusForMatch(matchId)
    return
  }

  type BetRow = { id: string; user_id: string; predicted_home: number; predicted_away: number }
  type ScoredBet = { id: string; userId: string; result: 'exact' | 'outcome' | 'miss'; points: number }

  // ── Step A: ניקוד בסיס ────────────────────────────────────────
  const scored: ScoredBet[] = (bets as BetRow[]).map(bet => {
    if (bet.predicted_home === home && bet.predicted_away === away) {
      return { id: bet.id, userId: bet.user_id, result: 'exact', points: 4 }
    }
    const predOut = bet.predicted_home > bet.predicted_away ? 'home' : bet.predicted_home < bet.predicted_away ? 'away' : 'draw'
    const actOut  = home > away ? 'home' : home < away ? 'away' : 'draw'
    if (predOut === actOut) return { id: bet.id, userId: bet.user_id, result: 'outcome', points: 1 }
    return { id: bet.id, userId: bet.user_id, result: 'miss', points: 0 }
  })

  // ── Step B: מכפיל ג'וקר (×2 למשתמשים שסימנו ג'וקר על משחק זה) ──
  const { data: jokerPicksRaw } = await supabaseAdmin
    .from('joker_picks')
    .select('user_id')
    .eq('match_id', matchId)

  if (jokerPicksRaw?.length) {
    const jokerUserIds = new Set(
      (jokerPicksRaw as { user_id: string }[]).map(j => j.user_id)
    )
    for (const b of scored) {
      if (jokerUserIds.has(b.userId) && b.points > 0) b.points *= 2
    }
  }

  // ── Step C: בונוס ניחוש מדויק יחידני (+5, לא מוכפל בג'וקר) ──────
  const exactOnes = scored.filter(b => b.result === 'exact')
  if (exactOnes.length === 1) exactOnes[0].points += 5

  // ── Step D: כתוב ניקוד סופי ──────────────────────────────────
  for (const b of scored) {
    await supabaseAdmin
      .from('bets')
      .update({ points: b.points, result: b.result })
      .eq('id', b.id)
  }

  // ── Step E: בונוס נבחרת מדורגת (+2, או +4 עם ג'וקר על המשחק) ──
  await awardRoundBonusForMatch(matchId)
}
