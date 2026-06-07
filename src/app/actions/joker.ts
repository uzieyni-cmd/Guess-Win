'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getJokerStageGroup } from '@/lib/constants'

// ── Toggle a joker pick on/off ────────────────────────────────────
// Rules:
//   • Only matches in a configured joker stage group (group stage / R32 / R16)
//   • Not locked (match_start_time − 10 min)
//   • Each stage group has its own independent quota — unused jokers
//     from one stage do not carry over to the next
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

  const stageGroup = getJokerStageGroup(m.round)
  if (!stageGroup) {
    return { ok: false, error: "ג'וקר אינו זמין בשלב זה" }
  }

  const lockTime = new Date(m.match_start_time).getTime() - 60 * 60 * 1000
  if (Date.now() >= lockTime) {
    return { ok: false, error: 'המשחק נעול' }
  }

  // Fetch existing joker picks for this user in this tournament, with each match's round
  const { data: existing } = await supabaseAdmin
    .from('joker_picks')
    .select('id, match_id, matches(round)')
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)

  const existingRows = (existing ?? []) as unknown as { id: string; match_id: string; matches: { round: string | null }[] | { round: string | null } | null }[]
  const roundOf = (r: (typeof existingRows)[number]) => Array.isArray(r.matches) ? r.matches[0]?.round ?? null : r.matches?.round ?? null
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
  const sameGroupCount = existingRows.filter(r => getJokerStageGroup(roundOf(r)) === stageGroup).length
  if (sameGroupCount >= stageGroup.max) {
    return { ok: false, error: `ניתן לסמן עד ${stageGroup.max} ג'וקר${stageGroup.max > 1 ? `ים (${stageGroup.label})` : ` ב${stageGroup.label}`}` }
  }

  const { error } = await supabaseAdmin
    .from('joker_picks')
    .insert({ match_id: matchId, tournament_id: tournamentId, user_id: user.id })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
