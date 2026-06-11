'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/auth-server'
import { awardRoundBonusForMatch } from './roundBonus'

/**
 * Rescore ALL finished matches in a tournament.
 * Useful when syncFixtures updated scores but points were never computed.
 * Applies: base score → unique predictor (+5) → joker (×2) → round bonus (+2).
 */
export async function rescoreTournamentBets(
  tournamentId: string
): Promise<{ ok: boolean; scored: number; error?: string }> {
  await requireAdmin()

  type MatchRow = { id: string; actual_home_score: number; actual_away_score: number }
  const { data: matches, error: mErr } = await supabaseAdmin
    .from('matches')
    .select('id, actual_home_score, actual_away_score')
    .eq('tournament_id', tournamentId)
    .eq('status', 'finished')
    .not('actual_home_score', 'is', null)
    .not('actual_away_score', 'is', null)

  if (mErr) return { ok: false, scored: 0, error: mErr.message }
  if (!matches?.length) return { ok: true, scored: 0 }

  // C3: שלוף את כל הג'וקרים לטורניר פעם אחת לפני הלולאה
  const { data: allJokers } = await supabaseAdmin
    .from('joker_picks')
    .select('user_id, match_id')
    .eq('tournament_id', tournamentId)
  const jokerMap = new Map<string, Set<string>>()
  for (const j of (allJokers ?? []) as { user_id: string; match_id: string }[]) {
    if (!jokerMap.has(j.match_id)) jokerMap.set(j.match_id, new Set())
    jokerMap.get(j.match_id)!.add(j.user_id)
  }

  let scored = 0
  for (const match of matches as MatchRow[]) {
    const home = match.actual_home_score
    const away = match.actual_away_score

    type BetRow = { id: string; user_id: string; predicted_home: number; predicted_away: number }
    const { data: bets } = await supabaseAdmin
      .from('bets')
      .select('id, user_id, predicted_home, predicted_away')
      .eq('match_id', match.id)

    if (!bets?.length) continue

    type ScoredBet = { id: string; userId: string; result: 'exact' | 'outcome' | 'miss'; points: number }

    // ── Step A: ניקוד בסיס ─────────────────────────────────────────
    const scoredBets: ScoredBet[] = (bets as BetRow[]).map(bet => {
      if (bet.predicted_home === home && bet.predicted_away === away) {
        return { id: bet.id, userId: bet.user_id, result: 'exact', points: 4 }
      }
      const predOut = bet.predicted_home > bet.predicted_away ? 'home' : bet.predicted_home < bet.predicted_away ? 'away' : 'draw'
      const actOut  = home > away ? 'home' : home < away ? 'away' : 'draw'
      if (predOut === actOut) return { id: bet.id, userId: bet.user_id, result: 'outcome', points: 1 }
      return { id: bet.id, userId: bet.user_id, result: 'miss', points: 0 }
    })

    // ── Step B: בונוס ניחוש מדויק יחידני (+5) ─────────────────────
    const exactOnes = scoredBets.filter(b => b.result === 'exact')
    if (exactOnes.length === 1) exactOnes[0].points = 9   // 4 + 5

    // ── Step C: מכפיל ג'וקר (×2) — מהמפה שנשלפה מראש ─────────────
    const jokerUserIds = jokerMap.get(match.id)
    if (jokerUserIds?.size) {
      for (const b of scoredBets) {
        if (jokerUserIds.has(b.userId) && b.points > 0) b.points *= 2
      }
    }

    // ── Step D: שמור ניקוד — batch upsert במקום N updates ─────────
    if (scoredBets.length > 0) {
      await supabaseAdmin
        .from('bets')
        .upsert(
          scoredBets.map(b => ({ id: b.id, points: b.points, result: b.result })),
          { onConflict: 'id' }
        )
    }

    // ── Step E: בונוס נבחרת מדורגת (+2 לניצחון) ──────────────────
    await awardRoundBonusForMatch(match.id)

    scored++
  }

  return { ok: true, scored }
}

const MIN = 0
const MAX = 30

