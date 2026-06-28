'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/auth-server'
import { scoreMatch } from '@/lib/bet-scoring'
import { MATCH_LOCK_BEFORE_MS } from '@/lib/constants'

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

  let scored = 0
  for (const match of matches as MatchRow[]) {
    await scoreMatch(match.id, { home: match.actual_home_score, away: match.actual_away_score })
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
    .select('match_start_time, status, hidden')
    .eq('id', matchId)
    .single()

  if (!match) return { ok: false, error: 'משחק לא נמצא' }
  if (match.hidden) return { ok: false, error: 'המשחק אינו זמין לניחוש' }
  if (match.status === 'live' || match.status === 'finished') return { ok: false, error: 'המשחק כבר התחיל' }
  const lockTime = new Date(match.match_start_time).getTime() - MATCH_LOCK_BEFORE_MS
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

  // 2. חשב ושמור ניקוד מלא (ניקוד בסיס, ג'וקר, בונוס יחיד, בונוס דרגים)
  await scoreMatch(matchId, { home, away })

  return { ok: true }
}
