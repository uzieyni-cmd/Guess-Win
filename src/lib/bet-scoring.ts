import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { ENGLISH_TO_HEBREW_TEAM } from './team-names'

/**
 * מחשב ושומר ניקוד מלא למשחק לפי התוצאה הנוכחית: ניקוד בסיס, מכפיל ג'וקר,
 * בונוס ניחוש מדויק יחידני (+5, אחרי הכפלת ג'וקר), ובונוס נבחרת מדורגת.
 * אידמפוטנטית (reset-then-recompute) — נקראת גם במהלך משחק חי (בכל סנכרון)
 * וגם כשהוא מסתיים, כך שאין הבדל בין ניקוד "חי" לניקוד סופי.
 */
export async function scoreMatch(
  matchId: string,
  actualScore: { home: number; away: number }
): Promise<void> {
  const { home, away } = actualScore

  const { data: bets } = await supabaseAdmin
    .from('bets')
    .select('id, user_id, predicted_home, predicted_away')
    .eq('match_id', matchId)

  // ── ג'וקר — נדרש גם לבונוס נבחרת מדורגת, גם אם אין bets רגילים ──
  const { data: jokerPicksRaw } = await supabaseAdmin
    .from('joker_picks')
    .select('user_id')
    .eq('match_id', matchId)
  const jokerUserIds = new Set(
    (jokerPicksRaw ?? []).map((j) => (j as { user_id: string }).user_id)
  )

  if (!bets?.length) {
    await awardTeamBonusForMatch(matchId, actualScore, jokerUserIds)
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
  for (const b of scored) {
    if (jokerUserIds.has(b.userId) && b.points > 0) b.points *= 2
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
  await awardTeamBonusForMatch(matchId, actualScore, jokerUserIds)
}

/**
 * בונוס +2 (או +4 עם ג'וקר) לכל מי שבחר את הקבוצה המנצחת כ"נבחרת מדורגת".
 * נשמר על bets.team_bonus_pick — מאופס ומחושב מחדש בכל קריאה (idempotent).
 */
async function awardTeamBonusForMatch(
  matchId: string,
  actualScore: { home: number; away: number },
  jokerUserIds: Set<string>
): Promise<void> {
  // איפוס — מאפשר להריץ את הפונקציה שוב על אותו משחק בלי הצטברות
  await supabaseAdmin.from('bets').update({ team_bonus_pick: 0 }).eq('match_id', matchId)

  if (actualScore.home === actualScore.away) return // תיקו — אין מנצח

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('tournament_id, home_team_name, away_team_name')
    .eq('id', matchId)
    .single()
  if (!match) return

  const m = match as { tournament_id: string; home_team_name: string; away_team_name: string }
  const winnerEn = actualScore.home > actualScore.away ? m.home_team_name : m.away_team_name
  const winnerHe = ENGLISH_TO_HEBREW_TEAM[winnerEn]
  if (!winnerHe) return

  // כל שאלות "נבחרת מדורגת" בטורניר
  const { data: questions } = await supabaseAdmin
    .from('bonus_questions')
    .select('id')
    .eq('tournament_id', m.tournament_id)
    .eq('type', 'team_pick')
  if (!questions?.length) return

  // כל מי שבחר את הקבוצה המנצחת
  const { data: picks } = await supabaseAdmin
    .from('bonus_picks')
    .select('user_id')
    .in('bonus_question_id', (questions as { id: string }[]).map(q => q.id))
    .eq('pick', winnerHe)
  if (!picks?.length) return

  const userIds = (picks as { user_id: string }[]).map(p => p.user_id)

  const { data: existingBets } = await supabaseAdmin
    .from('bets')
    .select('id, user_id')
    .eq('match_id', matchId)
    .in('user_id', userIds)

  const betIdByUser = new Map(
    (existingBets ?? []).map((b) => {
      const row = b as { id: string; user_id: string }
      return [row.user_id, row.id] as const
    })
  )

  for (const userId of userIds) {
    const bonus = jokerUserIds.has(userId) ? 4 : 2
    const existingId = betIdByUser.get(userId)
    if (existingId) {
      await supabaseAdmin.from('bets').update({ team_bonus_pick: bonus }).eq('id', existingId)
    } else {
      await supabaseAdmin.from('bets').insert({
        user_id: userId,
        match_id: matchId,
        tournament_id: m.tournament_id,
        predicted_home: 0,
        predicted_away: 0,
        team_bonus_pick: bonus,
      })
    }
  }
}
