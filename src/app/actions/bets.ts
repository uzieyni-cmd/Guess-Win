'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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
  const lockTime = new Date(match.match_start_time).getTime() - 10 * 60 * 1000
  if (Date.now() >= lockTime) return { ok: false, error: 'הגשת הניחוש נסגרה' }

  // ולידציה: המשתמש משתתף בתחרות
  const { count } = await supabaseAdmin
    .from('tournament_participants')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)
  if (!count) return { ok: false, error: 'אינך משתתף בתחרות זו' }

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
