'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const MAX_JOKERS = 3

// ── Toggle a joker pick on/off ────────────────────────────────────
// Rules:
//   • Only Group Stage matches (round starts with "Group Stage")
//   • Not locked (match_start_time − 10 min)
//   • At most MAX_JOKERS per user per tournament
export async function toggleJokerPick(
  matchId: string,
  tournamentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  // Validate match
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('match_start_time, round')
    .eq('id', matchId)
    .single()

  if (!match) return { ok: false, error: 'משחק לא נמצא' }

  const m = match as { match_start_time: string; round: string | null }

  if (!m.round?.startsWith('Group Stage')) {
    return { ok: false, error: "ג'וקר זמין רק בשלב הבתים" }
  }

  const lockTime = new Date(m.match_start_time).getTime() - 10 * 60 * 1000
  if (Date.now() >= lockTime) {
    return { ok: false, error: 'המשחק נעול' }
  }

  // Fetch existing joker picks for this user in this tournament
  const { data: existing } = await supabaseAdmin
    .from('joker_picks')
    .select('id, match_id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)

  const existingRows = (existing ?? []) as { id: string; match_id: string }[]
  const isCurrentJoker = existingRows.some(r => r.match_id === matchId)

  if (isCurrentJoker) {
    // ── Remove ──────────────────────────────────────────────────
    const { error } = await supabaseAdmin
      .from('joker_picks')
      .delete()
      .eq('user_id', user.id)
      .eq('match_id', matchId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  // ── Add ─────────────────────────────────────────────────────
  if (existingRows.length >= MAX_JOKERS) {
    return { ok: false, error: `ניתן לסמן עד ${MAX_JOKERS} ג'וקרים בלבד` }
  }

  const { error } = await supabaseAdmin
    .from('joker_picks')
    .insert({ match_id: matchId, tournament_id: tournamentId, user_id: user.id })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