export async function placeBetAction(
  matchId: string,
  tournamentId: string,
  home: number,
  away: number
): Promise<{ ok: boolean; error?: string }> {
  // אמת שהמשתמש מחובר
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { ok: false, error: 'Unauthorized' }

  // ולידציה server-side לניקוד
  if (
    !Number.isInteger(home) || !Number.isInteger(away) ||
    home < MIN || home > MAX || away < MIN || away > MAX
  ) {
    return { ok: false, error: 'ניקוד לא תקין' }
  }

  // ולידציה: המשחק לא נעול עדיין
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('match_start_time, status')
    .eq('id', matchId)
    .single()

  if (!match) return { ok: false, error: 'משחק לא נמצא' }
  if (match.status === 'live' || match.status === 'finished') return { ok: false, error: 'המשחק כבר התחיל' }
  const lockTime = new Date(match.match_start_time).getTime() - 60 * 60 * 1000
  if (Date.now() >= lockTime) return { ok: false, error: 'הגשת הניחוש נסגרה' }

  // בדוק תפקיד המשתמש
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isElevated = ['admin', 'tournament_admin'].includes(profile?.role ?? '')

  if (isElevated) {
    // מנהל — רשום אוטומטית לטורניר כדי להופיע בדירוגים
    await supabaseAdmin
      .from('tournament_participants')
      .upsert({ tournament_id: tournamentId, user_id: user.id }, { onConflict: 'tournament_id,user_id' })
  } else {
    // משתמש רגיל — חייב להיות משתתף
    const { count } = await supabaseAdmin
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
    if (!count) return { ok: false, error: 'אינך משתתף בתחרות זו' }
  }

  const { error } = await supabaseAdmin
    .from('bets')
    .upsert({
      user_id: user.id,
      match_id: matchId,
      tournament_id: tournamentId,
      predicted_home: home,
      predicted_away: away,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,match_id' })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Admin: מעדכן תוצאה סופית למשחק ומחשב נקודות לכל הבטים.
 * exact = 4 נק', outcome = 1 נק', miss = 0.
 */
export async function setActualScoreAction(
  matchId: string,
  home: number,
  away: number
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  // 1. עדכן תוצאה + סטטוס ב-matches
  const { error: matchErr } = await supabaseAdmin
    .from('matches')
    .update({ actual_home_score: home, actual_away_score: away, status: 'finished' })
    .eq('id', matchId)

  if (matchErr) return { ok: false, error: matchErr.message }

  // 2. חשב נקודות לכל הבטים על משחק זה (כולל כאלה שכבר ניקדו — override)
  const { data: bets } = await supabaseAdmin
    .from('bets')
    .select('id, user_id, predicted_home, predicted_away')
    .eq('match_id', matchId)

  if (!bets?.length) return { ok: true }

  type BetRow = { id: string; user_id: string; predicted_home: number; predicted_away: number }
  const betRows = bets as BetRow[]

  // ── Step A: ניקוד בסיס ────────────────────────────────────────
  type ScoredBet = { id: string; userId: string; result: 'exact' | 'outcome' | 'miss'; points: number }
  const scored: ScoredBet[] = betRows.map(bet => {
    if (bet.predicted_home === home && bet.predicted_away === away) {
      return { id: bet.id, userId: bet.user_id, result: 'exact', points: 4 }
    }
    const predOut = bet.predicted_home > bet.predicted_away ? 'home' : bet.predicted_home < bet.predicted_away ? 'away' : 'draw'
    const actOut  = home > away ? 'home' : home < away ? 'away' : 'draw'
    if (predOut === actOut) return { id: bet.id, userId: bet.user_id, result: 'outcome', points: 1 }
    return { id: bet.id, userId: bet.user_id, result: 'miss', points: 0 }
  })

  // ── Step B: בונוס ניחוש מדויק יחידני (+5 אם רק אחד ניחש נכון) ──
  const exactOnes = scored.filter(b => b.result === 'exact')
  if (exactOnes.length === 1) exactOnes[0].points = 9   // 4 + 5

  // ── Step C: מכפיל ג'וקר (×2 למשתמשים שסימנו ג'וקר על משחק זה) ──
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

  // ── Step D: כתוב ניקוד סופי — batch upsert במקום N updates ──────
  await supabaseAdmin
    .from('bets')
    .upsert(
      scored.map(b => ({ id: b.id, points: b.points, result: b.result })),
      { onConflict: 'id' }
    )

  // ── Step E: בונוס נבחרת מדורגת (+2 לניצחון) ──────────────────
  await awardRoundBonusForMatch(matchId)

  return { ok: true }
}
