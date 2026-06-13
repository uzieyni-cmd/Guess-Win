'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Delete a user and all their data.
 * Allowed for both 'admin' and 'tournament_admin'.
 * Cannot delete another admin.
 */
export async function deleteUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { ok: false, error: 'Unauthorized' }

    // Verify caller role
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const callerRole = callerProfile?.role as string
    if (callerRole !== 'admin' && callerRole !== 'tournament_admin') {
      return { ok: false, error: 'אין הרשאה' }
    }

    // Can't delete yourself
    if (user.id === userId) return { ok: false, error: 'לא ניתן למחוק את עצמך' }

    // Fetch target role
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!targetProfile) return { ok: false, error: 'משתמש לא נמצא' }
    if (targetProfile.role === 'admin') return { ok: false, error: 'לא ניתן למחוק מנהל' }

    // Delete all related data using admin client (bypasses RLS)
    await supabaseAdmin.from('bets').delete().eq('user_id', userId)
    await supabaseAdmin.from('bonus_picks').delete().eq('user_id', userId)
    await supabaseAdmin.from('joker_picks').delete().eq('user_id', userId)
    await supabaseAdmin.from('tournament_participants').delete().eq('user_id', userId)
    await supabaseAdmin.from('tournament_admins').delete().eq('user_id', userId)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'שגיאה לא צפויה' }
  }
}

/**
 * Toggle paid status for a user in a specific tournament.
 */
export async function setPaymentStatus(
  userId: string,
  tournamentId: string,
  paid: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { ok: false, error: 'Unauthorized' }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single()

    const callerRole = callerProfile?.role as string
    if (callerRole !== 'admin' && callerRole !== 'tournament_admin') {
      return { ok: false, error: 'אין הרשאה' }
    }

    const { error } = await supabaseAdmin
      .from('tournament_participants')
      .update({ paid })
      .eq('user_id', userId)
      .eq('tournament_id', tournamentId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'שגיאה לא צפויה' }
  }
}

/**
 * Update a user's tournament participation list.
 * Allowed for both 'admin' and 'tournament_admin'.
 * Tournament_admin can only assign/remove tournaments they manage.
 */
export async function updateUserTournaments(
  userId: string,
  tournamentIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { ok: false, error: 'Unauthorized' }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const callerRole = callerProfile?.role as string
    if (callerRole !== 'admin' && callerRole !== 'tournament_admin') {
      return { ok: false, error: 'אין הרשאה' }
    }

    // For tournament_admin: only allow assigning to their own tournaments
    let allowedTournamentIds: string[] | null = null
    if (callerRole === 'tournament_admin') {
      const { data: ta } = await supabaseAdmin
        .from('tournament_admins')
        .select('tournament_id')
        .eq('user_id', user.id)
      allowedTournamentIds = (ta ?? []).map((r: { tournament_id: string }) => r.tournament_id)
      // Filter requested IDs to only allowed ones
      tournamentIds = tournamentIds.filter(id => allowedTournamentIds!.includes(id))
    }

    // Compute diff — only delete what was removed, only add what's new
    // (Never delete-all-then-re-add: that would cascade-delete bets)
    const scopeFilter = callerRole === 'admin'
      ? supabaseAdmin.from('tournament_participants').select('tournament_id').eq('user_id', userId)
      : supabaseAdmin.from('tournament_participants').select('tournament_id').eq('user_id', userId)
        .in('tournament_id', allowedTournamentIds ?? [])

    const { data: currentRows } = await scopeFilter
    const currentIds = (currentRows ?? []).map((r: { tournament_id: string }) => r.tournament_id)

    const scopedNew = callerRole === 'admin'
      ? tournamentIds
      : tournamentIds.filter(id => (allowedTournamentIds ?? []).includes(id))

    const toRemove = currentIds.filter((id: string) => !scopedNew.includes(id))
    const toAdd    = scopedNew.filter((id: string) => !currentIds.includes(id))

    if (toRemove.length > 0) {
      await supabaseAdmin
        .from('tournament_participants')
        .delete()
        .eq('user_id', userId)
        .in('tournament_id', toRemove)
    }

    if (toAdd.length > 0) {
      const rows = toAdd.map((tid: string) => ({ user_id: userId, tournament_id: tid }))
      await supabaseAdmin.from('tournament_participants').upsert(rows, { onConflict: 'user_id,tournament_id' })
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'שגיאה לא צפויה' }
  }
}
