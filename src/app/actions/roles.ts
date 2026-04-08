'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth-server'
import { UserRole } from '@/types'

/**
 * Owner/admin: set a user's role.
 * - Owner cannot be demoted.
 * - Only owner can promote to admin.
 */
export async function setUserRole(
  targetUserId: string,
  newRole: UserRole
): Promise<{ ok: boolean; error?: string }> {
  const callerId = await requireAdmin()

  // Fetch caller role
  const { data: caller } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()
  const callerRole = caller?.role as string

  // Fetch target role
  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .single()
  const targetRole = target?.role as string

  // Owner is immutable
  if (targetRole === 'owner') return { ok: false, error: 'לא ניתן לשנות תפקיד הבעלים' }

  // Only owner can promote to admin
  if (newRole === 'admin' && callerRole !== 'owner') {
    return { ok: false, error: 'רק הבעלים יכול להגדיר מנהלים' }
  }

  // Owner cannot be set as new role by non-owner
  if (newRole === 'owner') return { ok: false, error: 'לא ניתן להגדיר בעלים נוסף' }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetUserId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Owner/admin: assign a user as tournament admin for a specific tournament.
 */
export async function assignTournamentAdmin(
  tournamentId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  // Ensure user is tournament_admin role
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (!profile) return { ok: false, error: 'משתמש לא נמצא' }

  // If user is not yet tournament_admin (and not full admin), promote them
  if (profile.role === 'user') {
    await supabaseAdmin
      .from('profiles')
      .update({ role: 'tournament_admin' })
      .eq('id', userId)
  }

  const { error } = await supabaseAdmin
    .from('tournament_admins')
    .upsert({ tournament_id: tournamentId, user_id: userId }, { onConflict: 'tournament_id,user_id' })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Owner/admin: remove tournament admin assignment.
 * If user has no more assignments, reverts role to 'user'.
 */
export async function removeTournamentAdmin(
  tournamentId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const { error } = await supabaseAdmin
    .from('tournament_admins')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)

  if (error) return { ok: false, error: error.message }

  // Check if user has other assignments
  const { data: remaining } = await supabaseAdmin
    .from('tournament_admins')
    .select('id')
    .eq('user_id', userId)

  if (!remaining?.length) {
    // No more assignments — revert to user
    await supabaseAdmin
      .from('profiles')
      .update({ role: 'user' })
      .eq('id', userId)
      .eq('role', 'tournament_admin')  // only if still tournament_admin
  }

  return { ok: true }
}

/**
 * Get all tournament admins for a tournament.
 */
export async function getTournamentAdmins(
  tournamentId: string
): Promise<{ userId: string; displayName: string; email: string }[]> {
  await requireAdmin()

  const { data } = await supabaseAdmin
    .from('tournament_admins')
    .select('user_id, profiles(display_name, email)')
    .eq('tournament_id', tournamentId)

  return (data ?? []).map((r: { user_id: string; profiles: { display_name: string; email: string }[] | null }) => ({
    userId: r.user_id,
    displayName: r.profiles?.[0]?.display_name ?? '',
    email: r.profiles?.[0]?.email ?? '',
  }))
}
