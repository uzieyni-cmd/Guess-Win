// Server-side auth helpers for Server Actions and Route Handlers.
import 'server-only'
import { createSupabaseServerClient } from './supabase-server'
import { supabaseAdmin } from './supabase-admin'

export const ADMIN_ROLES = ['admin', 'owner'] as const
export type AdminRole = typeof ADMIN_ROLES[number]

/**
 * Verifies the caller is owner or admin.
 * Throws if not. Returns userId.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!ADMIN_ROLES.includes(profile?.role as AdminRole)) throw new Error('Forbidden')
  return user.id
}

/**
 * Verifies the caller is owner, admin, OR a tournament_admin for the given tournament.
 * Throws if not. Returns userId.
 */
export async function requireTournamentAdmin(tournamentId: string): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as string
  if (ADMIN_ROLES.includes(role as AdminRole)) return user.id

  if (role === 'tournament_admin') {
    const { data: ta } = await supabaseAdmin
      .from('tournament_admins')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .single()
    if (ta) return user.id
  }

  throw new Error('Forbidden')
}

/**
 * Returns the current user's role (or null if unauthenticated).
 */
export async function getMyRole(): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (profile?.role as string) ?? null
}

/**
 * Returns the tournament IDs the current user can admin
 * (all for owner/admin, assigned list for tournament_admin).
 */
export async function getAdminTournamentIds(): Promise<string[] | 'all'> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as string
  if (ADMIN_ROLES.includes(role as AdminRole)) return 'all'

  if (role === 'tournament_admin') {
    const { data } = await supabaseAdmin
      .from('tournament_admins')
      .select('tournament_id')
      .eq('user_id', user.id)
    return (data ?? []).map((r: { tournament_id: string }) => r.tournament_id)
  }

  return []
}
