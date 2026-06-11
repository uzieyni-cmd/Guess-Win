import 'server-only'
import { supabaseAdmin } from './supabase-admin'

export async function computeAndSaveBetPoints(
  matchId: string,
  actualScore: { home: number; away: number }
): Promise<void> {
  const { data: bets } = await supabaseAdmin
    .from('bets')
    .select('id, predicted_home, predicted_away')
    .eq('match_id', matchId)
    .is('points', null)

  if (!bets?.length) return

  for (const bet of bets as { id: string; predicted_home: number; predicted_away: number }[]) {
    const p = { home: bet.predicted_home, away: bet.predicted_away }
    let result: 'exact' | 'outcome' | 'miss'
    let points: number

    if (p.home === actualScore.home && p.away === actualScore.away) {
      result = 'exact'; points = 3
    } else {
      const predOut = p.home > p.away ? 'home' : p.away > p.home ? 'away' : 'draw'
      const actOut = actualScore.home > actualScore.away ? 'home' : actualScore.away > actualScore.home ? 'away' : 'draw'
      if (predOut === actOut) { result = 'outcome'; points = 1 }
      else { result = 'miss'; points = 0 }
    }

    await supabaseAdmin
      .from('bets')
      .update({ points, result })
      .eq('id', bet.id)
  }
}
